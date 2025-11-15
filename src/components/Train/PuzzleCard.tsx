import React from "react";
import TrainBoard from "./TrainBoard";
import { Box, Typography, Paper, LinearProgress, Button } from "@mui/material";

// Define the correct structure for a puzzle object
interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  rating: number;
  theme: string;
  userSide: 'white' | 'black';
}

interface PuzzleCardProps {
  puzzle: Puzzle;
  onSolve: (correct: boolean) => void;
  onNext: () => void;
  puzzleIndex: number;
  totalPuzzles: number;
  solvedCount: number;
}

export default function PuzzleCard({ 
  puzzle, 
  onSolve, 
  onNext, 
  puzzleIndex, 
  totalPuzzles,
  solvedCount
}: PuzzleCardProps) {

  // State to manage whether the board interaction should be locked
  const [boardDisabled, setBoardDisabled] = React.useState(false); 
  
  if (!puzzle) return null;

  // Handle puzzle completion
  const handleSolve = (correct: boolean) => {
    if (correct) {
      setBoardDisabled(true);
      setTimeout(() => {
        onSolve(correct);
        setBoardDisabled(false);
      }, 1500);
    } else {
      onSolve(correct);
    }
  };

  // Handle next puzzle click
  const handleNext = () => {
    setBoardDisabled(false);
    onNext();
  };

  // Get user goal based on puzzle data
  const getUserGoal = (): string => {
    if (!puzzle.solution || puzzle.solution.length === 0) return "Find the best move";
    
    const themes = puzzle.theme?.toLowerCase() || '';
    
    if (themes.includes('mate') || themes.includes('checkmate')) {
      return "Deliver checkmate";
    }
    if (themes.includes('draw') || themes.includes('equality')) {
      return "Secure a draw";
    }
    if (puzzle.solution.length <= 2) {
      return "Find the winning tactic";
    }
    
    return "Find the best sequence";
  };

  // Get user move count
  const getUserMoveCount = (): number => {
    if (!puzzle.solution) return 0;
    const solutionLength = puzzle.solution.length;
    
    if (puzzle.userSide === 'white') {
      return Math.ceil(solutionLength / 2);
    } else {
      return Math.floor(solutionLength / 2);
    }
  };

  const progress = totalPuzzles > 0 ? (solvedCount / totalPuzzles) * 100 : 0;

  return (
    <Box 
      sx={{ 
        margin: "2rem auto", 
        width: "90%", 
        maxWidth: 800,
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {/* Theme Title - At the top */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 3,
          width: "100%",
          textAlign: "center",
          backgroundColor: "primary.main",
          color: "white",
        }}
      >
        <Typography variant="h4" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
          {puzzle.theme.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}
        </Typography>
        <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 1 }}>
          Puzzle {puzzleIndex} of {totalPuzzles}
        </Typography>
      </Paper>

      {/* Chess Board */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <TrainBoard
          fen={puzzle.fen}
          solution={puzzle.solution}
          onSolve={handleSolve}
          disabled={boardDisabled}
          userSide={puzzle.userSide}
          autoNextDelay={2000}
        />
      </Box>

      {/* Progress and Info Section - At the bottom */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          borderRadius: 3,
          width: "100%",
          backgroundColor: "background.paper",
        }}
      >
        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Your Progress
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {solvedCount} / {totalPuzzles}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
            color="primary"
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
            {Math.round(progress)}% complete
          </Typography>
        </Box>

        {/* Puzzle Details */}
        <Box 
          display="grid" 
          gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap={2}
          sx={{ textAlign: 'center', mb: 3 }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Rating
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {puzzle.rating}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Moves
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {puzzle.solution.length}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Your Moves
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {getUserMoveCount()}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Goal
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {getUserGoal()}
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box display="flex" justifyContent="center" gap={2}>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={handleNext}
            size="small"
          >
            Skip Puzzle
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}