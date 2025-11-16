import { formatGameToDatabase, getGameFromPgn } from "@/lib/chess";
import { GameEval } from "@/types/eval";
import { Game } from "@/types/game";
import { Chess } from "chess.js";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { atom, useAtom } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebaseClient";
import { 
  getUserData, 
  getUserPuzzleHistory,
  savePuzzleResult,
  PuzzleHistory 
} from "@/lib/firebaseClient";

interface GameDatabaseSchema extends DBSchema {
  games: {
    value: Game;
    key: number;
  };
  onlineGames: {
    value: Game;
    key: string;
  };
}

const gamesAtom = atom<Game[]>([]);
const onlineGamesAtom = atom<Game[]>([]);
const userGamesAtom = atom<Game[]>([]);
const fetchGamesAtom = atom<boolean>(false);

// Helper function to get game result from PGN
const getGameResultFromPgn = (pgnString: string): string => {
  try {
    const game = new Chess();
    game.loadPgn(pgnString);
    const headers = game.header();
    return headers.Result || '*';
  } catch (e) {
    return '*';
  }
};

export const useGameDatabase = (shouldFetchGames?: boolean) => {
  const [db, setDb] = useState<IDBPDatabase<GameDatabaseSchema> | null>(null);
  const [games, setGames] = useAtom(gamesAtom);
  const [onlineGames, setOnlineGames] = useAtom(onlineGamesAtom);
  const [userGames, setUserGames] = useAtom(userGamesAtom);
  const [fetchGames, setFetchGames] = useAtom(fetchGamesAtom);
  const [gameFromUrl, setGameFromUrl] = useState<Game | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // Firebase auth integration
  const [user, userLoading] = useAuthState(auth);

  useEffect(() => {
    if (shouldFetchGames !== undefined) {
      setFetchGames(shouldFetchGames);
    }
  }, [shouldFetchGames, setFetchGames]);

  // FIXED: Simplified IndexedDB initialization
  useEffect(() => {
    const initDatabase = async () => {
      try {
        console.log("🔄 Initializing IndexedDB...");
        
        // Always use version 1 and recreate if needed
        const idb = await openDB<GameDatabaseSchema>("ChessGamesDB", 1, {
          upgrade(db) {
            console.log("📦 Creating database stores...");
            
            // Create games store if it doesn't exist
            if (!db.objectStoreNames.contains('games')) {
              console.log("➕ Creating 'games' store");
              db.createObjectStore("games", { 
                keyPath: "id", 
                autoIncrement: true 
              });
            }
            
            // Create onlineGames store if it doesn't exist
            if (!db.objectStoreNames.contains('onlineGames')) {
              console.log("➕ Creating 'onlineGames' store");
              const onlineStore = db.createObjectStore("onlineGames", { 
                keyPath: "id" 
              });
              onlineStore.createIndex("byDate", "date");
            }
          },
        });

        console.log("✅ Database initialized successfully");
        setDb(idb);
      } catch (error) {
        console.error("❌ Database initialization failed:", error);
        
        // Last resort: try to delete and recreate the database
        try {
          console.log("🔄 Attempting database reset...");
          indexedDB.deleteDatabase("ChessGamesDB");
          
          // Wait a bit and try again
          setTimeout(async () => {
            try {
              const idb = await openDB<GameDatabaseSchema>("ChessGamesDB", 1, {
                upgrade(db) {
                  db.createObjectStore("games", { 
                    keyPath: "id", 
                    autoIncrement: true 
                  });
                  const onlineStore = db.createObjectStore("onlineGames", { 
                    keyPath: "id" 
                  });
                  onlineStore.createIndex("byDate", "date");
                },
              });
              setDb(idb);
              console.log("✅ Database reset successful");
            } catch (resetError) {
              console.error("❌ Database reset failed:", resetError);
            }
          }, 1000);
        } catch (deleteError) {
          console.error("❌ Database deletion failed:", deleteError);
        }
      }
    };

    initDatabase();
  }, []);

  // NEW: Load user games from Firebase
  const loadUserGamesFromFirebase = useCallback(async () => {
    if (!user) {
      setUserGames([]);
      return;
    }

    try {
      console.log("🔥 Loading user games from Firebase...");
      
      // Get user puzzle history (this contains game data)
      const puzzleHistory = await getUserPuzzleHistory(user.uid, { limit: 100 });
      
      // Convert puzzle history to game format
      const userGamesFromFirebase: Game[] = puzzleHistory.map((puzzle, index) => ({
        id: `firebase_${puzzle.puzzleId}_${index}`,
        pgn: `[Event "Puzzle"]\n[Site "Tembo Chess"]\n[Date "${puzzle.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()}"]\n[Result "${puzzle.solved ? '1-0' : '0-1'}"]\n[White "You"]\n[Black "Puzzle"]\n\n*`,
        status: 'finished',
        result: puzzle.solved ? '1-0' : '0-1',
        date: puzzle.createdAt?.toDate?.()?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        event: "Chess Puzzle",
        site: "Tembo Chess",
        white: { name: "You" },
        black: { name: "Puzzle" },
        timeControl: "Untimed",
        fen: "",
        moves: [],
        puzzleData: puzzle
      }));

      console.log(`✅ Loaded ${userGamesFromFirebase.length} user games from Firebase`);
      setUserGames(userGamesFromFirebase);
    } catch (error) {
      console.error("❌ Error loading user games from Firebase:", error);
      setUserGames([]);
    }
  }, [user]);

  const loadGames = useCallback(async () => {
    if (db && fetchGames) {
      setIsLoading(true);
      try {
        console.log("📥 Loading games from database...");
        
        await Promise.all([
          // Load local IndexedDB games
          (async () => {
            try {
              const [localGames, onlineGamesList] = await Promise.all([
                db.getAll("games").catch(() => {
                  console.warn("⚠️ Could not load local games");
                  return [];
                }),
                db.getAll("onlineGames").catch(() => {
                  console.warn("⚠️ Could not load online games");
                  return [];
                })
              ]);
              
              console.log(`✅ Loaded ${localGames.length} local games and ${onlineGamesList.length} online games`);
              setGames(localGames);
              setOnlineGames(onlineGamesList);
            } catch (error) {
              console.error("❌ Error loading local games:", error);
              setGames([]);
              setOnlineGames([]);
            }
          })(),
          
          // Load Firebase user games
          loadUserGamesFromFirebase()
        ]);
        
      } catch (error) {
        console.error("❌ Error loading games:", error);
        setGames([]);
        setOnlineGames([]);
        setUserGames([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [db, fetchGames, setGames, setOnlineGames, loadUserGamesFromFirebase]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Save PGN to onlineGames collection
  const addOnlineGame = useCallback(async (
    pgnString: string, 
    gameId: string, 
    status: 'finished' | 'active',
    terminationReason?: string
  ) => {
    if (!db) {
      console.warn("⚠️ Database not initialized - caching game ID for later");
      return gameId;
    }

    try {
      console.log(`💾 Saving online game: ${gameId}`);
      
      // Extract game info from PGN
      const chess = new Chess();
      try {
        chess.loadPgn(pgnString);
      } catch (e) {
        console.warn("⚠️ Failed to load PGN, creating basic game record");
      }

      const headers = chess.header();
      const moves = chess.history();
      
      const gameToAdd: Game = {
        id: gameId,
        pgn: pgnString,
        status: status,
        termination: terminationReason,
        result: headers.Result || getGameResultFromPgn(pgnString),
        date: headers.Date || new Date().toISOString().split('T')[0],
        event: headers.Event || "Online Game",
        site: headers.Site || "Tembo Chess Online",
        white: { 
          name: headers.White || "White",
          rating: headers.WhiteElo ? parseInt(headers.WhiteElo) : undefined
        },
        black: { 
          name: headers.Black || "Black", 
          rating: headers.BlackElo ? parseInt(headers.BlackElo) : undefined
        },
        timeControl: headers.TimeControl || "10+0",
        fen: chess.fen(),
        moves: moves
      };

      await db.put("onlineGames", gameToAdd);
      
      console.log("✅ Online game saved successfully");
      loadGames();
      
      return gameId;
    } catch (error) {
      console.warn("⚠️ Error saving online game - continuing without save:", error);
      return gameId;
    }
  }, [db, loadGames]);

  // Set game evaluation with robust error handling
  const setGameEval = useCallback(
    async (gameId: number | string, evaluation: GameEval, isOnlineGame: boolean = false) => {
      if (!db) {
        console.warn("⚠️ Database not initialized - skipping evaluation save");
        return;
      }

      const storeName = isOnlineGame ? "onlineGames" : "games";
      
      try {
        console.log(`💾 Saving evaluation for game: ${gameId}`);
        
        const game = await db.get(storeName, gameId as any);
        
        if (!game) {
          console.warn(`⚠️ Game ${gameId} not found in ${storeName}. Creating basic record.`);
          
          const basicGame: Game = {
            id: gameId as string,
            pgn: "",
            status: 'finished',
            result: '*',
            date: new Date().toISOString().split('T')[0],
            event: "Online Game",
            site: "Tembo Chess Online",
            white: { name: "White" },
            black: { name: "Black" },
            timeControl: "10+0",
            eval: evaluation
          };
          
          await db.put(storeName, basicGame);
        } else {
          await db.put(storeName, { ...game, eval: evaluation });
        }
        
        console.log("✅ Evaluation saved successfully");
        loadGames();
        
      } catch (error) {
        console.warn("⚠️ Error setting game evaluation - analysis continues:", error);
      }
    },
    [db, loadGames]
  );

  // Get game with proper error handling
  const getGame = useCallback(
    async (gameId: number | string, isOnlineGame: boolean = false) => {
      if (!db) {
        console.warn("⚠️ Database not initialized");
        return undefined;
      }

      try {
        const storeName = isOnlineGame ? "onlineGames" : "games";
        const game = await db.get(storeName, gameId as any);
        
        if (!game) {
          console.warn(`⚠️ Game ${gameId} not found in ${storeName}`);
        }
        
        return game;
      } catch (error) {
        console.error("❌ Error getting game:", error);
        return undefined;
      }
    },
    [db]
  );

  // Local game functions
  const addGame = useCallback(
    async (game: Chess) => {
      if (!db) {
        console.error("❌ Database not initialized");
        return null;
      }

      try {
        const gameToAdd = formatGameToDatabase(game);
        const gameId = await db.add("games", gameToAdd as Game);
        console.log("✅ Local game saved with ID:", gameId);
        loadGames();
        return gameId;
      } catch (error) {
        console.error("❌ Error adding local game:", error);
        return null;
      }
    },
    [db, loadGames]
  );

  const deleteGame = useCallback(
    async (gameId: number | string, isOnlineGame: boolean = false) => {
      if (!db) {
        console.error("❌ Database not initialized");
        return;
      }

      try {
        const storeName = isOnlineGame ? "onlineGames" : "games";
        await db.delete(storeName, gameId as any);
        console.log("🗑️ Game deleted:", gameId);
        loadGames();
      } catch (error) {
        console.error("❌ Error deleting game:", error);
      }
    },
    [db, loadGames]
  );

  const getAllGames = useCallback(async () => {
    if (!db) {
      console.warn("⚠️ Database not initialized");
      return { localGames: [], onlineGames: [], userGames: [] };
    }

    try {
      const [localGames, onlineGames] = await Promise.all([
        db.getAll("games").catch(() => []),
        db.getAll("onlineGames").catch(() => [])
      ]);
      
      return { 
        localGames, 
        onlineGames, 
        userGames 
      };
    } catch (error) {
      console.error("❌ Error getting all games:", error);
      return { localGames: [], onlineGames: [], userGames: [] };
    }
  }, [db, userGames]);

  // NEW: Function to save user game to Firebase
  const saveUserGameToFirebase = useCallback(async (
    gameData: Partial<Game>,
    puzzleId?: string
  ) => {
    if (!user) {
      console.warn("⚠️ User not authenticated - cannot save to Firebase");
      return null;
    }

    try {
      // If it's a puzzle, save to puzzle history
      if (puzzleId) {
        await savePuzzleResult(user.uid, {
          id: puzzleId,
          rating: 1200, // Default rating
          theme: gameData.event || "General",
          fen: gameData.fen || "",
          moves: gameData.moves || []
        }, gameData.result === '1-0', 0);
      }
      
      // Reload user games to include the new one
      await loadUserGamesFromFirebase();
      
      return puzzleId;
    } catch (error) {
      console.error("❌ Error saving user game to Firebase:", error);
      return null;
    }
  }, [user, loadUserGamesFromFirebase]);

  const router = useRouter();
  const { gameId } = router.query;

  useEffect(() => {
    const loadGameFromUrl = async () => {
      if (!db) return;

      if (typeof gameId === "string") {
        try {
          const numericId = parseInt(gameId);
          if (!isNaN(numericId)) {
            const localGame = await getGame(numericId, false);
            if (localGame) {
              setGameFromUrl(localGame);
              return;
            }
          }
          
          const onlineGame = await getGame(gameId, true);
          setGameFromUrl(onlineGame || undefined);
        } catch (error) {
          console.error("❌ Error loading game from URL:", error);
          setGameFromUrl(undefined);
        }
      } else {
        setGameFromUrl(undefined);
      }
    };

    loadGameFromUrl();
  }, [gameId, db, getGame]);

  const isReady = db !== null && !userLoading;

  const allGames = useMemo(() => {
    const localWithType = games.map(game => ({ 
      ...game, 
      gameType: "Local",
      displayId: game.id,
      source: "indexeddb"
    }));
    
    const onlineWithType = onlineGames.map(game => ({ 
      ...game, 
      gameType: "Online",
      displayId: game.id,
      source: "indexeddb"
    }));
    
    const userWithType = userGames.map(game => ({
      ...game,
      gameType: "Puzzle",
      displayId: game.id,
      source: "firebase"
    }));

    return [...localWithType, ...onlineWithType, ...userWithType];
  }, [games, onlineGames, userGames]);

  return {
    addGame,
    addOnlineGame,
    setGameEval,
    getGame,
    deleteGame,
    getAllGames,
    games: allGames,
    localGames: games,
    onlineGames,
    userGames,
    isLoading: isLoading || userLoading,
    isReady,
    gameFromUrl,
    saveUserGameToFirebase,
    loadUserGamesFromFirebase
  };
};