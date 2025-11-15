// src/pages/train/openings/[id].tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { 
  Box, Typography, Paper, Button, CircularProgress, 
  Tabs, Tab, Card, CardContent, Chip, Grid,
  List, ListItem, ListItemText, Divider, Alert,
  ListItemButton, LinearProgress
} from "@mui/material";
import Head from "next/head";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, getSpecificOpeningProgress } from "../../../lib/firebaseClient";
import { ECODataProcessor, Opening, Variation } from "../../../utils/ecoDataProcessor";
import { ECODataIndex } from "../../../utils/ecoDataIndex";
import PracticeMode from "../../../components/Openings/PracticeMode";
import MemoryTest from "../../../components/Openings/MemoryTest";
import TrapTest from "../../../components/Openings/TrapTest";
import OpeningExplorer from "../../../components/Openings/OpeningExplorer";
import ProgressTracker from "../../../components/Openings/ProgressTracker";

// Dynamically import chessboard to avoid SSR issues
const Chessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
  ssr: false,
  loading: () => <Box height="400px" display="flex" alignItems="center" justifyContent="center"><CircularProgress /></Box>
});

type ActiveMode = 'study' | 'practice' | 'memory-test' | 'trap-test' | 'explorer' | 'progress';

export default function OpeningDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [user] = useAuthState(auth);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [currentPosition, setCurrentPosition] = useState("start");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [currentVariation, setCurrentVariation] = useState<Variation | null>(null);
  const [activeMode, setActiveMode] = useState<ActiveMode>('study');
  const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
  const [userProgress, setUserProgress] = useState<any>(null);

  // Memoized move parsing function - STABLE
  const parseMoves = useCallback((movesString: string): string[] => {
    if (!movesString) return [];
    
    const cleanMoves = movesString
      .replace(/\d+\./g, '')
      .split(' ')
      .filter(move => move.trim() && move !== '...');
    
    return cleanMoves;
  }, []);

  // Optimized board position update - STABLE
  const updateBoardPosition = useCallback((moves: string) => {
    try {
      const game = new Chess();
      const movesArray = parseMoves(moves);
      
      for (const move of movesArray) {
        try {
          game.move(move);
        } catch (sanError) {
          try {
            const cleanedMove = move.replace(/[+#!?]/g, '');
            game.move(cleanedMove);
          } catch (finalError) {
            console.warn(`Invalid move: ${move}`, finalError);
            continue;
          }
        }
      }
      
      setCurrentPosition(game.fen());
      setMoveHistory(movesArray);
    } catch (err) {
      console.error("Error updating board position:", err);
      setCurrentPosition("start");
      setMoveHistory([]);
    }
  }, [parseMoves]);

  // Helper function to load full opening data - STABLE
  const loadFullOpeningData = useCallback(async (openingId: string): Promise<Opening | null> => {
    try {
      const ecoData = await ECODataProcessor.loadAllECOData();
      return ECODataProcessor.findOpeningById(ecoData, openingId);
    } catch (error) {
      console.error('Error loading full opening data:', error);
      return null;
    }
  }, []);

  // Load user progress - STABLE
  const loadUserProgress = useCallback(async (openingId: string) => {
    if (!user) return;
    
    try {
      const progress = await getSpecificOpeningProgress(user.uid, openingId);
      setUserProgress(progress);
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  }, [user]);

  // Main loading function - STABLE with minimal dependencies
  const loadOpening = useCallback(async (openingId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Decode URL parameter if needed
      const decodedId = decodeURIComponent(openingId);
      
      // Initialize index once
      const index = ECODataIndex.getInstance();
      await index.initialize();
      
      // Search for the opening in our index first
      const indexOpening = index.getOpeningById(decodedId);
      
      if (indexOpening) {
        // Show basic info immediately
        const tempOpening: Opening = {
          id: indexOpening.id,
          name: indexOpening.name,
          eco: indexOpening.eco,
          description: `Loading details for ${indexOpening.name}...`,
          moves: indexOpening.moves,
          difficulty: indexOpening.difficulty,
          popularity: indexOpening.popularity,
          variations: [{
            name: "Main Line",
            moves: indexOpening.moves,
            description: "Main variation"
          }],
          keyIdeas: ["Loading..."],
          commonTraps: [],
          aliases: indexOpening.aliases
        };
        
        setOpening(tempOpening);
        setCurrentVariation(tempOpening.variations[0]);
        updateBoardPosition(indexOpening.moves);
        
        // Load user progress in parallel
        if (user) {
          loadUserProgress(decodedId);
        }
        
        // Load full data in background
        setTimeout(async () => {
          try {
            const fullOpening = await loadFullOpeningData(decodedId);
            if (fullOpening) {
              setOpening(fullOpening);
              setCurrentVariation(fullOpening.variations[0]);
            }
          } catch (error) {
            console.error('Background loading failed:', error);
          }
        }, 100);
        
        setLoading(false);
        return;
      }

      // Fallback: try to load full data directly
      const fullOpening = await loadFullOpeningData(decodedId);
      if (fullOpening) {
        setOpening(fullOpening);
        setCurrentVariation(fullOpening.variations[0]);
        updateBoardPosition(fullOpening.moves);
        
        // Load user progress
        if (user) {
          loadUserProgress(decodedId);
        }
        
        setLoading(false);
        return;
      }

      // Final fallback
      setError("Opening not found");
    } catch (err) {
      console.error("Error loading opening:", err);
      setError("Failed to load opening data");
    } finally {
      setLoading(false);
    }
  }, [loadFullOpeningData, updateBoardPosition, user, loadUserProgress]);

  // Load opening when ID changes - FIXED DEPENDENCIES
  useEffect(() => {
    if (id && typeof id === 'string') {
      loadOpening(id);
    }
  }, [id]); // Only depend on id

  // Load user progress when opening changes - SEPARATE EFFECT
  useEffect(() => {
    if (user && opening?.id) {
      loadUserProgress(opening.id);
    }
  }, [user, opening?.id, loadUserProgress]);

  // STABLE EVENT HANDLERS
  const handleVariationSelect = useCallback((variation: Variation) => {
    setCurrentVariation(variation);
    updateBoardPosition(variation.moves);
  }, [updateBoardPosition]);

  const handleResetBoard = useCallback(() => {
    if (opening) {
      updateBoardPosition(opening.moves);
      setCurrentVariation(opening.variations[0]);
    }
  }, [opening, updateBoardPosition]);

  const handleStartPractice = useCallback((variation: Variation) => {
    setSelectedVariation(variation);
    setActiveMode('practice');
  }, []);

  const handleStartMemoryTest = useCallback((variation: Variation) => {
    setSelectedVariation(variation);
    setActiveMode('memory-test');
  }, []);

  const handleStartTrapTest = useCallback(() => {
    setActiveMode('trap-test');
  }, []);

  const handleStartExplorer = useCallback(() => {
    setActiveMode('explorer');
  }, []);

  const handleShowProgress = useCallback(() => {
    setActiveMode('progress');
  }, []);

  const handleExitMode = useCallback(() => {
    setActiveMode('study');
    setSelectedVariation(null);
    
    // Reload user progress when returning from practice
    if (user && opening?.id) {
      loadUserProgress(opening.id);
    }
  }, [user, opening?.id, loadUserProgress]);

  const handlePracticeComplete = useCallback((score: number, variation: Variation, timeSpent: number, completed: boolean) => {
    console.log(`Practice completed with score: ${score}%`);
    
    // Reload user progress to show updated stats
    if (user && opening?.id) {
      loadUserProgress(opening.id);
    }
  }, [user, opening?.id, loadUserProgress]);

  const handleOpenOpening = useCallback((openingId: string) => {
    router.push(`/train/openings/${openingId}`);
  }, [router]);

  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  }, []);

  const navigateMove = useCallback((direction: 'back' | 'forward') => {
    if (!currentVariation) return;

    const moves = parseMoves(currentVariation.moves);
    const currentIndex = moveHistory.length;
    
    if (direction === 'back' && currentIndex > 0) {
      const newMoves = moves.slice(0, currentIndex - 1);
      updateBoardPosition(newMoves.join(' '));
    } else if (direction === 'forward' && currentIndex < moves.length) {
      const newMoves = moves.slice(0, currentIndex + 1);
      updateBoardPosition(newMoves.join(' '));
    }
  }, [currentVariation, moveHistory.length, parseMoves, updateBoardPosition]);

  // Progress display component - MEMOIZED
  const ProgressDisplay = useMemo(() => {
    if (!userProgress) return null;
    
    const progressPercent = userProgress.variationsMastered / userProgress.totalVariations * 100;
    
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>Your Progress</Typography>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Variations Mastered: {userProgress.variationsMastered}/{userProgress.totalVariations}</Typography>
            <Typography variant="body2" fontWeight="bold">{Math.round(progressPercent)}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progressPercent} sx={{ height: 8, borderRadius: 4 }} />
        </Box>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Chip label={`${userProgress.practiceCount} practices`} size="small" variant="outlined" />
          <Chip label={`Best: ${userProgress.bestScore}%`} size="small" color="primary" variant="outlined" />
          {userProgress.completed && <Chip label="Mastered" size="small" color="success" />}
        </Box>
      </Box>
    );
  }, [userProgress]);

  // Memoized computed values
  const moves = useMemo(() => currentVariation ? parseMoves(currentVariation.moves) : [], [currentVariation, parseMoves]);
  const currentMoveIndex = moveHistory.length;
  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < moves.length;

  // Render different modes
  if (activeMode === 'practice' && selectedVariation && opening) {
    return (
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }}>← Back to Study</Button>
        <PracticeMode opening={opening} variation={selectedVariation} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'memory-test' && selectedVariation && opening) {
    return (
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }}>← Back to Study</Button>
        <MemoryTest opening={opening} variation={selectedVariation} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'trap-test' && opening) {
    return (
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }}>← Back to Study</Button>
        <TrapTest opening={opening} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'explorer' && opening) {
    return (
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }}>← Back to Study</Button>
        <OpeningExplorer opening={opening} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'progress') {
    return (
      <Box sx={{ p: 3 }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }}>← Back to Study</Button>
        <ProgressTracker onOpenOpening={handleOpenOpening} />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Opening...</Typography>
      </Box>
    );
  }

  if (error || !opening) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Opening not found"}</Alert>
        <Button variant="contained" onClick={() => router.push("/train/openings")}>Back to Openings</Button>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Tembo — {opening.name}</title>
        <meta name="description" content={`Learn and practice the ${opening.name} chess opening`} />
      </Head>

      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Button variant="outlined" onClick={() => router.push("/train/openings")} sx={{ mb: 2 }}>← Back to Openings</Button>
          
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h3" fontWeight="bold" gutterBottom>{opening.name}</Typography>
              <Box display="flex" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                <Chip label={opening.eco} variant="outlined" />
                <Chip label={opening.difficulty} color={getDifficultyColor(opening.difficulty) as any} />
                <Chip label={`${opening.popularity}% Popular`} variant="outlined" size="small" />
              </Box>
              {opening.aliases && opening.aliases.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Also known as:</strong> {opening.aliases.join(', ')}
                </Typography>
              )}
            </Box>
            
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button variant="contained" size="large" onClick={handleShowProgress}>View Progress</Button>
              <Button variant="outlined" size="large" onClick={handleStartExplorer}>Explore Variations</Button>
            </Box>
          </Box>

          {/* Progress Display */}
          {user && ProgressDisplay}
        </Box>

        <Grid container spacing={3}>
          {/* Left Column - Chessboard and Variations */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" gutterBottom>Interactive Board</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Current variation: {currentVariation?.name}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <Chessboard 
                  position={currentPosition}
                  boardWidth={400}
                  customBoardStyle={{
                    borderRadius: "8px",
                    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.25)",
                  }}
                />
              </Box>
              
              <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center">
                <Button variant="outlined" onClick={handleResetBoard}>Reset to Main Line</Button>
                <Button variant="text" onClick={() => navigateMove('back')} disabled={!canGoBack}>← Back</Button>
                <Button variant="text" onClick={() => navigateMove('forward')} disabled={!canGoForward}>Next →</Button>
              </Box>

              {/* Move History */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Move History ({currentMoveIndex}/{moves.length}):
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default', maxHeight: 120, overflow: 'auto' }}>
                  <Typography variant="body2" fontFamily="monospace">
                    {moveHistory.map((move, index) => (
                      <span key={index}>
                        <span style={{ 
                          fontWeight: index === currentMoveIndex - 1 ? 'bold' : 'normal',
                          color: index === currentMoveIndex - 1 ? 'primary.main' : 'inherit'
                        }}>
                          {move}
                        </span>
                        {index < moveHistory.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                    {moveHistory.length === 0 && 'No moves played'}
                  </Typography>
                </Paper>
              </Box>
            </Paper>

            {/* Variations */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Variations</Typography>
              <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
                {opening.variations.map((variation, index) => (
                  <ListItemButton
                    key={`${variation.name}-${index}`}
                    selected={currentVariation?.name === variation.name}
                    onClick={() => handleVariationSelect(variation)}
                    sx={{ mb: 1 }}
                  >
                    <ListItemText
                      primary={variation.name}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" color="text.secondary" fontFamily="monospace" component="span" display="block">
                            {variation.moves.split(' ').slice(0, 6).join(' ')}...
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="span" display="block">
                            {variation.description}
                          </Typography>
                        </React.Fragment>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Right Column - Information */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
                <Tab label="Overview" />
                <Tab label="Key Ideas" />
                <Tab label="Traps & Tricks" />
              </Tabs>

              {activeTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Description</Typography>
                  <Typography variant="body1" paragraph>{opening.description}</Typography>
                  
                  {currentVariation && currentVariation.description && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="h6" gutterBottom>{currentVariation.name}</Typography>
                      <Typography variant="body1">{currentVariation.description}</Typography>
                    </>
                  )}
                </Box>
              )}

              {activeTab === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Key Strategic Ideas</Typography>
                  <List>
                    {opening.keyIdeas.map((idea, index) => (
                      <ListItem key={index} sx={{ py: 1 }}>
                        <ListItemText primary={`${index + 1}. ${idea}`} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {activeTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Common Traps & Tactical Ideas</Typography>
                  {opening.commonTraps.length > 0 ? (
                    opening.commonTraps.map((trap, index) => (
                      <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>{trap.name}</Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>{trap.description}</Typography>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                            <Typography variant="body2" fontFamily="monospace">{trap.moves}</Typography>
                          </Paper>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Typography color="text.secondary">No specific traps documented for this opening.</Typography>
                  )}
                </Box>
              )}
            </Paper>

            {/* Practice Exercises */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Practice Exercises</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }} 
                    onClick={() => opening.variations[0] && handleStartPractice(opening.variations[0])}>
                    <CardContent sx={{ py: 3 }}>
                      <Typography variant="h4" gutterBottom>🎯</Typography>
                      <Typography variant="subtitle1" gutterBottom>Interactive Practice</Typography>
                      <Typography variant="body2" color="text.secondary">Practice moves with feedback</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }} 
                    onClick={() => opening.variations[0] && handleStartMemoryTest(opening.variations[0])}>
                    <CardContent sx={{ py: 3 }}>
                      <Typography variant="h4" gutterBottom>🧠</Typography>
                      <Typography variant="subtitle1" gutterBottom>Memory Test</Typography>
                      <Typography variant="body2" color="text.secondary">Test your knowledge</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }} 
                    onClick={handleStartTrapTest}>
                    <CardContent sx={{ py: 3 }}>
                      <Typography variant="h4" gutterBottom>⚡</Typography>
                      <Typography variant="subtitle1" gutterBottom>Trap Test</Typography>
                      <Typography variant="body2" color="text.secondary">Spot tactical opportunities</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card variant="outlined" sx={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } }} 
                    onClick={handleStartExplorer}>
                    <CardContent sx={{ py: 3 }}>
                      <Typography variant="h4" gutterBottom>🌳</Typography>
                      <Typography variant="subtitle1" gutterBottom>Explore Variations</Typography>
                      <Typography variant="body2" color="text.secondary">Study move trees</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}