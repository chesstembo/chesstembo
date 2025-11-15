// src/components/Openings/TrapTest.tsx
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
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel
} from "@mui/material";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";

const Chessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
  ssr: false
});

interface TrapTestProps {
  opening: any;
  onComplete?: (score: number) => void;
  onExit?: () => void;
}

interface TrapQuestion {
  position: string;
  question: string;
  correctMove: string;
  options: string[];
  explanation: string;
  trapName: string;
}

// Common tactical traps for various openings
const COMMON_TRAPS: { [key: string]: TrapQuestion[] } = {
  "sicilian-defense": [
    {
      position: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
      question: "Black just played c5. What's the tactical response for White?",
      correctMove: "d4",
      options: ["d4", "Nc3", "Bc4", "c3"],
      explanation: "Immediately challenging the center with d4 is the most principled response, attacking Black's c5 pawn and opening lines for development.",
      trapName: "Open Sicilian Center Attack"
    }
  ],
  "queens-gambit": [
    {
      position: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
      question: "White offers the c4 pawn. Should Black take it?",
      correctMove: "dxc4",
      options: ["dxc4", "e6", "Nf6", "c6"],
      explanation: "Accepting the gambit with dxc4 leads to the Queen's Gambit Accepted. While playable, it gives White strong center control after e3 and Bxc4.",
      trapName: "Queen's Gambit Accepted"
    }
  ],
  "ruy-lopez": [
    {
      position: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      question: "White's bishop is attacking f7. What's the best response for Black?",
      correctMove: "a6",
      options: ["a6", "Nf6", "d6", "Bc5"],
      explanation: "a6 forces the bishop to declare its intentions - either retreat to a4 or take on c6. This is the main line of the Ruy Lopez.",
      trapName: "Morphy Defense"
    }
  ]
};

export default function TrapTest({ opening, onComplete, onExit }: TrapTestProps) {
  const [questions, setQuestions] = useState<TrapQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [game] = useState(new Chess());

  useEffect(() => {
    generateQuestions();
  }, [opening]);

  const generateQuestions = useCallback(() => {
    let generatedQuestions: TrapQuestion[] = [];

    // Try to get opening-specific traps
    if (COMMON_TRAPS[opening.id]) {
      generatedQuestions = COMMON_TRAPS[opening.id];
    } else {
      // Generate generic tactical questions based on opening moves
      try {
        const moves = opening.moves.split(' ').filter((move: string) => move.trim() && !move.includes('.'));
        if (moves.length >= 3) {
          const tempGame = new Chess();
          moves.slice(0, 3).forEach((move: string) => {
            try { tempGame.move(move); } catch {}
          });

          const possibleMoves = tempGame.moves();
          if (possibleMoves.length > 3) {
            generatedQuestions = [{
              position: tempGame.fen(),
              question: `What's the best move in this ${opening.name} position?`,
              correctMove: possibleMoves[0],
              options: possibleMoves.slice(0, 4),
              explanation: `This is a key position in the ${opening.name}. The best move maintains your initiative and follows opening principles.`,
              trapName: `${opening.name} Key Position`
            }];
          }
        }
      } catch (error) {
        console.error('Error generating trap questions:', error);
      }
    }

    // If no questions generated, create a fallback question
    if (generatedQuestions.length === 0) {
      const fallbackGame = new Chess();
      fallbackGame.move("e4");
      fallbackGame.move("e5");
      fallbackGame.move("Nf3");
      
      generatedQuestions = [{
        position: fallbackGame.fen(),
        question: "What's the best developing move for White?",
        correctMove: "Bc4",
        options: ["Bc4", "Nc3", "d3", "Bb5"],
        explanation: "Bc4 develops the bishop to an active square, attacking the vulnerable f7 pawn and following opening principles.",
        trapName: "Basic Development"
      }];
    }

    setQuestions(generatedQuestions);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedOption("");
    setShowResult(false);
    setIsComplete(false);
  }, [opening]);

  const handleAnswer = useCallback(() => {
    if (!selectedOption) return;

    const isCorrect = selectedOption === questions[currentQuestion].correctMove;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    setShowResult(true);
  }, [selectedOption, currentQuestion, questions]);

  const handleNext = useCallback(() => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedOption("");
      setShowResult(false);
    } else {
      setIsComplete(true);
      onComplete?.(score / questions.length * 100);
    }
  }, [currentQuestion, questions.length, score, onComplete]);

  const progress = questions.length > 0 ? ((currentQuestion + (showResult ? 1 : 0)) / questions.length) * 100 : 0;

  if (questions.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Generating tactical questions...
        </Typography>
        <Button onClick={generateQuestions}>
          Retry
        </Button>
      </Paper>
    );
  }

  if (isComplete) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom color="primary">
          Trap Test Complete! 🎯
        </Typography>
        <Typography variant="h3" gutterBottom>
          {score}/{questions.length}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {((score / questions.length) * 100).toFixed(1)}% Accuracy
        </Typography>
        <Typography variant="body1" sx={{ mt: 2, mb: 3 }}>
          You've learned key tactical ideas in the {opening.name}!
        </Typography>
        <Box display="flex" gap={2} justifyContent="center">
          <Button variant="contained" onClick={generateQuestions} size="large">
            Try Again
          </Button>
          <Button variant="outlined" onClick={onExit} size="large">
            Back to Study
          </Button>
        </Box>
      </Paper>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <Paper sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Tactical Test: {opening.name}
      </Typography>
      <Typography variant="subtitle1" align="center" color="text.secondary" gutterBottom>
        Spot the traps and tactical opportunities
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 8, borderRadius: 4, mb: 2 }}
        />
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Question {currentQuestion + 1} of {questions.length}
          </Typography>
          <Chip 
            label={`Score: ${score}/${questions.length}`} 
            color="primary" 
            variant="outlined"
          />
        </Box>
      </Box>

      <Box display="flex" flexDirection={{ xs: 'column', lg: 'row' }} gap={3}>
        {/* Chessboard */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Chessboard
            position={currentQ.position}
            boardWidth={320}
            customBoardStyle={{
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} align="center">
            {currentQ.trapName}
          </Typography>
        </Box>

        {/* Questions */}
        <Box sx={{ flex: 1 }}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {currentQ.question}
              </Typography>
            </CardContent>
          </Card>

          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">
              <Typography variant="subtitle1" gutterBottom>
                Choose the best move:
              </Typography>
            </FormLabel>
            <RadioGroup
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              {currentQ.options.map((option, index) => (
                <FormControlLabel
                  key={index}
                  value={option}
                  control={<Radio />}
                  label={
                    <Typography variant="body1" fontFamily="monospace">
                      {option}
                    </Typography>
                  }
                  disabled={showResult}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {showResult && (
            <Alert 
              severity={selectedOption === currentQ.correctMove ? 'success' : 'error'}
              sx={{ mt: 2 }}
            >
              <Typography variant="subtitle2" gutterBottom>
                {selectedOption === currentQ.correctMove ? 'Correct! 🎉' : 'Not quite right.'}
              </Typography>
              <Typography variant="body2">
                {currentQ.explanation}
              </Typography>
              {selectedOption !== currentQ.correctMove && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                  Best move: {currentQ.correctMove}
                </Typography>
              )}
            </Alert>
          )}

          <Box display="flex" gap={1} mt={3}>
            {!showResult ? (
              <Button 
                variant="contained" 
                onClick={handleAnswer}
                disabled={!selectedOption}
                fullWidth
                size="large"
              >
                Submit Answer
              </Button>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleNext}
                fullWidth
                size="large"
              >
                {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            )}
            <Button variant="outlined" onClick={onExit} size="large">
              Exit Test
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}