// src/components/Openings/PracticeMode.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Alert,
  LinearProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, updateOpeningProgressAfterPractice } from "../../lib/firebaseClient";

const Chessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
  ssr: false
});

interface PracticeModeProps {
  opening: any;
  variation: any;
  onComplete?: (score: number, variation: any, timeSpent: number, completed: boolean) => void;
  onExit?: () => void;
}

interface PracticeSession {
  currentMoveIndex: number;
  correctMoves: number;
  totalMoves: number;
  mistakes: number;
  isComplete: boolean;
  startTime: Date;
  timeSpent: number;
}

export default function PracticeMode({ opening, variation, onComplete, onExit }: PracticeModeProps) {
  const [user] = useAuthState(auth);
  const [game, setGame] = useState(new Chess());
  const [position, setPosition] = useState("start");
  const [expectedMoves, setExpectedMoves] = useState<string[]>([]);
  const [session, setSession] = useState<PracticeSession>({
    currentMoveIndex: 0,
    correctMoves: 0,
    totalMoves: 0,
    mistakes: 0,
    isComplete: false,
    startTime: new Date(),
    timeSpent: 0
  });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    startNewPractice();
  }, [variation]);

  const parseMoves = useCallback((movesString: string): string[] => {
    if (!movesString) return [];
    return movesString
      .replace(/\d+\./g, '')
      .split(' ')
      .filter(move => move.trim() && move !== '...');
  }, []);

  const startNewPractice = () => {
    const newGame = new Chess();
    const moves = parseMoves(variation.moves);
    setExpectedMoves(moves);
    setGame(newGame);
    setPosition(newGame.fen());
    setSession({
      currentMoveIndex: 0,
      correctMoves: 0,
      totalMoves: moves.length,
      mistakes: 0,
      isComplete: false,
      startTime: new Date(),
      timeSpent: 0
    });
    setFeedback(null);
    setShowHint(false);
    setShowResults(false);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setSavingProgress(false);
  };

  const calculateScore = useCallback((session: PracticeSession): number => {
    const accuracy = session.totalMoves > 0 ? (session.correctMoves / session.totalMoves) * 100 : 0;
    const mistakePenalty = session.mistakes * 5;
    return Math.max(0, accuracy - mistakePenalty);
  }, []);

  const saveProgressToFirebase = async (score: number, timeSpent: number) => {
    if (!user) return;

    try {
      setSavingProgress(true);
      
      const completed = score >= 80;
      const variationsMastered = completed ? 1 : 0;
      const totalVariations = opening.variations.length;
      
      await updateOpeningProgressAfterPractice(
        user.uid,
        opening.id,
        opening.name,
        opening.eco,
        totalVariations,
        {
          successRate: score,
          variationsMastered,
          timeSpent,
          completed
        }
      );
      
      return true;
    } catch (error) {
      console.error("Failed to save progress to Firebase:", error);
      return false;
    } finally {
      setSavingProgress(false);
    }
  };

  const makeComputerMove = useCallback(() => {
    if (session.isComplete || session.currentMoveIndex >= expectedMoves.length) return;

    setTimeout(() => {
      const nextMoveIndex = session.currentMoveIndex + 1;
      if (nextMoveIndex < expectedMoves.length) {
        const computerMove = expectedMoves[nextMoveIndex];
        const newGame = new Chess(game.fen());
        
        try {
          newGame.move(computerMove);
          setGame(newGame);
          setPosition(newGame.fen());
          setSession(prev => ({
            ...prev,
            currentMoveIndex: nextMoveIndex + 1
          }));
          setSelectedSquare(null);
          setPossibleMoves([]);
        } catch (error) {
          // Silently handle error
        }
      }
    }, 500);
  }, [game, session, expectedMoves]);

const onSquareClick = useCallback(async (square: string) => {
      if (session.isComplete) return;

    const gameCopy = new Chess(game.fen());
    
    if (!selectedSquare) {
      const piece = gameCopy.get(square);
      if (piece && piece.color === (session.currentMoveIndex % 2 === 0 ? 'w' : 'b')) {
        setSelectedSquare(square);
        const moves = gameCopy.moves({ square, verbose: true });
        setPossibleMoves(moves.map(move => move.to));
      }
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    try {
      const move = gameCopy.move({
        from: selectedSquare,
        to: square,
        promotion: "q",
      });

      if (move) {
        const expectedMove = expectedMoves[session.currentMoveIndex];
        const isCorrect = move.san === expectedMove;

        if (isCorrect) {
          setFeedback({ type: 'success', message: 'Correct move! 🎉' });
          const nextIndex = session.currentMoveIndex + 1;
          
          setSession(prev => ({
            ...prev,
            currentMoveIndex: nextIndex,
            correctMoves: prev.correctMoves + 1
          }));

          setGame(gameCopy);
          setPosition(gameCopy.fen());
          setSelectedSquare(null);
          setPossibleMoves([]);

          if (nextIndex >= expectedMoves.length) {
            const endTime = new Date();
            const timeSpent = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
            
            const finalSession = {
              ...session,
              currentMoveIndex: nextIndex,
              correctMoves: session.correctMoves + 1,
              isComplete: true,
              timeSpent
            };
            setSession(finalSession);
            
            const finalScore = calculateScore(finalSession);
            
            // Save progress to Firebase
            if (user) {
              await saveProgressToFirebase(finalScore, timeSpent);
            }
            
            setShowResults(true);
            onComplete?.(finalScore, variation, timeSpent, finalScore >= 80);
          } else {
            makeComputerMove();
          }
        } else {
          setFeedback({ type: 'error', message: `Incorrect. Expected: ${expectedMove}` });
          setSession(prev => ({
            ...prev,
            mistakes: prev.mistakes + 1
          }));
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Invalid move' });
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [game, selectedSquare, session, expectedMoves, onComplete, calculateScore, makeComputerMove, user, variation]);

  const onSquareRightClick = useCallback((square: string) => {
    setSelectedSquare(null);
    setPossibleMoves([]);
  }, []);

  const customSquareStyles = useCallback(() => {
    const styles: any = {};
    
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)'
      };
    }
    
    possibleMoves.forEach(move => {
      styles[move] = {
        backgroundColor: 'rgba(0, 255, 0, 0.4)'
      };
    });
    
    return styles;
  }, [selectedSquare, possibleMoves]);

  const getCurrentHint = useCallback(() => {
    if (session.currentMoveIndex >= expectedMoves.length) return null;
    return expectedMoves[session.currentMoveIndex];
  }, [session.currentMoveIndex, expectedMoves]);

  const progress = session.totalMoves > 0 ? (session.currentMoveIndex / session.totalMoves) * 100 : 0;

  return (
    <Paper sx={{ 
      p: { xs: 2, sm: 3 }, 
      width: '100%', 
      mx: 'auto',
      boxSizing: 'border-box'
    }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        Practice: {variation.name}
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom align="center" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
          Make the correct moves for this variation
        </Typography>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 8, borderRadius: 4, mb: 1 }}
        />
        <Box display="flex" justifyContent="space-between" alignItems="center" flexDirection={{ xs: 'column', sm: 'row' }} gap={1}>
          <Typography variant="body2" color="text.secondary">
            Progress: {session.currentMoveIndex}/{session.totalMoves}
          </Typography>
          <Box display="flex" gap={1} flexDirection={{ xs: 'column', sm: 'row' }} width={{ xs: '100%', sm: 'auto' }}>
            <Chip 
              label={`Correct: ${session.correctMoves}`} 
              color="success" 
              variant="outlined"
              size="small"
              sx={{ width: { xs: '100%', sm: 'auto' }, mb: { xs: 0.5, sm: 0 } }}
            />
            <Chip 
              label={`Mistakes: ${session.mistakes}`} 
              color="error" 
              variant="outlined"
              size="small"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            />
          </Box>
        </Box>
      </Box>

      {feedback && (
        <Alert 
          severity={feedback.type} 
          sx={{ mb: 2 }}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={3}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: '300px', sm: '350px' }, display: 'flex', justifyContent: 'center' }}>
            <Chessboard
              position={position}
              onSquareClick={onSquareClick}
              onSquareRightClick={onSquareRightClick}
              boardWidth={Math.min(300, window.innerWidth - 40)}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
              customSquareStyles={customSquareStyles()}
              arePiecesDraggable={false}
              boardOrientation={session.currentMoveIndex % 2 === 0 ? "white" : "black"}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            {session.currentMoveIndex % 2 === 0 ? "Your turn (White)" : "Your turn (Black)"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, textAlign: 'center' }}>
            Click to select piece, then click destination
          </Typography>
        </Box>

        <Box sx={{ width: '100%' }}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Practice Information
              </Typography>
              <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                <strong>Opening:</strong> {opening.name}
              </Typography>
              <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                <strong>Variation:</strong> {variation.name}
              </Typography>
              <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                <strong>Description:</strong> {variation.description}
              </Typography>
              
              {showHint && getCurrentHint() && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <strong>Hint:</strong> The next move is {getCurrentHint()}
                </Alert>
              )}
            </CardContent>
          </Card>

          <Box display="flex" gap={1} flexWrap="wrap" flexDirection={{ xs: 'column', sm: 'row' }}>
            <Button 
              variant="outlined" 
              onClick={startNewPractice}
              fullWidth
              sx={{ mb: { xs: 1, sm: 0 } }}
            >
              Restart Practice
            </Button>
            <Button 
              variant="text" 
              onClick={() => setShowHint(!showHint)}
              disabled={session.isComplete}
              fullWidth
              sx={{ mb: { xs: 1, sm: 0 } }}
            >
              {showHint ? 'Hide Hint' : 'Show Hint'}
            </Button>
            <Button 
              variant="text" 
              onClick={onExit}
              color="secondary"
              fullWidth
            >
              Exit Practice
            </Button>
          </Box>
        </Box>
      </Box>

      <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h5" align="center" sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}>
            Practice Complete! 🎉
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box textAlign="center" py={2}>
            <Typography variant="h4" color="primary" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.125rem' } }}>
              Score: {calculateScore(session).toFixed(1)}%
            </Typography>
            <Typography variant="body1" paragraph>
              You completed the {variation.name} variation!
            </Typography>
            <Box display="flex" justifyContent="center" gap={1} mt={2} flexWrap="wrap">
              <Chip 
                label={`${session.correctMoves}/${session.totalMoves} Correct`} 
                color="success" 
                sx={{ mb: 1 }}
              />
              <Chip 
                label={`${session.mistakes} Mistakes`} 
                color="error" 
                variant="outlined"
                sx={{ mb: 1 }}
              />
              <Chip 
                label={`${Math.floor(session.timeSpent / 60)}m ${session.timeSpent % 60}s`} 
                color="info" 
                variant="outlined"
                sx={{ mb: 1 }}
              />
            </Box>
            {savingProgress && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Saving your progress...
              </Alert>
            )}
            {user && !savingProgress && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Progress saved to your profile!
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button variant="contained" onClick={startNewPractice} size="large" sx={{ width: { xs: '100%', sm: 'auto' }, mb: { xs: 1, sm: 0 } }}>
            Practice Again
          </Button>
          <Button variant="outlined" onClick={onExit} size="large" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Back to Study
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
