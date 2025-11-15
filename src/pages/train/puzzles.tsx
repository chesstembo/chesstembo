// src/pages/train/puzzles.tsx
import React from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  LinearProgress,
  Chip,
  Alert,
} from "@mui/material";
import useTrain from "../../hooks/useTrain";
import AdSlot from "../../components/Ads/AdSlot";
import AdblockDetector from "../../components/AdBlock/AdblockDetector";

const TrainBoard = dynamic(() => import("../../components/Train/TrainBoard"), {
  ssr: false,
  loading: () => (
    <Box display="flex" justifyContent="center" alignItems="center" height="400px">
      <CircularProgress />
    </Box>
  ),
});

export default function PuzzlesPage() {
  const router = useRouter();
  const { set: setId } = router.query;

  const {
    currentPuzzle,
    loading,
    handleNextPuzzle,
    handleSolvePuzzle,
    puzzles,
    solvedCount,
    totalPuzzles,
  } = useTrain(Array.isArray(setId) ? setId[0] : setId);

  const handleSolve = async (correct: boolean) => {
    try {
      await handleSolvePuzzle(correct);
    } catch (error) {
      // Silently handle error
    }
  };

  const progress = totalPuzzles > 0 ? (solvedCount / totalPuzzles) * 100 : 0;

  const getUserGoal = (): string => {
    if (!currentPuzzle) return "Find the best move";
    
    const puzzleTheme = currentPuzzle.theme || currentPuzzle.themes?.[0] || "Unknown";
    const themes = puzzleTheme.toLowerCase();
    
    if (themes.includes('mate') || themes.includes('checkmate')) {
      return "Deliver checkmate";
    }
    if (themes.includes('draw') || themes.includes('equality')) {
      return "Secure a draw";
    }
    if (currentPuzzle.solution && currentPuzzle.solution.length <= 2) {
      return "Find the winning tactic";
    }
    
    return "Find the best sequence";
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="70vh">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading puzzles...
        </Typography>
      </Box>
    );
  }

  if (!currentPuzzle || !puzzles || puzzles.length === 0) {
    return (
      <Box textAlign="center" mt={10} px={2}>
        <Alert severity="warning" sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            No puzzles found
          </Typography>
          <Typography variant="body1">
            Please try downloading the puzzle pack again or select a different set.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => router.push("/train")}
        >
          Back to Puzzle Packs
        </Button>
      </Box>
    );
  }

  const puzzleTheme = currentPuzzle.theme || currentPuzzle.themes?.[0] || "Unknown";
  const puzzleRating = currentPuzzle.rating || "?";
  const puzzleSolution = currentPuzzle.solution || [];
  const userSide = currentPuzzle.userSide || 'white';

  const showHint = () => {
    alert(`Hint: Focus on ${puzzleTheme.replace(/_/g, " ")}!`);
  };

  return (
    <>
      <Head>
        <title>Tembo — Puzzle Trainer</title>
        <meta name="description" content="Solve chess puzzles and improve your tactical skills" />
      </Head>

      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={3}
        mt={2}
        mb={4}
        px={2}
        maxWidth="800px"
        margin="0 auto"
      >
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
            {puzzleTheme.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}
          </Typography>
        </Paper>

        <Paper
          elevation={4}
          sx={{
            p: { xs: 1, sm: 2, md: 3 },
            borderRadius: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            width: "100%",
          }}
        >
          <TrainBoard
            fen={currentPuzzle.fen}
            solution={puzzleSolution}
            onSolve={handleSolve}
            disabled={false}
            userSide={userSide}
            autoNextDelay={2000}
          />

          <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={showHint}
              disabled={loading}
              size="small"
            >
              Hint
            </Button>
            <Button 
              variant="contained" 
              color="success" 
              onClick={() => handleNextPuzzle(setId as string)}
              disabled={loading}
              size="small"
            >
              Next Puzzle
            </Button>
          </Box>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            p: 3,
            borderRadius: 3,
            width: "100%",
            backgroundColor: "background.paper",
          }}
        >
          {setId && (
            <Chip 
              label={`Set: ${setId}`} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ mb: 2 }}
            />
          )}
          
          <Box sx={{ mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Progress
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

          <Box 
            display="grid" 
            gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }}
            gap={2}
            sx={{ textAlign: 'center' }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">
                Rating
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {puzzleRating}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                Moves
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {puzzleSolution.length}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">
                You Play As
              </Typography>
              <Typography variant="body1" fontWeight="bold" color="primary.main">
                {userSide === 'white' ? 'White ♔' : 'Black ♚'}
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
        </Paper>

        <Box width="100%" mt={2}>
          <AdSlot id="train-bottom" />
          <AdblockDetector />
        </Box>
      </Box>
    </>
  );
}