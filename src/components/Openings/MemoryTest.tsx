// src/components/Openings/MemoryTest.tsx
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

interface MemoryTestProps {
  opening: any;
  variation: any;
  onComplete?: (score: number) => void;
  onExit?: () => void;
}

interface TestQuestion {
  position: string;
  correctMove: string;
  options: string[];
  explanation: string;
}

export default function MemoryTest({ opening, variation, onComplete, onExit }: MemoryTestProps) {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    generateQuestions();
  }, [variation]);

  const generateQuestions = useCallback(() => {
    const game = new Chess();
    const moves = variation.moves.split(' ').filter((move: string) => move.trim() && !move.includes('.'));
    const generatedQuestions: TestQuestion[] = [];

    // Generate questions at key positions
    for (let i = 0; i < Math.min(5, moves.length); i++) {
      try {
        // Play up to the current position
        const positionMoves = moves.slice(0, i);
        const tempGame = new Chess();
        
        positionMoves.forEach((move: string) => {
          try {
            tempGame.move(move);
          } catch {
            // Skip invalid moves
          }
        });

        const correctMove = moves[i];
        if (!correctMove) continue;

        // Generate plausible alternative moves
        const possibleMoves = tempGame.moves();
        const options = [correctMove];
        
        // Add some plausible alternatives
        for (let j = 0; j < 3 && j < possibleMoves.length; j++) {
          if (possibleMoves[j] !== correctMove) {
            options.push(possibleMoves[j]);
          }
        }

        // Shuffle options
        const shuffledOptions = options.sort(() => Math.random() - 0.5);

        generatedQuestions.push({
          position: tempGame.fen(),
          correctMove,
          options: shuffledOptions,
          explanation: `This is the ${i + 1}th move in the ${variation.name} variation.`
        });
      } catch (error) {
      }
    }

    setQuestions(generatedQuestions);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedOption("");
    setShowResult(false);
    setIsComplete(false);
  }, [variation]);

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
      <Paper sx={{ p: 3, textAlign: 'center', width: '100%', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Generating test questions...
        </Typography>
        <Button onClick={generateQuestions}>
          Retry
        </Button>
      </Paper>
    );
  }

  if (isComplete) {
    return (
      <Paper sx={{ 
        p: { xs: 2, sm: 4 }, 
        textAlign: 'center', 
        width: '100%', 
        mx: 'auto',
        boxSizing: 'border-box'
      }}>
        <Typography variant="h4" gutterBottom color="primary">
          Test Complete! 🎉
        </Typography>
        <Typography variant="h3" gutterBottom>
          {score}/{questions.length}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {((score / questions.length) * 100).toFixed(1)}% Accuracy
        </Typography>
        <Box display="flex" gap={2} justifyContent="center" mt={3} flexDirection={{ xs: 'column', sm: 'row' }}>
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
    <Paper sx={{ 
      p: { xs: 2, sm: 3 }, 
      width: '100%', 
      mx: 'auto',
      boxSizing: 'border-box'
    }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
        Memory Test: {variation.name}
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 8, borderRadius: 4, mb: 2 }}
        />
        <Box display="flex" justifyContent="space-between" alignItems="center" flexDirection={{ xs: 'column', sm: 'row' }} gap={1}>
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

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Chessboard */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: '300px', sm: '350px' }, display: 'flex', justifyContent: 'center' }}>
            <Chessboard
              position={currentQ.position}
              boardWidth={Math.min(300, window.innerWidth - 40)}
              customBoardStyle={{
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
            What's the next move in this position?
          </Typography>
        </Box>

        {/* Questions */}
        <Box sx={{ width: '100%' }}>
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend">
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Select the correct move:
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
                    <Typography variant="body1" fontFamily="monospace" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                      {option}
                    </Typography>
                  }
                  disabled={showResult}
                  sx={{ mb: 1 }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {showResult && (
            <Alert 
              severity={selectedOption === currentQ.correctMove ? 'success' : 'error'}
              sx={{ mt: 2 }}
            >
              {selectedOption === currentQ.correctMove ? (
                'Correct! 🎉'
              ) : (
                `Incorrect. The right move was: ${currentQ.correctMove}`
              )}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {currentQ.explanation}
              </Typography>
            </Alert>
          )}

          <Box display="flex" gap={1} mt={3} flexDirection={{ xs: 'column', sm: 'row' }}>
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
            <Button variant="outlined" onClick={onExit} size="large" sx={{ width: { xs: '100%', sm: 'auto' } }}>
              Exit Test
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
