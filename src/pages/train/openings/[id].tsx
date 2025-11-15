// src/pages/train/openings/[id].tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { 
  Box, Typography, Paper, Button, CircularProgress, 
  Tabs, Tab, Card, CardContent, Chip, Grid,
  List, ListItem, ListItemText, Divider, Alert,
  ListItemButton, LinearProgress, useTheme,
  useMediaQuery, AppBar, Toolbar, IconButton
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
import { ArrowBack, Menu, NavigateBefore, NavigateNext } from "@mui/icons-material";

// Dynamically import chessboard to avoid SSR issues
const Chessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
  ssr: false,
  loading: () => (
    <Box height="300px" display="flex" alignItems="center" justifyContent="center">
      <CircularProgress />
    </Box>
  )
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Memoized move parsing function
  const parseMoves = useCallback((movesString: string): string[] => {
    if (!movesString) return [];
    
    const cleanMoves = movesString
      .replace(/\d+\./g, '')
      .split(' ')
      .filter(move => move.trim() && move !== '...');
    
    return cleanMoves;
  }, []);

  // Optimized board position update
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

  // Helper function to load full opening data
  const loadFullOpeningData = useCallback(async (openingId: string): Promise<Opening | null> => {
    try {
      const ecoData = await ECODataProcessor.loadAllECOData();
      return ECODataProcessor.findOpeningById(ecoData, openingId);
    } catch (error) {
      console.error('Error loading full opening data:', error);
      return null;
    }
  }, []);

  // Load user progress
  const loadUserProgress = useCallback(async (openingId: string) => {
    if (!user) return;
    
    try {
      const progress = await getSpecificOpeningProgress(user.uid, openingId);
      setUserProgress(progress);
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  }, [user]);

  // Main loading function
  const loadOpening = useCallback(async (openingId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const decodedId = decodeURIComponent(openingId);
      const index = ECODataIndex.getInstance();
      await index.initialize();
      
      const indexOpening = index.getOpeningById(decodedId);
      
      if (indexOpening) {
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
        
        if (user) {
          loadUserProgress(decodedId);
        }
        
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

      const fullOpening = await loadFullOpeningData(decodedId);
      if (fullOpening) {
        setOpening(fullOpening);
        setCurrentVariation(fullOpening.variations[0]);
        updateBoardPosition(fullOpening.moves);
        
        if (user) {
          loadUserProgress(decodedId);
        }
        
        setLoading(false);
        return;
      }

      setError("Opening not found");
    } catch (err) {
      console.error("Error loading opening:", err);
      setError("Failed to load opening data");
    } finally {
      setLoading(false);
    }
  }, [loadFullOpeningData, updateBoardPosition, user, loadUserProgress]);

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadOpening(id);
    }
  }, [id]);

  useEffect(() => {
    if (user && opening?.id) {
      loadUserProgress(opening.id);
    }
  }, [user, opening?.id, loadUserProgress]);

  const handleVariationSelect = useCallback((variation: Variation) => {
    setCurrentVariation(variation);
    updateBoardPosition(variation.moves);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [updateBoardPosition, isMobile]);

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
    
    if (user && opening?.id) {
      loadUserProgress(opening.id);
    }
  }, [user, opening?.id, loadUserProgress]);

  const handlePracticeComplete = useCallback((score: number, variation: Variation, timeSpent: number, completed: boolean) => {
    console.log(`Practice completed with score: ${score}%`);
    
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

  // Calculate chessboard size for responsive design
  const chessboardSize = useMemo(() => {
    if (isSmallMobile) return 280;
    if (isMobile) return 320;
    return 400;
  }, [isMobile, isSmallMobile]);

  // Progress display component
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
        <Box display="flex" gap={1} flexWrap="wrap">
          <Chip label={`${userProgress.practiceCount} practices`} size="small" variant="outlined" />
          <Chip label={`Best: ${userProgress.bestScore}%`} size="small" color="primary" variant="outlined" />
          {userProgress.completed && <Chip label="Mastered" size="small" color="success" />}
        </Box>
      </Box>
    );
  }, [userProgress]);

  const moves = useMemo(() => currentVariation ? parseMoves(currentVariation.moves) : [], [currentVariation, parseMoves]);
  const currentMoveIndex = moveHistory.length;
  const canGoBack = currentMoveIndex > 0;
  const canGoForward = currentMoveIndex < moves.length;

  // Render different modes
  if (activeMode === 'practice' && selectedVariation && opening) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }} startIcon={<ArrowBack />}>
          Back to Study
        </Button>
        <PracticeMode opening={opening} variation={selectedVariation} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'memory-test' && selectedVariation && opening) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }} startIcon={<ArrowBack />}>
          Back to Study
        </Button>
        <MemoryTest opening={opening} variation={selectedVariation} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'trap-test' && opening) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }} startIcon={<ArrowBack />}>
          Back to Study
        </Button>
        <TrapTest opening={opening} onComplete={handlePracticeComplete} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'explorer' && opening) {
    return (
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }} startIcon={<ArrowBack />}>
          Back to Study
        </Button>
        <OpeningExplorer opening={opening} onExit={handleExitMode} />
      </Box>
    );
  }

  if (activeMode === 'progress') {
    return (
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Button variant="outlined" onClick={handleExitMode} sx={{ mb: 2 }} startIcon={<ArrowBack />}>
          Back to Study
        </Button>
        <ProgressTracker onOpenOpening={handleOpenOpening} />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh" flexDirection="column" p={2}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Opening...</Typography>
      </Box>
    );
  }

  if (error || !opening) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Opening not found"}</Alert>
        <Button variant="contained" onClick={() => router.push("/train/openings")}>
          Back to Openings
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Tembo — {opening.name}</title>
        <meta name="description" content={`Learn and practice the ${opening.name} chess opening`} />
      </Head>

      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar position="sticky" color="default" elevation={1}>
          <Toolbar>
            <IconButton
              edge="start"
              onClick={() => router.push("/train/openings")}
              sx={{ mr: 2 }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontSize: '1rem' }}>
              {opening.name}
            </Typography>
            <IconButton
              edge="end"
              onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            >
              <Menu />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
        {/* Header - Desktop */}
        {!isMobile && (
          <Box sx={{ mb: 3 }}>
            <Button 
              variant="outlined" 
              onClick={() => router.push("/train/openings")} 
              sx={{ mb: 2 }}
              startIcon={<ArrowBack />}
            >
              Back to Openings
            </Button>
            
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
              <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: '300px' } }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.75rem', sm: '2rem', md: '2.5rem' } }}>
                  {opening.name}
                </Typography>
                <Box display="flex" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                  <Chip label={opening.eco} variant="outlined" size={isSmallMobile ? "small" : "medium"} />
                  <Chip 
                    label={opening.difficulty} 
                    color={getDifficultyColor(opening.difficulty) as any} 
                    size={isSmallMobile ? "small" : "medium"}
                  />
                  <Chip 
                    label={`${opening.popularity}% Popular`} 
                    variant="outlined" 
                    size={isSmallMobile ? "small" : "medium"} 
                  />
                </Box>
                {opening.aliases && opening.aliases.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Also known as:</strong> {opening.aliases.join(', ')}
                  </Typography>
                )}
              </Box>
              
              <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: { xs: 2, sm: 0 } }}>
                <Button 
                  variant="contained" 
                  size={isSmallMobile ? "small" : "medium"}
                  onClick={handleShowProgress}
                >
                  View Progress
                </Button>
                <Button 
                  variant="outlined" 
                  size={isSmallMobile ? "small" : "medium"}
                  onClick={handleStartExplorer}
                >
                  Explore
                </Button>
              </Box>
            </Box>

            {/* Progress Display */}
            {user && ProgressDisplay}
          </Box>
        )}

        <Grid container spacing={2}>
          {/* Left Column - Chessboard and Variations */}
          <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  Interactive Board
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Current variation: {currentVariation?.name}
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <Chessboard 
                  position={currentPosition}
                  boardWidth={chessboardSize}
                  customBoardStyle={{
                    borderRadius: "8px",
                    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.25)",
                  }}
                />
              </Box>
              
              {/* Navigation Controls */}
              <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" sx={{ mb: 2 }}>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={handleResetBoard}
                  fullWidth={isSmallMobile}
                >
                  Reset
                </Button>
                <Box display="flex" gap={1} sx={{ width: isSmallMobile ? '100%' : 'auto' }}>
                  <Button 
                    variant="text" 
                    size="small"
                    onClick={() => navigateMove('back')} 
                    disabled={!canGoBack}
                    startIcon={<NavigateBefore />}
                    fullWidth={isSmallMobile}
                  >
                    Back
                  </Button>
                  <Button 
                    variant="text" 
                    size="small"
                    onClick={() => navigateMove('forward')} 
                    disabled={!canGoForward}
                    endIcon={<NavigateNext />}
                    fullWidth={isSmallMobile}
                  >
                    Next
                  </Button>
                </Box>
              </Box>

              {/* Move History */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Move History ({currentMoveIndex}/{moves.length}):
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default', maxHeight: 80, overflow: 'auto' }}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
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

            {/* Variations Panel */}
            <Paper 
              sx={{ 
                p: { xs: 2, sm: 3 },
                display: { xs: mobileDrawerOpen ? 'block' : 'none', md: 'block' }
              }}
            >
              <Typography variant="h6" gutterBottom>Variations</Typography>
              <List dense sx={{ maxHeight: { xs: '60vh', md: 400 }, overflow: 'auto' }}>
                {opening.variations.map((variation, index) => (
                  <ListItemButton
                    key={`${variation.name}-${index}`}
                    selected={currentVariation?.name === variation.name}
                    onClick={() => handleVariationSelect(variation)}
                    sx={{ mb: 1 }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2" noWrap>
                          {variation.name}
                        </Typography>
                      }
                      secondary={
                        <React.Fragment>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            fontFamily="monospace" 
                            component="span" 
                            sx={{ 
                              display: 'block',
                              fontSize: { xs: '0.7rem', sm: '0.875rem' }
                            }}
                          >
                            {variation.moves.split(' ').slice(0, 4).join(' ')}...
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            component="span" 
                            sx={{ 
                              display: 'block',
                              fontSize: { xs: '0.65rem', sm: '0.75rem' }
                            }}
                          >
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

          {/* Right Column - Information and Exercises */}
          <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
            {/* Mobile Header */}
            {isMobile && (
              <Paper sx={{ p: 2, mb: 2, display: { xs: 'block', md: 'none' } }}>
                <Box sx={{ mb: 2 }}>
                  <Box display="flex" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                    <Chip label={opening.eco} variant="outlined" size="small" />
                    <Chip 
                      label={opening.difficulty} 
                      color={getDifficultyColor(opening.difficulty) as any} 
                      size="small"
                    />
                    <Chip 
                      label={`${opening.popularity}% Popular`} 
                      variant="outlined" 
                      size="small" 
                    />
                  </Box>
                  {opening.aliases && opening.aliases.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      <strong>Also known as:</strong> {opening.aliases.join(', ')}
                    </Typography>
                  )}
                </Box>

                {/* Progress Display for Mobile */}
                {user && ProgressDisplay}

                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button 
                    variant="contained" 
                    size="small"
                    onClick={handleShowProgress}
                    fullWidth
                  >
                    View Progress
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={handleStartExplorer}
                    fullWidth
                  >
                    Explore Variations
                  </Button>
                </Box>
              </Paper>
            )}

            {/* Information Tabs */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => setActiveTab(newValue)} 
                sx={{ mb: 2 }}
                variant={isSmallMobile ? "scrollable" : "standard"}
                scrollButtons={isSmallMobile ? "auto" : false}
                allowScrollButtonsMobile
              >
                <Tab label="Overview" />
                <Tab label="Key Ideas" />
                <Tab label="Traps & Tricks" />
              </Tabs>

              {/* Tab Content */}
              <Box sx={{ maxHeight: { xs: '40vh', md: 'auto' }, overflow: 'auto' }}>
                {activeTab === 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                      Description
                    </Typography>
                    <Typography variant="body1" paragraph sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                      {opening.description}
                    </Typography>
                    
                    {currentVariation && currentVariation.description && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                          {currentVariation.name}
                        </Typography>
                        <Typography variant="body1" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                          {currentVariation.description}
                        </Typography>
                      </>
                    )}
                  </Box>
                )}

                {activeTab === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                      Key Strategic Ideas
                    </Typography>
                    <List dense>
                      {opening.keyIdeas.map((idea, index) => (
                        <ListItem key={index} sx={{ py: 0.5 }}>
                          <ListItemText 
                            primary={`${index + 1}. ${idea}`} 
                            sx={{ '& .MuiListItemText-primary': { fontSize: { xs: '0.9rem', sm: '1rem' } } }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}

                {activeTab === 2 && (
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                      Common Traps & Tactical Ideas
                    </Typography>
                    {opening.commonTraps.length > 0 ? (
                      opening.commonTraps.map((trap, index) => (
                        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                          <CardContent sx={{ p: 2 }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                              {trap.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                              {trap.description}
                            </Typography>
                            <Paper variant="outlined" sx={{ p: 1, bgcolor: 'background.default' }}>
                              <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                {trap.moves}
                              </Typography>
                            </Paper>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Typography color="text.secondary" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                        No specific traps documented for this opening.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </Paper>

            {/* Practice Exercises */}
            <Paper sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Practice Exercises
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={6} md={6}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s', 
                      height: '100%',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } 
                    }} 
                    onClick={() => opening.variations[0] && handleStartPractice(opening.variations[0])}
                  >
                    <CardContent sx={{ py: 2, px: 1 }}>
                      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>🎯</Typography>
                      <Typography variant="subtitle2" gutterBottom noWrap>Practice</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Interactive moves
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={6}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      height: '100%',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } 
                    }} 
                    onClick={() => opening.variations[0] && handleStartMemoryTest(opening.variations[0])}
                  >
                    <CardContent sx={{ py: 2, px: 1 }}>
                      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>🧠</Typography>
                      <Typography variant="subtitle2" gutterBottom noWrap>Memory Test</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75' } }}>
                        Test knowledge
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={6}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      height: '100%',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } 
                    }} 
                    onClick={handleStartTrapTest}
                  >
                    <CardContent sx={{ py: 2, px: 1 }}>
                      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>⚡</Typography>
                      <Typography variant="subtitle2" gutterBottom noWrap>Trap Test</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Spot tactics
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={6}>
                  <Card 
                    variant="outlined" 
                    sx={{ 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      height: '100%',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 } 
                    }} 
                    onClick={handleStartExplorer}
                  >
                    <CardContent sx={{ py: 2, px: 1 }}>
                      <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '2.5rem' } }}>🌳</Typography>
                      <Typography variant="subtitle2" gutterBottom noWrap>Explore</Typography>
                      <Typography variant="caption" color="text-secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Study variations
                      </Typography>
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