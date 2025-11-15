// src/components/Train/TrainBoard.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Square } from "chess.js";
import { Box, Snackbar, Alert, Button, Typography, useTheme, useMediaQuery } from "@mui/material";

interface TrainBoardProps {
  fen: string;
  solution: string[];
  onSolve: (correct: boolean) => void;
  disabled?: boolean;
  userSide?: 'white' | 'black';
  autoNextDelay?: number;
}

function validateFEN(fen: string): { isValid: boolean; sanitizedFEN?: string } {
  try {
    const chess = new Chess();
    chess.load(fen);
    return { isValid: true, sanitizedFEN: fen };
  } catch (error) {
    try {
      const parts = fen.split(' ');
      const position = parts[0];
      
      const whiteKings = (position.match(/K/g) || []).length;
      const blackKings = (position.match(/k/g) || []).length;
      
      if (whiteKings === 0 || blackKings === 0) {
        return { 
          isValid: false, 
          sanitizedFEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' 
        };
      }
      
      return { isValid: false };
    } catch (fixError) {
      return { isValid: false };
    }
  }
}

export default function TrainBoard({
  fen,
  solution,
  onSolve,
  disabled = false,
  userSide = 'white',
  autoNextDelay = 2000,
}: TrainBoardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [game, setGame] = useState<Chess>(new Chess());
  const [position, setPosition] = useState(fen);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, any>>({});
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showingSolution, setShowingSolution] = useState(false);
  const [boardDisabled, setBoardDisabled] = useState(false);
  const [shake, setShake] = useState(false);
  const [autoNextTimer, setAutoNextTimer] = useState<NodeJS.Timeout | null>(null);
  const [boardKey, setBoardKey] = useState(0);

  const gameInstance = useRef<Chess>(new Chess());
  const isMakingOpponentMove = useRef(false);
  const [currentPuzzle, setCurrentPuzzle] = useState<{ userSide: 'white' | 'black' }>({ userSide });

  const getBoardSize = () => {
    if (isMobile) return 320;
    if (isTablet) return 400;
    return 450;
  };

  useEffect(() => {
    return () => {
      if (autoNextTimer) {
        clearTimeout(autoNextTimer);
      }
    };
  }, [autoNextTimer]);

  const handlePuzzleComplete = useCallback(() => {
    setBoardDisabled(true);
    
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
    }
    
    setStatus({ type: "success", message: "🎉 Puzzle solved! Next puzzle in 2 seconds..." });
    
    const timer = setTimeout(() => {
      onSolve(true);
      setAutoNextTimer(null);
    }, autoNextDelay);
    
    setAutoNextTimer(timer);
  }, [onSolve, autoNextDelay, autoNextTimer]);

  const isUserMove = useCallback(() => {
    if (!currentPuzzle || moveIndex >= solution.length) return false;
    
    const currentGame = gameInstance.current;
    const currentTurn = currentGame.turn();
    const userColor = currentPuzzle.userSide === 'white' ? 'w' : 'b';
    
    const isUserTurn = currentTurn === userColor;
    
    return isUserTurn;
  }, [currentPuzzle, moveIndex, solution.length]);

  const isOpponentMove = useCallback(() => {
    if (!currentPuzzle || moveIndex >= solution.length) return false;
    
    const currentGame = gameInstance.current;
    const currentTurn = currentGame.turn();
    const opponentColor = currentPuzzle.userSide === 'white' ? 'b' : 'w';
    
    const isOpponentTurn = currentTurn === opponentColor;
    
    return isOpponentTurn;
  }, [currentPuzzle, moveIndex, solution.length]);

  const getMoveSquares = useCallback(
    (square: Square) => {
      if (!isUserMove() || boardDisabled || isMakingOpponentMove.current || !currentPuzzle) {
        return {};
      }

      const currentGame = gameInstance.current;
      const piece = currentGame.get(square);
      
      if (!piece || piece.color !== (currentPuzzle.userSide === 'white' ? 'w' : 'b')) {
        return {};
      }

      const moves = currentGame.moves({ square, verbose: true });
      const highlights: Record<string, any> = {};
      moves.forEach((m) => {
        highlights[m.to] = {
          background: "radial-gradient(circle, rgba(0,255,0,0.4) 40%, transparent 45%)",
          borderRadius: "50%",
        };
      });
      
      highlights[square] = {
        background: "rgba(255, 255, 0, 0.4)",
      };
      
      return highlights;
    },
    [isUserMove, boardDisabled, currentPuzzle]
  );

  const highlightLastMove = useCallback((from: string, to: string, color: string) => {
    setHighlightSquares({
      [from]: { backgroundColor: color },
      [to]: { backgroundColor: color },
    });
  }, []);

  const uciToMove = useCallback((uci: string) => {
    if (!uci || uci.length < 4) return null;
    
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] as 'q' | 'r' | 'b' | 'n' : undefined;

    return {
      from,
      to,
      promotion: promotion || 'q'
    };
  }, []);

  const makeOpponentMove = useCallback(async () => {
    if (isMakingOpponentMove.current || moveIndex >= solution.length) return;
    
    if (!isOpponentMove()) {
      return;
    }
    
    isMakingOpponentMove.current = true;
    setBoardDisabled(true);
    
    try {
      const opponentMoveUCI = solution[moveIndex];
      const opponentMove = uciToMove(opponentMoveUCI);
      
      if (opponentMove) {
        const updatedGame = new Chess(gameInstance.current.fen());
        const opponentResult = updatedGame.move(opponentMove);
        
        if (opponentResult) {
          await new Promise(resolve => setTimeout(resolve, 600));
          
          gameInstance.current = updatedGame;
          setGame(updatedGame);
          setPosition(updatedGame.fen());
          highlightLastMove(opponentResult.from, opponentResult.to, "rgba(0, 136, 255, 0.41)");
          
          const nextIndex = moveIndex + 1;
          setMoveIndex(nextIndex);
        }
      }
    } catch (error) {
      // Silently handle error
    } finally {
      setBoardDisabled(false);
      isMakingOpponentMove.current = false;
    }
  }, [moveIndex, solution, uciToMove, highlightLastMove, isOpponentMove, currentPuzzle]);

  useEffect(() => {
    if (isOpponentMove() && 
        moveIndex < solution.length && 
        !isMakingOpponentMove.current && 
        !boardDisabled && 
        !showingSolution) {
      makeOpponentMove();
    }
  }, [moveIndex, isUserMove, isOpponentMove, solution, boardDisabled, showingSolution, makeOpponentMove]);

  useEffect(() => {
    try {
      const validation = validateFEN(fen);
      if (!validation.isValid) {
        setStatus({ type: "error", message: "Invalid puzzle position. Loading default..." });
        
        const defaultFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const newGame = new Chess(defaultFEN);
        setGame(newGame);
        gameInstance.current = newGame;
        setPosition(defaultFEN);
        setBoardKey(prev => prev + 1);
        return;
      }

      const validFEN = validation.sanitizedFEN || fen;
      const newGame = new Chess(validFEN);
      setGame(newGame);
      gameInstance.current = newGame;
      setPosition(validFEN);
      setSelectedSquare(null);
      setHighlightSquares({});
      setMoveIndex(0);
      setShowingSolution(false);
      setBoardDisabled(false);
      setStatus(null);
      isMakingOpponentMove.current = false;
      setCurrentPuzzle({ userSide });
      setBoardKey(prev => prev + 1);
      
      if (autoNextTimer) {
        clearTimeout(autoNextTimer);
        setAutoNextTimer(null);
      }
      
      if (isOpponentMove() && solution.length > 0) {
        setTimeout(() => {
          makeOpponentMove();
        }, 1000);
      }
      
    } catch (err) {
      setStatus({ type: "error", message: "Failed to load puzzle board" });
    }
  }, [fen, userSide]);

  const onSquareClick = useCallback(
    (square: Square) => {
      if (disabled || boardDisabled || showingSolution || isMakingOpponentMove.current) {
        return;
      }

      if (!isUserMove()) {
        setStatus({ type: "info", message: "Wait for your turn!" });
        return;
      }

      const currentGame = gameInstance.current;

      if (!selectedSquare) {
        const piece = currentGame.get(square);
        
        const canSelect = piece && 
                         piece.color === (currentPuzzle.userSide === 'white' ? 'w' : 'b') && 
                         isUserMove() &&
                         !boardDisabled &&
                         !isMakingOpponentMove.current &&
                         !showingSolution;
        
        if (canSelect) {
          setSelectedSquare(square);
          setHighlightSquares(getMoveSquares(square));
        } else if (piece && piece.color !== (currentPuzzle.userSide === 'white' ? 'w' : 'b')) {
          setStatus({ type: "error", message: "That's your opponent's piece!" });
        } else {
          setSelectedSquare(null);
          setHighlightSquares({});
        }
        return;
      }

      try {
        const move = { from: selectedSquare, to: square, promotion: "q" as const };
        const gameCopy = new Chess(currentGame.fen());
        const result = gameCopy.move(move);

        if (!result) {
          setSelectedSquare(null);
          setHighlightSquares({});
          return;
        }

        const playedMoveUCI = result.from + result.to + (result.promotion || "");
        const expectedMoveUCI = solution[moveIndex];

        if (playedMoveUCI === expectedMoveUCI) {
          gameInstance.current = gameCopy;
          setGame(gameCopy);
          setPosition(gameCopy.fen());
          setSelectedSquare(null);
          setHighlightSquares({});
          highlightLastMove(result.from, result.to, "rgba(155, 199, 0, 0.6)");
          
          const nextIndex = moveIndex + 1;
          setMoveIndex(nextIndex);
          setStatus({ type: "success", message: "✔ Correct move!" });

          const userMadeFinalMove = nextIndex >= solution.length;

          if (userMadeFinalMove) {
            handlePuzzleComplete();
          }
        } else {
          setShake(true);
          setStatus({ type: "error", message: "❌ Incorrect move!" });
          highlightLastMove(result.from, result.to, "rgba(255, 0, 0, 0.6)");

          setTimeout(() => {
            setShake(false);
            setHighlightSquares({});
            setSelectedSquare(null);
          }, 700);
        }
      } catch (error) {
        setSelectedSquare(null);
        setHighlightSquares({});
      }
    },
    [selectedSquare, disabled, boardDisabled, showingSolution, getMoveSquares, highlightLastMove, solution, moveIndex, isUserMove, currentPuzzle, handlePuzzleComplete]
  );

  const showHint = useCallback(() => {
    if (boardDisabled || showingSolution || moveIndex >= solution.length || isMakingOpponentMove.current) return;
    
    if (!isUserMove()) {
      setStatus({ type: "info", message: "Wait for your turn..." });
      return;
    }
    
    const hintMoveUCI = solution[moveIndex];
    const hintMove = uciToMove(hintMoveUCI);
    
    if (hintMove) {
      setHighlightSquares({
        [hintMove.from]: { backgroundColor: "rgba(0, 136, 255, 0.55)" },
        [hintMove.to]: { backgroundColor: "rgba(0, 136, 255, 0.55)" },
      });

      setStatus({ type: "info", message: "💡 Hint shown!" });

      setTimeout(() => {
        setHighlightSquares({});
      }, 1500);
    }
  }, [solution, moveIndex, showingSolution, boardDisabled, uciToMove, isUserMove]);

  const playSolution = async () => {
    if (showingSolution || boardDisabled) return;
    
    setShowingSolution(true);
    setBoardDisabled(true);
    setHighlightSquares({});
    
    const replayGame = new Chess(fen);
    gameInstance.current = replayGame;
    setGame(replayGame);
    setPosition(replayGame.fen());
    setMoveIndex(0);

    for (let i = 0; i < solution.length; i++) {
      try {
        const moveUCI = solution[i];
        const move = uciToMove(moveUCI);
        
        if (move) {
          const moveResult = replayGame.move(move);
          if (moveResult) {
            gameInstance.current = new Chess(replayGame.fen());
            setGame(new Chess(replayGame.fen()));
            setPosition(replayGame.fen());
            
            const isUserMoveInSequence = currentPuzzle.userSide === 'white' ? 
              moveResult.color === 'w' : 
              moveResult.color === 'b';
            const moveColor = isUserMoveInSequence ? "rgba(155, 199, 0, 0.6)" : "rgba(0, 136, 255, 0.6)";
            highlightLastMove(moveResult.from, moveResult.to, moveColor);
            
            setMoveIndex(i + 1);
            
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      } catch (error) {
        break;
      }
    }

    setStatus({ type: "info", message: "✅ Solution completed." });
    setShowingSolution(false);
    setBoardDisabled(false);
    
    handlePuzzleComplete();
  };

  const handleManualNext = () => {
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
      setAutoNextTimer(null);
    }
    onSolve(true);
  };

  const boardOrientation = currentPuzzle.userSide;
  const boardSize = getBoardSize();

  return (
    <Box
      textAlign="center"
      sx={{
        animation: shake ? "shake 0.5s" : "none",
        "@keyframes shake": {
          "0%,100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px)" },
          "75%": { transform: "translateX(5px)" },
        },
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Box sx={{ 
        mb: 1, 
        p: 1, 
        backgroundColor: '#f0f0f0', 
        borderRadius: 1,
        width: "100%",
        maxWidth: boardSize
      }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
          Move: {moveIndex + 1}/{solution.length} | 
          Current turn: {game?.turn() === 'w' ? 'White' : 'Black'}
        </Typography>
        {autoNextTimer && (
          <Typography variant="caption" sx={{ display: 'block', color: 'purple', fontStyle: 'italic' }}>
            ⏰ Auto-next
          </Typography>
        )}
        {isMakingOpponentMove.current && (
          <Typography variant="caption" sx={{ display: 'block', color: 'blue', fontStyle: 'italic' }}>
            Opponent is thinking...
          </Typography>
        )}
      </Box>

      <Chessboard
        key={boardKey}
        id="train-board"
        position={position}
        arePiecesDraggable={false}
        onSquareClick={onSquareClick}
        boardWidth={boardSize}
        customSquareStyles={highlightSquares}
        customBoardStyle={{
          borderRadius: "8px",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.25)",
        }}
        boardOrientation={boardOrientation}
        animationDuration={300}
      />

      <Box mt={2} display="flex" justifyContent="center" gap={2} flexWrap="wrap">
        <Button
          variant="outlined"
          color="info"
          onClick={showHint}
          disabled={disabled || showingSolution || boardDisabled || moveIndex >= solution.length || !isUserMove() || isMakingOpponentMove.current || !!autoNextTimer}
          size={isMobile ? "small" : "medium"}
        >
          💡 Hint
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={playSolution}
          disabled={showingSolution || disabled || boardDisabled || isMakingOpponentMove.current || !!autoNextTimer}
          size={isMobile ? "small" : "medium"}
        >
          {showingSolution ? "Showing..." : "Show Solution"}
        </Button>
        {autoNextTimer && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleManualNext}
            size={isMobile ? "small" : "medium"}
          >
            Next Now
          </Button>
        )}
      </Box>

      <Snackbar
        open={!!status}
        autoHideDuration={autoNextTimer ? 1900 : 3000}
        onClose={() => setStatus(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {status && (
          <Alert
            onClose={() => setStatus(null)}
            severity={status.type}
            sx={{ width: "100%" }}
          >
            {status.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}