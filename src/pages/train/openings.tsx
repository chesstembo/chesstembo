// src/pages/train/openings.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Divider,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Grid,
  Alert,
  TextField,
  InputAdornment,
  alpha,
  useTheme
} from "@mui/material";
import Head from "next/head";
import { useRouter } from "next/router";
import SearchIcon from '@mui/icons-material/Search';
import { ECODataProcessor } from "../../utils/ecoDataProcessor";

// Debounce hook for search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface Opening {
  id: string;
  name: string;
  eco: string;
  moves: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
  aliases: string[];
  variations?: any[];
  keyIdeas?: string[];
  commonTraps?: any[];
  description?: string;
}

interface OpeningListItemProps {
  opening: Opening;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  getDifficultyColor: (difficulty: string) => any;
  listItemRef?: (node: HTMLElement | null) => void;
}

// Separate component to avoid the nesting issue
const OpeningListItem = React.memo<OpeningListItemProps>(({ 
  opening, 
  selected, 
  onClick, 
  onDoubleClick,
  getDifficultyColor,
  listItemRef
}) => {
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      onDoubleClick();
    } else {
      const timeout = setTimeout(() => {
        onClick();
        setClickTimeout(null);
      }, 300);
      setClickTimeout(timeout);
    }
  };

  return (
    <ListItemButton 
      ref={listItemRef}
      selected={selected} 
      onClick={handleClick}
      sx={{
        '&:hover': {
          backgroundColor: selected ? 'primary.light' : 'action.hover',
        },
        transition: 'all 0.2s ease',
      }}
    >
      <ListItemText
        primary={
          <Box 
            component="span"
            display="flex" 
            justifyContent="space-between" 
            alignItems="flex-start"
          >
            <Typography 
              component="span"
              variant="subtitle1" 
              fontWeight="medium" 
              sx={{ 
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mr: 1
              }}
            >
              {opening.name}
            </Typography>
            <Chip 
              label={opening.difficulty} 
              size="small"
              color={getDifficultyColor(opening.difficulty)}
            />
          </Box>
        }
        secondary={
          <React.Fragment>
            <Typography variant="body2" color="text.secondary" noWrap component="span" display="block">
              {opening.eco} • {opening.moves.split(' ').slice(0, 3).join(' ')}...
            </Typography>
            {opening.aliases.length > 0 && (
              <Typography variant="caption" color="text.secondary" noWrap component="span" display="block">
                Also: {opening.aliases.slice(0, 1).join(', ')}
              </Typography>
            )}
          </React.Fragment>
        }
      />
    </ListItemButton>
  );
});

OpeningListItem.displayName = 'OpeningListItem';

export default function OpeningsPage() {
  const router = useRouter();
  const theme = useTheme();
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [allOpenings, setAllOpenings] = useState<Opening[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [selectedOpening, setSelectedOpening] = useState<Opening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [displayCount, setDisplayCount] = useState(50);
  const [scrollToOpening, setScrollToOpening] = useState<string | null>(null);

  const listRef = useRef<HTMLUListElement>(null);
  const openingRefs = useRef<Map<string, HTMLElement>>(new Map());

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Load all openings from local data - RUN ONCE
  useEffect(() => {
    let mounted = true;

    const loadOpenings = async () => {
      try {
        setInitializing(true);
        setLoading(true);

        const ecoData = await ECODataProcessor.loadAllECOData();
        const processedOpenings = ECODataProcessor.processECOData(ecoData);
        
        if (mounted) {
          setAllOpenings(processedOpenings);
          setOpenings(processedOpenings.slice(0, displayCount));
          
          if (processedOpenings.length > 0) {
            setSelectedOpening(processedOpenings[0]);
          }

          setInitializing(false);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error("Failed to load openings:", err);
          setError("Failed to load openings data. Using demo data instead.");
          
          const demoOpenings = getDemoOpenings();
          setAllOpenings(demoOpenings);
          setOpenings(demoOpenings);
          if (demoOpenings.length > 0) {
            setSelectedOpening(demoOpenings[0]);
          }
          
          setInitializing(false);
          setLoading(false);
        }
      }
    };

    loadOpenings();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependencies - run once

  // Search and filter openings - FIXED DEPENDENCIES
  useEffect(() => {
    if (loading || !allOpenings.length) return;

    const performSearch = () => {
      if (!debouncedSearchTerm.trim()) {
        const popularOpenings = allOpenings
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, displayCount);
        setOpenings(popularOpenings);
      } else {
        const results = allOpenings.filter(opening => 
          opening.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          opening.eco.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          opening.moves.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          opening.aliases.some(alias => 
            alias.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
          )
        ).slice(0, displayCount);
        
        setOpenings(results);
      }
    };

    performSearch();
  }, [debouncedSearchTerm, displayCount, loading, allOpenings]);

  // Auto-scroll to selected opening
  useEffect(() => {
    if (scrollToOpening && listRef.current) {
      const element = openingRefs.current.get(scrollToOpening);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 100);
      }
      setScrollToOpening(null);
    }
  }, [scrollToOpening]);

  // STABLE CALLBACKS
  const loadMore = useCallback(() => {
    const newCount = displayCount + 50;
    setDisplayCount(newCount);
  }, [displayCount]);

  const getAlphabetIndex = useMemo((): string[] => {
    return Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  }, []);

  const handleLetterClick = useCallback((letter: string) => {
    const filtered = allOpenings.filter(opening => 
      opening.name.charAt(0).toUpperCase() === letter
    ).slice(0, displayCount);
    
    setOpenings(filtered);
    setSearchTerm(letter);
    if (filtered.length > 0) {
      const firstOpening = filtered[0];
      setSelectedOpening(firstOpening);
      setScrollToOpening(firstOpening.id);
    }
  }, [displayCount, allOpenings]);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDisplayCount(50);
  }, []);

  const getDifficultyColor = useCallback((difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  }, []);

  const handlePracticeOpening = useCallback((opening: Opening) => {
    const safeId = encodeURIComponent(opening.id);
    router.push(`/train/openings/${safeId}?practice=true`);
  }, [router]);

  const handleStudyOpening = useCallback((opening: Opening) => {
    const safeId = encodeURIComponent(opening.id);
    router.push(`/train/openings/${safeId}`);
  }, [router]);

  const handleQuickPractice = useCallback((opening: Opening) => {
    alert(`Starting quick practice for ${opening.name}! You'll be tested on the main moves.`);
  }, []);

  const handleOpeningSelect = useCallback((opening: Opening) => {
    setSelectedOpening(opening);
    setScrollToOpening(opening.id);
  }, []);

  const handleOpeningDoubleClick = useCallback((opening: Opening) => {
    handleStudyOpening(opening);
  }, [handleStudyOpening]);

  const setOpeningRef = useCallback((openingId: string) => (node: HTMLElement | null) => {
    if (node) {
      openingRefs.current.set(openingId, node);
    } else {
      openingRefs.current.delete(openingId);
    }
  }, []);

  // Memoized computed values
  const hasMore = useMemo(() => openings.length < allOpenings.length, [openings.length, allOpenings.length]);
  const totalOpeningsCount = useMemo(() => allOpenings.length, [allOpenings.length]);

  const difficultyStats = useMemo(() => ({
    beginner: allOpenings.filter(o => o.difficulty === 'beginner').length,
    intermediate: allOpenings.filter(o => o.difficulty === 'intermediate').length,
    advanced: allOpenings.filter(o => o.difficulty === 'advanced').length,
  }), [allOpenings]);

  // Effect to update openings when displayCount changes (separate from search)
  useEffect(() => {
    if (!allOpenings.length) return;

    const updateDisplayedOpenings = () => {
      if (!searchTerm.trim()) {
        const popularOpenings = allOpenings
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, displayCount);
        setOpenings(popularOpenings);
      } else {
        const filtered = allOpenings.filter(opening => 
          opening.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opening.eco.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opening.moves.toLowerCase().includes(searchTerm.toLowerCase()) ||
          opening.aliases.some(alias => 
            alias.toLowerCase().includes(searchTerm.toLowerCase())
          )
        ).slice(0, displayCount);
        setOpenings(filtered);
      }
    };

    updateDisplayedOpenings();
  }, [displayCount, searchTerm, allOpenings]);

  // Effect to select first opening when openings change
  useEffect(() => {
    if (openings.length > 0 && !selectedOpening) {
      setSelectedOpening(openings[0]);
    }
  }, [openings, selectedOpening]);

  // Demo data fallback
  const getDemoOpenings = (): Opening[] => {
    return [
      {
        id: "ruy-lopez",
        name: "Ruy Lopez",
        eco: "C60-C99",
        moves: "e4 e5 Nf3 Nc6 Bb5",
        difficulty: "intermediate",
        popularity: 85,
        aliases: ["Spanish Opening"],
        variations: [],
        keyIdeas: ["Control the center", "Develop pieces", "Prepare kingside castling"],
        description: "One of the oldest and most classic of all openings, the Ruy Lopez is a great way for White to start the game."
      },
      {
        id: "sicilian-defense",
        name: "Sicilian Defense",
        eco: "B20-B99",
        moves: "e4 c5",
        difficulty: "advanced",
        popularity: 78,
        aliases: ["Sicilian"],
        variations: [],
        keyIdeas: ["Asymmetrical position", "Counter-attack", "Queenside play"],
        description: "The most popular and best-scoring response to White's first move 1.e4."
      },
    ];
  };

  if (loading) {
    return (
      <>
        <Head><title>Tembo — Openings Trainer</title></Head>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
          <Typography variant="h6" sx={{ ml: 2 }}>Loading Openings...</Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Tembo — Openings Trainer</title>
        <meta name="description" content="Learn and practice chess openings with Tembo's interactive training" />
      </Head>

      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box textAlign="center" mb={4}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>Chess Openings Trainer</Typography>
          <Typography variant="h6" color="text.secondary" maxWidth="800px" mx="auto">
            Master chess openings with instant search and interactive learning
          </Typography>
          {initializing && (
            <Alert severity="info" sx={{ mt: 2, maxWidth: 400, mx: 'auto' }}>Loading opening database...</Alert>
          )}
        </Box>

        {error && <Alert severity="warning" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>{error}</Alert>}

        <Grid container spacing={3}>
          {/* Openings List */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ maxHeight: '70vh', overflow: 'auto' }} ref={listRef}>
              <Box p={2}>
                <Typography variant="h6" gutterBottom>Available Openings ({totalOpeningsCount})</Typography>
                
                <TextField
                  fullWidth size="small" placeholder="Search by name, ECO, or moves..." value={searchTerm}
                  onChange={handleSearchChange} InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                    endAdornment: searchTerm && (
                      <InputAdornment position="end"><Button size="small" onClick={clearSearch}>Clear</Button></InputAdornment>
                    )
                  }} sx={{ mb: 2 }}
                />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Quick Navigation:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {getAlphabetIndex.map(letter => {
                      const hasOpenings = allOpenings.some(opening => opening.name.charAt(0).toUpperCase() === letter);
                      return (
                        <Button key={letter} size="small" variant={hasOpenings ? "contained" : "outlined"}
                          onClick={() => handleLetterClick(letter)} sx={{ minWidth: 32, height: 32, fontSize: '0.75rem',
                            backgroundColor: hasOpenings ? alpha(theme.palette.primary.main, 0.8) : 'transparent' }}>
                          {letter}
                        </Button>
                      );
                    })}
                    <Button size="small" variant={searchTerm ? "outlined" : "contained"} onClick={clearSearch}
                      sx={{ minWidth: 32, height: 32, fontSize: '0.75rem' }}>All</Button>
                  </Box>
                </Box>

                <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                  <Typography variant="caption"><strong>Tip:</strong> Click to select and auto-scroll, double-click to study opening</Typography>
                </Alert>
              </Box>
              
              <Divider />
              
              <List dense sx={{ p: 0 }}>
                {openings.map((opening) => (
                  <React.Fragment key={opening.id}>
                    <OpeningListItem opening={opening} selected={selectedOpening?.id === opening.id}
                      onClick={() => handleOpeningSelect(opening)} onDoubleClick={() => handleOpeningDoubleClick(opening)}
                      getDifficultyColor={getDifficultyColor} listItemRef={setOpeningRef(opening.id)} />
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
              
              {openings.length === 0 && (
                <Box p={3} textAlign="center">
                  <Typography color="text.secondary">No openings found matching "{searchTerm}".</Typography>
                  <Button onClick={clearSearch} sx={{ mt: 1 }}>Show all openings</Button>
                </Box>
              )}

              {hasMore && (
                <Box p={2} display="flex" justifyContent="center">
                  <Button variant="outlined" onClick={loadMore}>Load More Openings</Button>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Opening Details */}
          <Grid item xs={12} md={8}>
            {!selectedOpening ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>Select an Opening</Typography>
                <Typography color="text.secondary">Choose an opening from the list to view details and start learning</Typography>
              </Paper>
            ) : (
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" fontWeight="bold" gutterBottom>{selectedOpening.name}</Typography>
                    <Box display="flex" gap={1} alignItems="center" mb={1} flexWrap="wrap">
                      <Chip label={selectedOpening.eco} variant="outlined" />
                      <Chip label={selectedOpening.difficulty} color={getDifficultyColor(selectedOpening.difficulty)} />
                      <Chip label={`${selectedOpening.popularity}% Popular`} variant="outlined" size="small" />
                    </Box>
                    {selectedOpening.aliases.length > 0 && (
                      <Typography variant="body2" color="text.secondary"><strong>Also known as:</strong> {selectedOpening.aliases.join(', ')}</Typography>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box display="flex" gap={2} flexWrap="wrap" sx={{ mb: 3 }}>
                  <Button variant="contained" size="large" onClick={() => handleStudyOpening(selectedOpening)} sx={{ minWidth: 140 }}>📚 Study Opening</Button>
                  <Button variant="outlined" size="large" onClick={() => handlePracticeOpening(selectedOpening)} sx={{ minWidth: 140 }}>🎯 Practice</Button>
                  <Button variant="outlined" size="large" onClick={() => handleQuickPractice(selectedOpening)} sx={{ minWidth: 140 }}>⚡ Quick Test</Button>
                </Box>

                {selectedOpening.description && (
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent><Typography variant="h6" gutterBottom>Description</Typography>
                      <Typography variant="body1">{selectedOpening.description}</Typography></CardContent>
                  </Card>
                )}

                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent><Typography variant="h6" gutterBottom>Main Line</Typography>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', fontFamily: 'monospace', fontSize: '1.1rem', borderRadius: 1 }}>
                      {selectedOpening.moves}</Paper></CardContent>
                </Card>

                {selectedOpening.keyIdeas && selectedOpening.keyIdeas.length > 0 && (
                  <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent><Typography variant="h6" gutterBottom>Key Ideas</Typography>
                      <List dense>{selectedOpening.keyIdeas.map((idea, index) => (
                        <Typography key={index} variant="body2" component="li" sx={{ mb: 1 }}>{idea}</Typography>
                      ))}</List></CardContent>
                  </Card>
                )}

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {[
                    { value: selectedOpening.difficulty, label: 'Difficulty', color: 'primary' },
                    { value: `${selectedOpening.popularity}%`, label: 'Popularity', color: 'secondary' },
                    { value: selectedOpening.aliases.length, label: 'Aliases', color: 'info.main' },
                    { value: selectedOpening.eco, label: 'ECO', color: 'success.main' }
                  ].map((stat, index) => (
                    <Grid item xs={6} sm={3} key={index}>
                      <Card variant="outlined"><CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6" color={stat.color as any}>{stat.value}</Typography>
                        <Typography variant="body2">{stat.label}</Typography></CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </Grid>
        </Grid>

        <Box mt={6} textAlign="center">
          <Typography variant="h5" gutterBottom>Opening Database</Typography>
          <Grid container spacing={3} justifyContent="center">
            {[
              { value: totalOpeningsCount, label: 'Total Openings', color: 'primary' },
              { value: difficultyStats.beginner, label: 'Beginner', color: 'success.main' },
              { value: difficultyStats.intermediate, label: 'Intermediate', color: 'warning.main' },
              { value: difficultyStats.advanced, label: 'Advanced', color: 'error.main' }
            ].map((stat, index) => (
              <Grid item xs={12} sm={3} key={index}>
                <Card><CardContent>
                  <Typography variant="h3" color={stat.color as any} gutterBottom>{stat.value}</Typography>
                  <Typography variant="h6">{stat.label}</Typography></CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </>
  );
}