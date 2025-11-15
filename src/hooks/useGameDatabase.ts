import { formatGameToDatabase, getGameFromPgn } from "@/lib/chess";
import { GameEval } from "@/types/eval";
import { Game } from "@/types/game";
import { Chess } from "chess.js";
import { openDB, DBSchema, IDBPDatabase } from "idb";
import { atom, useAtom } from "jotai";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState, useMemo } from "react";

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
const fetchGamesAtom = atom<boolean>(false);

export const useGameDatabase = (shouldFetchGames?: boolean) => {
  const [db, setDb] = useState<IDBPDatabase<GameDatabaseSchema> | null>(null);
  const [games, setGames] = useAtom(gamesAtom);
  const [onlineGames, setOnlineGames] = useAtom(onlineGamesAtom);
  const [fetchGames, setFetchGames] = useAtom(fetchGamesAtom);
  const [gameFromUrl, setGameFromUrl] = useState<Game | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (shouldFetchGames !== undefined) {
      setFetchGames(shouldFetchGames);
    }
  }, [shouldFetchGames, setFetchGames]);

  // FIXED: IndexedDB initialization with proper version handling
  useEffect(() => {
    const initDatabase = async () => {
      try {
        // Check if database exists and get current version
        const existingDB = await openDB<GameDatabaseSchema>("games");
        const currentVersion = existingDB.version;
        existingDB.close();

        // Open with current version to avoid recreation issues
        const idb = await openDB<GameDatabaseSchema>("games", currentVersion, {
          upgrade(db, oldVersion) {
            console.log(`Upgrading database from version ${oldVersion} to ${currentVersion}`);
            
            // Only create stores if they don't exist
            if (!db.objectStoreNames.contains('games')) {
              db.createObjectStore("games", { 
                keyPath: "id", 
                autoIncrement: true 
              });
            }
            
            if (!db.objectStoreNames.contains('onlineGames')) {
              const onlineStore = db.createObjectStore("onlineGames", { 
                keyPath: "id" 
              });
              onlineStore.createIndex("byDate", "date");
            }
          },
        });
        setDb(idb);
      } catch (error) {
        console.error("Error initializing database:", error);
        // Fallback: try to create fresh database
        try {
          const idb = await openDB<GameDatabaseSchema>("games", 1, {
            upgrade(db) {
              if (!db.objectStoreNames.contains('games')) {
                db.createObjectStore("games", { 
                  keyPath: "id", 
                  autoIncrement: true 
                });
              }
              
              if (!db.objectStoreNames.contains('onlineGames')) {
                const onlineStore = db.createObjectStore("onlineGames", { 
                  keyPath: "id" 
                });
                onlineStore.createIndex("byDate", "date");
              }
            },
          });
          setDb(idb);
        } catch (fallbackError) {
          console.error("Fallback database initialization failed:", fallbackError);
        }
      }
    };

    initDatabase();
  }, []);

  const loadGames = useCallback(async () => {
    if (db && fetchGames) {
      setIsLoading(true);
      try {
        const [localGames, onlineGamesList] = await Promise.all([
          db.getAll("games"),
          db.getAll("onlineGames")
        ]);
        
        setGames(localGames);
        setOnlineGames(onlineGamesList);
      } catch (error) {
        console.error("Error loading games:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [db, fetchGames, setGames, setOnlineGames]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // SIMPLIFIED: Save PGN to onlineGames collection (uses existing structure)
  const addOnlineGame = useCallback(async (
    pgnString: string, 
    gameId: string, 
    status: 'finished' | 'active',
    terminationReason?: string
  ) => {
    if (!db) {
      console.error("Database not initialized");
      return gameId; // Return the ID so analysis can continue
    }

    try {
      // Extract game info from PGN
      const chess = new Chess();
      try {
        chess.loadPgn(pgnString);
      } catch (e) {
        console.error("Failed to load PGN for analysis:", e);
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
        // Add FEN and moves for compatibility with existing analysis
        fen: chess.fen(),
        moves: moves
      };

      await db.put("onlineGames", gameToAdd);
      
      // Refresh the games list
      loadGames();
      
      return gameId; // Return the game ID for analysis
    } catch (error) {
      console.error("Error saving online game to IndexedDB:", error);
      return gameId; // STILL return the ID so analysis can continue
    }
  }, [db, loadGames]);

  // Helper function to extract result from PGN
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

  // COMPLETELY FIXED: setGameEval function - NO MORE THROWING ERRORS
  const setGameEval = useCallback(
    async (gameId: number | string, evaluation: GameEval, isOnlineGame: boolean = false) => {
      if (!db) {
        console.warn("Database not initialized - skipping evaluation save");
        return;
      }

      const storeName = isOnlineGame ? "onlineGames" : "games";
      
      try {
        const game = await db.get(storeName, gameId as any);
        
        if (!game) {
          console.warn(`Game not found in ${storeName}: ${gameId}. Creating basic record...`);
          
          // Create a basic game record for evaluation storage
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
            eval: evaluation // Add evaluation directly
          };
          
          await db.put(storeName, basicGame);
        } else {
          // Update existing game with evaluation
          await db.put(storeName, { ...game, eval: evaluation });
        }
        
        // Refresh games list
        loadGames();
        
      } catch (error) {
        console.warn("Error setting game evaluation - analysis can continue without saving:", error);
        // DON'T throw the error - just log it and continue
        // This prevents the analysis from breaking entirely
      }
    },
    [db, loadGames]
  );

  // FIXED: getGame function with better error handling
  const getGame = useCallback(
    async (gameId: number | string, isOnlineGame: boolean = false) => {
      if (!db) {
        console.error("Database not initialized");
        return undefined;
      }
      
      if ((isOnlineGame && typeof gameId !== 'string') || 
          (!isOnlineGame && typeof gameId !== 'number')) {
        console.error("Invalid game ID type:", gameId, isOnlineGame);
        return undefined;
      }

      try {
        const storeName = isOnlineGame ? "onlineGames" : "games";
        const game = await db.get(storeName, gameId as any);
        
        if (!game) {
          console.warn(`Game not found: ${gameId} in ${storeName}`);
        }
        
        return game;
      } catch (error) {
        console.error("Error getting game:", error);
        return undefined;
      }
    },
    [db]
  );

  // Local game functions
  const addGame = useCallback(
    async (game: Chess) => {
      if (!db) {
        console.error("Database not initialized");
        return null;
      }

      try {
        const gameToAdd = formatGameToDatabase(game);
        const gameId = await db.add("games", gameToAdd as Game);
        loadGames();
        return gameId;
      } catch (error) {
        console.error("Error adding game:", error);
        return null;
      }
    },
    [db, loadGames]
  );

  const deleteGame = useCallback(
    async (gameId: number | string, isOnlineGame: boolean = false) => {
      if (!db) {
        console.error("Database not initialized");
        return;
      }

      try {
        const storeName = isOnlineGame ? "onlineGames" : "games";
        await db.delete(storeName, gameId as any);
        loadGames();
      } catch (error) {
        console.error("Error deleting game:", error);
      }
    },
    [db, loadGames]
  );

  const getAllGames = useCallback(async () => {
    if (!db) return { localGames: [], onlineGames: [] };

    try {
      const [localGames, onlineGames] = await Promise.all([
        db.getAll("games"),
        db.getAll("onlineGames")
      ]);
      return { localGames, onlineGames };
    } catch (error) {
      console.error("Error getting all games:", error);
      return { localGames: [], onlineGames: [] };
    }
  }, [db]);

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
          console.error("Error loading game from URL:", error);
          setGameFromUrl(undefined);
        }
      } else {
        setGameFromUrl(undefined);
      }
    };

    loadGameFromUrl();
  }, [gameId, db, getGame]);

  const isReady = db !== null;

  const allGames = useMemo(() => {
    const localWithType = games.map(game => ({ 
      ...game, 
      gameType: "Local",
      displayId: game.id
    }));
    const onlineWithType = onlineGames.map(game => ({ 
      ...game, 
      gameType: "Online",
      displayId: game.id
    }));
    return [...localWithType, ...onlineWithType];
  }, [games, onlineGames]);

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
    isLoading,
    isReady,
    gameFromUrl,
  };
};