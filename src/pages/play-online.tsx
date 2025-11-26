import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, Move } from "chess.js";
import { db, auth, ensureUser } from "../lib/firebaseClient";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  Button, 
  Typography, 
  Box, 
  Paper, 
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Switch,
  SelectChangeEvent,
  Snackbar,
  useTheme,
} from "@mui/material";
import { setGameHeaders, getGameResult } from "@/lib/chess";
import { useGameDatabase } from "@/hooks/useGameDatabase";

// Updated Game interface with playerTier
interface Game {
  id: string;
  white: string;
  black: string | null;
  status: 'waiting' | 'active' | 'finished';
  createdAt: Timestamp;
  startedAt?: Timestamp;
  currentPlayer: 'white' | 'black';
  winner?: string;
  timeControl: string;
  rated: boolean;
  whiteTime: number;
  blackTime: number;
  lastMoveTime: any;
  
  // Active game fields
  fen?: string;
  moves?: string[];
  
  // Finished game fields
  pgn?: string;
  termination?: string;
  result?: string;
  
  // NEW: Player tier for matchmaking
  playerTier: 'beginner' | 'intermediate' | 'experienced';
}

// Default settings for a new game
const defaultGameSettings = {
  timeControl: "5+3",
  rated: true,
  color: "random" as "random" | "white" | "black",
};

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * FIX: Converted to hoisted function declaration to avoid Temporal Dead Zone (TDZ) error
 */
function getPlayerTier(gameCount: number): 'beginner' | 'intermediate' | 'experienced' {
  if (gameCount < 10) return 'beginner';
  if (gameCount < 30) return 'intermediate';
  return 'experienced';
};

/**
 * FIX: Converted to hoisted function declaration to avoid Temporal Dead Zone (TDZ) error
 */
async function getUserGameCount(userId: string): Promise<number> {
  try {
    // Query finished games where user participated
    const gamesQuery = query(
      collection(db, "games"),
      where("status", "==", "finished")
    );
    
    const snapshot = await getDocs(gamesQuery);
    let userGameCount = 0;
    
    snapshot.forEach(doc => {
      const game = doc.data() as Game;
      if (game.white === userId || game.black === userId) {
        userGameCount++;
      }
    });
    
    return userGameCount;
  } catch (error) {
    console.error("Error getting user game count:", error);
    return 0;
  }
};

/**
 * FIX: Converted to hoisted function declaration to avoid Temporal Dead Zone (TDZ) error
 */
async function backfillGameTiers(): Promise<number> {
  try {
    
    const gamesQuery = query(collection(db, "games"));
    const snapshot = await getDocs(gamesQuery);
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.docs.forEach((docSnap) => {
      const game = docSnap.data() as Game;
      
      // Only update games that don't have a playerTier set
      if (!game.playerTier) {
        // For existing games without tier data, use a default based on game status
        let defaultTier: 'beginner' | 'intermediate' | 'experienced' = 'intermediate';
        
        // If the game is finished and has moves, it might be more experienced
        if (game.status === 'finished' && game.moves && game.moves.length > 20) {
          defaultTier = 'experienced';
        }
        
        batch.update(doc(db, "games", docSnap.id), {
          playerTier: defaultTier
        });
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
    } else {
    }
    
    return updatedCount;
  } catch (error) {
    console.error("Error backfilling game tiers:", error);
    throw error;
  }
};

/**
 * FIX: Converted to hoisted function declaration to avoid Temporal Dead Zone (TDZ) error
 */
function ThemedPaper({ children, sx = {}, ...props }: any) {
  return (
    <Paper
      {...props}
      sx={{
        p: 2,
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        color: 'text.primary',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

export default function PlayOnline() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [gameDoc, setGameDoc] = useState<Game | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [boardFen, setBoardFen] = useState(STARTING_FEN);
  const gameRef = useRef(new Chess());
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gameSettings, setGameSettings] = useState(defaultGameSettings);
  const [userColor, setUserColor] = useState<'white' | 'black' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [customSquareStyles, setCustomSquareStyles] = useState({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);
  const [userGameCount, setUserGameCount] = useState<number>(0);
  const [userTier, setUserTier] = useState<'beginner' | 'intermediate' | 'experienced'>('beginner');
  const [backfillStatus, setBackfillStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [backfillMessage, setBackfillMessage] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { addOnlineGame } = useGameDatabase();

  // Get user and their game count
  useEffect(() => {
    if (!auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const gameCount = await getUserGameCount(user.uid);
          setUserGameCount(gameCount);
          setUserTier(getPlayerTier(gameCount));
          
        } catch (error) {
          console.error("Error loading user game count:", error);
          setUserTier('beginner');
        }
      } else {
        setUser(null);
        setUserTier('beginner');
        try {
          await ensureUser();
        } catch (err) {
          console.error("Failed to ensure user:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const parseTimeControl = (timeControl: string): { initial: number; increment: number } => {
    const [minutes, increment] = timeControl.split('+').map(Number);
    return {
      initial: (minutes || 10) * 60,
      increment: increment || 0
    };
  };

  // Game logic effect: listens to Firestore doc
  useEffect(() => {
    if (!gameId) {
      gameRef.current = new Chess();
      setBoardFen(STARTING_FEN);
      setGameDoc(null);
      setGameOver(false);
      return;
    }
    
    const unsub = onSnapshot(doc(db, "games", gameId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Game;
        setGameDoc(data);

        // --- BUG FIX START: Correctly load the game state ---
        let tempGame = new Chess();
        let currentFen = STARTING_FEN;

        if (data.status === 'finished' && data.pgn) {
          // 1. Finished game: Load PGN
          try {
            tempGame.loadPgn(data.pgn);
            currentFen = tempGame.fen();
          } catch (e) {
            console.error("Failed to load PGN:", e);
          }
        } else if (data.moves && data.moves.length > 0) {
          // 2. Active game: Reconstruct from moves history
          // NOTE: We start from STARTING_FEN and apply all moves.
          data.moves.forEach(move => {
            try {
              if (move.length === 4 || move.length === 5) {
                tempGame.move({
                  from: move.slice(0, 2),
                  to: move.slice(2, 4),
                  promotion: move.length === 5 ? move[4] : undefined
                });
              } else {
                tempGame.move(move);
              }
            } catch (e) {
              // This is a common issue if the moves list is out of sync.
              // We stop processing history if an invalid move is encountered.
              console.warn("Failed to load move from history:", move, e);
            }
          });
          currentFen = tempGame.fen();
        } else if (data.fen) {
          // 3. Fallback to FEN
          try {
            tempGame = new Chess(data.fen);
            currentFen = data.fen;
          } catch (e) {
            console.error("Failed to load FEN:", e);
          }
        }
        
        // Load the reconstructed/loaded game state into chess.js reference
        gameRef.current = tempGame;
        setBoardFen(currentFen);
        // --- BUG FIX END ---

        // Set user color
        if (user && data.white === user.uid) {
          setUserColor('white');
        } else if (user && data.black === user.uid) {
          setUserColor('black');
        }

        // Update times
        if (data.whiteTime !== undefined) setWhiteTime(data.whiteTime);
        if (data.blackTime !== undefined) setBlackTime(data.blackTime);

        // Check for game over
        if (data.status === 'active' && gameRef.current.isGameOver()) {
          let termination = "Game Over";
          if (gameRef.current.isCheckmate()) {
            termination = `Checkmate - ${gameRef.current.turn() === 'w' ? 'Black' : 'White'} wins`;
          } else if (gameRef.current.isDraw()) {
            if (gameRef.current.isStalemate()) {
              termination = "Stalemate";
            } else if (gameRef.current.isThreefoldRepetition()) {
              termination = "Threefold Repetition";
            } else if (gameRef.current.isInsufficientMaterial()) {
              termination = "Insufficient Material";
            } else {
              termination = "Draw";
            }
          }
          
          finalizeGameAndSave(gameRef.current, data, termination);
        }

        if (data.status === 'finished') {
          setGameOver(true);
        }

      } else {
        setError("Game not found.");
        setGameId(null);
        setGameDoc(null);
      }
    });

    return () => unsub();
  }, [gameId, user, finalizeGameAndSave]); // Added finalizeGameAndSave to dependencies for safety

  // Timer logic
  useEffect(() => {
    // Only proceed if game is active and not over
    if (!gameDoc || gameDoc.status !== 'active' || gameOver) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Clear old interval before setting a new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      // Use set state function form to ensure we use the latest time values
      if (gameDoc.currentPlayer === 'white') {
        setWhiteTime(prev => Math.max(0, prev - 1));
      } else {
        setBlackTime(prev => Math.max(0, prev - 1));
      }

      // We check for timeout outside the interval or use a ref for whiteTime/blackTime
      // For simplicity and correctness with the existing structure, we re-check on effect re-run.
      // The condition is checked inside the interval using the latest state values in the closure.
    }, 1000);

    // Check for timeout immediately after setting the interval
    if ((gameDoc.currentPlayer === 'white' && whiteTime <= 0) ||
        (gameDoc.currentPlayer === 'black' && blackTime <= 0)) {
      handleTimeout();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameDoc, gameOver, whiteTime, blackTime]); // Dependencies updated

  const handleTimeout = async () => {
    if (!gameDoc || !user) return;

    const gameRefDoc = doc(db, "games", gameDoc.id);
    const winner = gameDoc.currentPlayer === 'white' ? gameDoc.black : gameDoc.white;
    const termination = 'timeout';
    
    // The result value needs to be determined by who won the timeout
    const result = gameDoc.currentPlayer === 'white' ? '0-1' : '1-0';
    
    await updateDoc(gameRefDoc, {
      status: 'finished',
      winner: winner,
      termination: termination,
      result: result
    });

    if (gameDoc) {
      // The Chess object from the ref is passed to finalize the game
      finalizeGameAndSave(gameRef.current, gameDoc, termination);
    }
  };

  // --- Game Finalization Logic ---
  const finalizeGameAndSave = useCallback(async (
    currentGame: Chess, 
    gameData: Game, 
    terminationReason: string
  ) => {
    if (!user || !gameData.id || gameData.status === 'finished') return;

    const gameForPgn = new Chess();
    
    if (gameData.moves && gameData.moves.length > 0) {
      gameData.moves.forEach(move => {
        try {
          // This logic is correct for PGN reconstruction from STARTING_FEN
          if (move.length === 4 || move.length === 5) {
            gameForPgn.move({
              from: move.slice(0, 2),
              to: move.slice(2, 4),
              promotion: move.length === 5 ? move[4] : undefined
            });
          } else {
            gameForPgn.move(move);
          }
        } catch (e) {
          console.warn("Invalid move in history (PGN generation):", move, e);
        }
      });
    }

    // Assuming user is either white or black in the game, but not null if this function runs
    const whitePlayerName = gameData.white === user.uid ? (user.displayName || `User_${user.uid.slice(-6)}`) : "Opponent";
    const blackPlayerName = gameData.black && gameData.black === user.uid ? (user.displayName || `User_${user.uid.slice(-6)}`) : "Opponent";
    
    const gameDate = gameData.createdAt?.toDate() || new Date();
    
    const gameWithHeaders = setGameHeaders(gameForPgn, {
      white: { name: whitePlayerName },
      black: { name: blackPlayerName },
      site: "Tembo Chess Online",
      event: gameData.rated ? "Rated Online Game" : "Casual Online Game"
    });

    gameWithHeaders.setHeader("TimeControl", gameData.timeControl);
    gameWithHeaders.setHeader("Round", "1");
    
    let finalResult = getGameResult(gameWithHeaders);

    if (terminationReason.includes("White wins") || terminationReason.includes("Checkmate - White wins") || terminationReason.includes("0-1")) {
      finalResult = "1-0";
    } else if (terminationReason.includes("Black wins") || terminationReason.includes("Checkmate - Black wins") || terminationReason.includes("1-0")) {
      finalResult = "0-1";
    } else if (terminationReason === 'timeout') {
      // Check who timed out based on the current player when the game ended
      finalResult = gameData.currentPlayer === 'white' ? '0-1' : '1-0';
    } else if (terminationReason === 'surrender') {
      // If user surrendered, they lost.
      finalResult = user.uid === gameData.white ? '0-1' : '1-0';
    }

    gameWithHeaders.setHeader("Result", finalResult);
    gameWithHeaders.setHeader("Termination", terminationReason);

    const fullPgnString = gameWithHeaders.pgn({ newline: '\n', maxWidth: 80 });
    

    await addOnlineGame(fullPgnString, gameData.id, 'finished', terminationReason);
    
    const gameRef = doc(db, "games", gameData.id);
    await updateDoc(gameRef, {
      status: 'finished',
      pgn: fullPgnString,
      termination: terminationReason,
      result: finalResult,
      winner: finalResult === '1-0' ? gameData.white : 
              finalResult === '0-1' ? gameData.black : null
    });

    // Update user game count locally
    setUserGameCount(prev => {
      const newCount = prev + 1;
      setUserTier(getPlayerTier(newCount));
      return newCount;
    });

    setGameDoc(prev => prev ? { 
      ...prev, 
      status: 'finished', 
      pgn: fullPgnString,
      termination: terminationReason,
      result: finalResult,
      winner: finalResult === '1-0' ? gameData.white : 
              finalResult === '0-1' ? gameData.black : null
    } : null);
    setGameOver(true);

  }, [user, addOnlineGame]);

  // --- UPDATED: Game Creation / Search with Tier-Based Matchmaking ---
  const findOrCreateGame = async () => {
    if (!user) {
      setError("You must be logged in to play.");
      return;
    }
    setSearching(true);
    setError(null);

    // Use tier-based matching
    const q = query(
      collection(db, "games"),
      where("status", "==", "waiting"),
      where("rated", "==", gameSettings.rated),
      where("timeControl", "==", gameSettings.timeControl),
      where("playerTier", "==", userTier)
    );

    try {
      const querySnapshot = await getDocs(q);
      let foundGame = false;

      // Try to join an existing game
      for (const docSnap of querySnapshot.docs) {
        const game = docSnap.data() as Game;
        
        // Ensure user doesn't join their own game
        if (game.white !== user.uid && game.black !== user.uid) { // Simplified check for joining
          const gameDocRef = doc(db, "games", docSnap.id);
          const timeControl = parseTimeControl(game.timeControl);
          
          let whitePlayerId = game.white;
          let blackPlayerId = game.black;

          // Determine which side the joining user takes
          if (!whitePlayerId) {
            whitePlayerId = user.uid;
          } else if (!blackPlayerId) {
            blackPlayerId = user.uid;
          } else {
              // Should not happen if status is 'waiting', but acts as safety break
              continue; 
          }

          await updateDoc(gameDocRef, {
            white: whitePlayerId,
            black: blackPlayerId,
            status: "active",
            startedAt: serverTimestamp(),
            currentPlayer: "white",
            lastMoveTime: serverTimestamp(),
            whiteTime: timeControl.initial,
            blackTime: timeControl.initial,
          });
          setGameId(docSnap.id);
          foundGame = true;
          break;
        }
      }

      // Create a new game if none found
      if (!foundGame) {
        const timeControl = parseTimeControl(gameSettings.timeControl);
        let whitePlayerId: string | null = null;
        let blackPlayerId: string | null = null;
        let creatorColor = gameSettings.color;

        if (creatorColor === 'random') {
          creatorColor = Math.random() < 0.5 ? 'white' : 'black';
        }
        
        if (creatorColor === 'white') {
            whitePlayerId = user.uid;
        } else {
            blackPlayerId = user.uid;
        }

        // Include playerTier in new game creation
        const newGameDoc = await addDoc(collection(db, "games"), {
          white: whitePlayerId,
          black: blackPlayerId,
          status: "waiting",
          createdAt: serverTimestamp(),
          currentPlayer: "white",
          fen: STARTING_FEN,
          moves: [],
          timeControl: gameSettings.timeControl,
          rated: gameSettings.rated,
          whiteTime: timeControl.initial,
          blackTime: timeControl.initial,
          lastMoveTime: serverTimestamp(),
          playerTier: userTier,
        });
        setGameId(newGameDoc.id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to find or create game.");
    } finally {
      setSearching(false);
    }
  };

  // --- OnDrop Move Logic ---
  const onDrop = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (!gameDoc || gameDoc.status !== 'active' || !user || !userColor) return false;
    
    // Check if it's the user's turn
    if (userColor !== gameDoc.currentPlayer) {
      setError("It's not your turn!");
      return false;
    }

    const game = new Chess(gameRef.current.fen());
    let move: Move | null = null;
    
    // Check for promotion and pass the promotion piece if necessary. 
    // Assuming 'q' (queen) for simplicity on drag-and-drop promotion.
    const isPromotion = 
        (piece.toLowerCase() === 'p') && 
        ((userColor === 'white' && targetSquare[1] === '8') || 
         (userColor === 'black' && targetSquare[1] === '1'));
         
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? 'q' : undefined, // Only attempt promotion if it is a pawn move to the last rank
      });
    } catch (e) {
      setError("Invalid move!");
      return false;
    }

    if (move === null) {
      setError("Invalid move!");
      return false;
    }
    
    // Update time with increment
    const timeControl = parseTimeControl(gameDoc.timeControl);
    // Use the latest time from state for calculation
    const currentTime = gameDoc.currentPlayer === 'white' ? whiteTime : blackTime;
    const newTime = Math.max(0, currentTime - 1 + timeControl.increment); // Subtract 1 second for the clock tick

    // Move is legal, update Firestore
    const gameDocRef = doc(db, "games", gameDoc.id);
    updateDoc(gameDocRef, {
      fen: game.fen(),
      moves: arrayUnion(`${sourceSquare}${targetSquare}${move.promotion || ''}`),
      currentPlayer: game.turn() === 'w' ? 'white' : 'black',
      lastMoveTime: serverTimestamp(),
      [`${gameDoc.currentPlayer}Time`]: newTime,
    }).catch(err => {
      console.error("Failed to update move:", err);
      setError("Failed to make move. Please try again.");
    });

    setBoardFen(game.fen());
    gameRef.current = game;
    setError(null);

    // Check for game over *after* the move
    if (game.isGameOver()) {
      let termination = "Game Over";
      if (game.isCheckmate()) {
        termination = `Checkmate - ${game.turn() === 'w' ? 'Black' : 'White'} wins`;
      } else if (game.isDraw()) {
        termination = "Draw";
        if (game.isStalemate()) termination = "Stalemate";
        else if (game.isThreefoldRepetition()) termination = "Threefold Repetition";
        else if (game.isInsufficientMaterial()) termination = "Insufficient Material";
      }
      
      // Need to use the *updated* gameDoc from state for finalization, 
      // but since we are in onDrop, we use the local variable `gameDoc` and the local `game` Chess object.
      finalizeGameAndSave(game, gameDoc, termination); 
    }

    return true;
  };

  const onSquareClick = (square: string) => {
    if (!gameDoc || gameDoc.status !== 'active' || gameOver || userColor !== gameDoc.currentPlayer) {
      return;
    }

    const game = new Chess(gameRef.current.fen());

    if (selectedSquare && selectedSquare !== square) {
        // Attempt to move if a piece is already selected
        const pieceToMove = game.get(selectedSquare);
        if (pieceToMove && pieceToMove.color === (userColor === 'white' ? 'w' : 'b')) {
            const success = onDrop(selectedSquare, square, pieceToMove.type);
            
            // Clear styles if move was successful or unsuccessful
            setSelectedSquare(null);
            setCustomSquareStyles({});
            return;
        }
    }

    // New selection logic (or re-selection of the same square)
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setCustomSquareStyles({});
      return;
    }

    const piece = game.get(square);
    if (!piece) {
      setSelectedSquare(null);
      setCustomSquareStyles({});
      return;
    }

    const pieceColor = piece.color === 'w' ? 'white' : 'black';
    if (pieceColor !== userColor) {
      setSelectedSquare(null);
      setCustomSquareStyles({});
      return;
    }

    setSelectedSquare(square);

    const moves = game.moves({ square, verbose: true });
    const newSquareStyles: any = {};

    newSquareStyles[square] = {
      backgroundColor: 'rgba(255, 255, 0, 0.4)',
    };

    moves.forEach((move) => {
      // Adjusted styling for better visibility and distinction
      const style = {
        background: 'radial-gradient(circle, rgba(0,0,0,0.1) 25%, transparent 26%)',
        borderRadius: '50%',
      };

      if (move.flags.includes('c')) {
        // Capture move
        style.background = 'radial-gradient(circle, rgba(255, 0, 0, 0.5) 40%, transparent 45%)';
        newSquareStyles[move.to] = { ...style, boxShadow: 'inset 0 0 0 4px rgba(255, 0, 0, 0.8)' };
      } else {
        // Simple move
        style.background = 'radial-gradient(circle, rgba(0, 200, 0, 0.5) 30%, transparent 35%)';
        newSquareStyles[move.to] = style;
      }
    });

    setCustomSquareStyles(newSquareStyles);
  };

  const surrender = async () => {
    if (!gameDoc || !user || gameDoc.status !== 'active') return;

    const gameRef = doc(db, "games", gameDoc.id);
    const winner = user.uid === gameDoc.white ? gameDoc.black : gameDoc.white;
    const termination = 'surrender';
    
    // We don't update to finished here, we let finalizeGameAndSave handle it 
    // after the local state has been updated to reflect the surrender.
    
    // Perform update that triggers the finalization
    await updateDoc(gameRef, {
      status: 'finished', // Pre-set status to prevent other moves
      termination: termination,
      result: user.uid === gameDoc.white ? '0-1' : '1-0', // Set temporary result
    });

    // Finalize the game locally and save PGN
    finalizeGameAndSave(gameRef.current, gameDoc, termination);
  };

  const newGame = () => {
    setGameId(null);
    setGameDoc(null);
    setGameOver(false);
    setUserColor(null);
    setBoardFen(STARTING_FEN);
    setError(null);
    setSelectedSquare(null);
    setCustomSquareStyles({});
    // Reset times to their initial control value (e.g., 5+3 is 300)
    const { initial } = parseTimeControl(gameSettings.timeControl);
    setWhiteTime(initial); 
    setBlackTime(initial);
    gameRef.current = new Chess();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGameStatus = () => {
    if (!gameDoc) return null;

    if (gameDoc.status === 'waiting') {
      return "Waiting for opponent...";
    }

    if (gameDoc.status === 'finished') {
      if (gameDoc.winner === user?.uid) {
        return "You won! 🎉";
      } else if (gameDoc.winner) {
        return "You lost. Better luck next time!";
      } else {
        return "Game ended in a draw.";
      }
    }

    if (gameDoc.currentPlayer === userColor) {
      return "Your turn";
    } else {
      return "Opponent's turn";
    }
  };

  // NEW: Backfill tiers function for admin use
  const handleBackfillTiers = async () => {
    setBackfillStatus('loading');
    setBackfillMessage('Backfilling game tiers...');
    
    try {
      const updatedCount = await backfillGameTiers();
      setBackfillStatus('success');
      setBackfillMessage(`Successfully backfilled ${updatedCount} games with tiers`);
    } catch (error) {
      setBackfillStatus('error');
      setBackfillMessage('Error backfilling game tiers');
      console.error('Backfill error:', error);
    }
  };

  // UI helper functions
  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'beginner': return 'Beginner';
      case 'intermediate': return 'Intermediate';
      case 'experienced': return 'Experienced';
      default: return tier;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'beginner': return 'primary';
      case 'intermediate': return 'secondary';
      case 'experienced': return 'success';
      default: return 'default';
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case 'beginner': return 'New players learning the game';
      case 'intermediate': return 'Players with some experience';
      case 'experienced': return 'Seasoned chess players';
      default: return '';
    }
  };

  const getTierRange = (tier: string) => {
    switch (tier) {
      case 'beginner': return '0-10 games';
      case 'intermediate': return '11-30 games';
      case 'experienced': return '31+ games';
      default: return '';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="h4" gutterBottom>Play Online</Typography>
      
      {/* NEW: Display user tier and game count */}
      {user && (
        <ThemedPaper sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip 
            label={`Tier: ${getTierDisplayName(userTier)}`}
            color={getTierColor(userTier) as any}
            variant="outlined"
          />
          <Typography variant="body2" color="text.secondary">
            Games Played: {userGameCount}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getTierRange(userTier)}
          </Typography>
          
          {/* Admin backfill button (optional - remove in production) */}
          {user.email?.includes('admin') && (
            <Button 
              size="small" 
              variant="outlined" 
              onClick={handleBackfillTiers}
              disabled={backfillStatus === 'loading'}
            >
              {backfillStatus === 'loading' ? <CircularProgress size={16} /> : 'Backfill Tiers'}
            </Button>
          )}
        </ThemedPaper>
      )}

      {/* Backfill status snackbar */}
      <Snackbar
        open={backfillStatus !== 'idle'}
        autoHideDuration={6000}
        onClose={() => setBackfillStatus('idle')}
        message={backfillMessage}
      />

      {error && <Alert severity="error" sx={{ mb: 2, width: '100%', maxWidth: 500 }}>{error}</Alert>}
      
      {!gameDoc && (
        <ThemedPaper sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 400 }}>
          <Typography variant="h6">Find a Game</Typography>
          
          {/* FIXED: Theme-aware matching tier info */}
          <ThemedPaper sx={{ bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" gutterBottom>
              🎯 Matching with: <strong>{getTierDisplayName(userTier)}</strong> players
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {getTierDescription(userTier)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tier range: {getTierRange(userTier)}
            </Typography>
          </ThemedPaper>
          
          <Button variant="outlined" onClick={() => setShowSettings(true)}>
            Game Settings ({gameSettings.timeControl}, {gameSettings.rated ? "Rated" : "Casual"})
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={findOrCreateGame} 
            disabled={searching}
          >
            {searching ? <CircularProgress size={24} /> : "Find Match"}
          </Button>
          {searching && (
            <Typography variant="body2" color="text.secondary" align="center">
              Searching for {getTierDisplayName(userTier).toLowerCase()} players...
            </Typography>
          )}
        </ThemedPaper>
      )}

      {gameDoc && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%', maxWidth: 600 }}>
          <ThemedPaper sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography variant="h6">
                {getGameStatus()}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip 
                  label={`You: ${userColor}`} 
                  color={userColor === 'white' ? 'default' : 'primary'}
                  variant="outlined"
                />
                <Chip 
                  label={`Turn: ${gameDoc.currentPlayer}`} 
                  color={gameDoc.currentPlayer === userColor ? 'success' : 'default'}
                />
                <Chip 
                  label={gameDoc.timeControl} 
                  size="small"
                  variant="outlined"
                />
                {/* NEW: Show game tier */}
                <Chip 
                  label={`${getTierDisplayName(gameDoc.playerTier)} Tier`}
                  color={getTierColor(gameDoc.playerTier) as any}
                  size="small"
                  variant="outlined"
                />
              </Box>

              {gameDoc.status === 'active' && (
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  onClick={surrender}
                >
                  Surrender
                </Button>
              )}
            </Box>

            {gameDoc.status === 'active' && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Paper 
                  sx={{ 
                    p: 1, 
                    minWidth: 80,
                    backgroundColor: gameDoc.currentPlayer === 'white' ? 'primary.main' : 'grey.100',
                    color: gameDoc.currentPlayer === 'white' ? 'white' : 'text.primary'
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    {formatTime(whiteTime)}
                  </Typography>
                  <Typography variant="caption">White</Typography>
                </Paper>
                
                <Paper 
                  sx={{ 
                    p: 1, 
                    minWidth: 80,
                    backgroundColor: gameDoc.currentPlayer === 'black' ? 'primary.main' : 'grey.100',
                    color: gameDoc.currentPlayer === 'black' ? 'white' : 'text.primary'
                  }}
                >
                  <Typography variant="h6" fontWeight="bold">
                    {formatTime(blackTime)}
                  </Typography>
                  <Typography variant="caption">Black</Typography>
                </Paper>
              </Box>
            )}
          </ThemedPaper>

          <Chessboard
            position={boardFen}
            onPieceDrop={onDrop}
            onSquareClick={onSquareClick}
            boardOrientation={userColor || 'white'}
            boardWidth={Math.min(400, window.innerWidth - 40)}
            customSquareStyles={customSquareStyles}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            }}
            arePiecesDraggable={gameDoc.status === 'active' && !gameOver && gameDoc.currentPlayer === userColor}
          />

          {gameOver && (
            <ThemedPaper sx={{ width: '100%' }}>
              <Typography variant="h6" gutterBottom color="primary">
                Game Over!
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {gameDoc.termination && `Termination: ${gameDoc.termination}`}
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                onClick={newGame}
                sx={{ mr: 1 }}
              >
                Play Again
              </Button>
              <Button 
                variant="outlined" 
                onClick={newGame}
              >
                Back to Lobby
              </Button>
            </ThemedPaper>
          )}

          {gameDoc.moves && gameDoc.moves.length > 0 && (
            <ThemedPaper sx={{ width: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Moves History
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1, 
                justifyContent: 'center',
                maxHeight: 120,
                overflowY: 'auto'
              }}>
                {gameDoc.moves.map((move, index) => (
                  <Chip 
                    key={`${gameDoc.id}-move-${index}-${move}`}
                    label={`${Math.floor(index / 2) + 1}.${index % 2 === 0 ? '' : '..'} ${move}`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            </ThemedPaper>
          )}
        </Box>
      )}

      {/* Game Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Game Settings</DialogTitle>
        <DialogContent sx={{ minWidth: 300, display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth>
            <InputLabel>Time Control</InputLabel>
            <Select
              value={gameSettings.timeControl}
              label="Time Control"
              onChange={(e: SelectChangeEvent) => setGameSettings(prev => ({ ...prev, timeControl: e.target.value }))}
            >
              <MenuItem value="1+0">1 minute</MenuItem>
              <MenuItem value="3+0">3 minutes</MenuItem>
              <MenuItem value="5+3">5 minutes + 3s</MenuItem>
              <MenuItem value="10+0">10 minutes</MenuItem>
              <MenuItem value="15+10">15 minutes + 10s</MenuItem>
              <MenuItem value="30+0">30 minutes</MenuItem>
            </Select>
          </FormControl>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={gameSettings.rated}
                  onChange={(e) => setGameSettings(prev => ({ ...prev, rated: e.target.checked }))}
                />
              }
              label="Rated Game"
            />
          </FormGroup>

          <FormControl fullWidth>
            <InputLabel>Your Color</InputLabel>
            <Select
              value={gameSettings.color}
              label="Your Color"
              onChange={(e: SelectChangeEvent) => setGameSettings(prev => ({ ...prev, color: e.target.value as any }))}
            >
              <MenuItem value="random">Random</MenuItem>
              <MenuItem value="white">White</MenuItem>
              <MenuItem value="black">Black</MenuItem>
            </Select>
          </FormControl>

          {/* NEW: Tier information in settings */}
          <ThemedPaper sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Current Matchmaking Tier: <strong>{getTierDisplayName(userTier)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {getTierDescription(userTier)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your games: {userGameCount} | Range: {getTierRange(userTier)}
            </Typography>
          </ThemedPaper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => setShowSettings(false)}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
