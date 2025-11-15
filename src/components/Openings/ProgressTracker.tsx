// src/components/Openings/ProgressTracker.tsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress
} from "@mui/material";
import {
  CheckCircle,
  Schedule,
  TrendingUp,
  EmojiEvents,
  Star
} from "@mui/icons-material";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, getOpeningProgress, OpeningProgress as FirebaseOpeningProgress } from "../../lib/firebaseClient";

interface ProgressTrackerProps {
  openingId?: string;
  onOpenOpening?: (openingId: string) => void;
}

interface OpeningProgress {
  id: string;
  name: string;
  eco: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastPracticed: Date | null;
  practiceCount: number;
  averageScore: number;
  mastered: boolean;
  nextReview: Date | null;
  bestScore?: number;
  totalSessions?: number;
}

interface OverallStats {
  totalOpenings: number;
  masteredOpenings: number;
  averageScore: number;
  totalPracticeSessions: number;
  streak: number;
}

export default function ProgressTracker({ openingId, onOpenOpening }: ProgressTrackerProps) {
  const [user] = useAuthState(auth);
  const [progress, setProgress] = useState<OpeningProgress[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalOpenings: 0,
    masteredOpenings: 0,
    averageScore: 0,
    totalPracticeSessions: 0,
    streak: 0
  });
  const [activeFilter, setActiveFilter] = useState<'all' | 'mastered' | 'needs-review'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProgressData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadProgressData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const firebaseProgress = await getOpeningProgress(user.uid);
      
      // Transform Firebase data to match our component interface
      const transformedProgress: OpeningProgress[] = Object.values(firebaseProgress).map((progressItem: FirebaseOpeningProgress) => {
        return {
          id: progressItem.openingId,
          name: progressItem.openingName,
          eco: progressItem.eco,
          difficulty: getDifficultyFromECO(progressItem.eco),
          lastPracticed: progressItem.lastPracticed?.toDate() || null,
          practiceCount: progressItem.practiceCount || 0,
          averageScore: progressItem.successRate || 0,
          mastered: progressItem.completed || false,
          nextReview: calculateNextReview(progressItem.lastPracticed?.toDate(), progressItem.successRate),
          bestScore: progressItem.bestScore,
          totalSessions: progressItem.practiceCount
        };
      });

      setProgress(transformedProgress);
      calculateStats(transformedProgress);
      
    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError('Failed to load progress data. Please try again.');
      // Don't load demo data for authenticated users
      setProgress([]);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyFromECO = (eco: string): 'beginner' | 'intermediate' | 'advanced' => {
    // Simple heuristic based on ECO code ranges
    if (eco.startsWith('A') || eco.startsWith('B')) return 'advanced';
    if (eco.startsWith('C') || eco.startsWith('D')) return 'intermediate';
    return 'beginner';
  };

  const calculateNextReview = (lastPracticed: Date | null, successRate: number = 0): Date | null => {
    if (!lastPracticed) return null;
    
    const nextReview = new Date(lastPracticed);
    const daysToAdd = successRate >= 90 ? 14 : successRate >= 70 ? 7 : 3;
    nextReview.setDate(nextReview.getDate() + daysToAdd);
    
    return nextReview;
  };

  const calculateStats = (progressData: OpeningProgress[]) => {
    const totalOpenings = progressData.length;
    const masteredOpenings = progressData.filter(p => p.mastered).length;
    
    const practicedOpenings = progressData.filter(p => p.practiceCount > 0);
    const averageScore = practicedOpenings.length > 0 
      ? practicedOpenings.reduce((sum, p) => sum + p.averageScore, 0) / practicedOpenings.length
      : 0;
    
    const totalPracticeSessions = progressData.reduce((sum, p) => sum + p.practiceCount, 0);
    
    // Calculate streak based on consecutive days with practice
    const streak = calculateStreak(progressData);

    setStats({
      totalOpenings,
      masteredOpenings,
      averageScore,
      totalPracticeSessions,
      streak
    });
  };

  const calculateStreak = (progressData: OpeningProgress[]): number => {
    if (progressData.length === 0) return 0;
    
    const today = new Date();
    const recentPractice = progressData.filter(p => 
      p.lastPracticed && 
      isSameDay(p.lastPracticed, today)
    );
    
    return recentPractice.length > 0 ? 1 : 0; // Simple streak calculation
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const filteredProgress = progress.filter(item => {
    switch (activeFilter) {
      case 'mastered':
        return item.mastered;
      case 'needs-review':
        return !item.mastered && item.practiceCount > 0;
      default:
        return true;
    }
  });

  const needsReview = progress.filter(p => 
    p.nextReview && p.nextReview <= new Date() && !p.mastered
  ).length;

  if (!user) {
    return (
      <Paper sx={{ p: 3, maxWidth: 1000, mx: 'auto', textAlign: 'center' }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Please sign in to track your opening progress
        </Alert>
        <Typography variant="body1" color="text.secondary">
          Your progress will be saved and synced across devices when you're signed in.
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper sx={{ p: 3, maxWidth: 1000, mx: 'auto', textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography variant="h6">Loading your progress...</Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Your Opening Progress
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Overall Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="primary" gutterBottom>
                {stats.totalOpenings}
              </Typography>
              <Typography variant="body2">
                Total Openings
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="success.main" gutterBottom>
                {stats.masteredOpenings}
              </Typography>
              <Typography variant="body2">
                Mastered
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="info.main" gutterBottom>
                {stats.averageScore.toFixed(0)}%
              </Typography>
              <Typography variant="body2">
                Average Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="secondary.main" gutterBottom>
                {stats.totalPracticeSessions}
              </Typography>
              <Typography variant="body2">
                Practice Sessions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h3" color="warning.main" gutterBottom>
                {stats.streak}
              </Typography>
              <Typography variant="body2">
                Day Streak
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progress Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Mastery Progress
            </Typography>
            <Chip 
              label={`${needsReview} need review`} 
              color={needsReview > 0 ? "warning" : "success"}
              variant="outlined"
            />
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={(stats.masteredOpenings / Math.max(stats.totalOpenings, 1)) * 100} 
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Box display="flex" justifyContent="space-between" mt={1}>
            <Typography variant="body2" color="text.secondary">
              {stats.masteredOpenings} of {stats.totalOpenings} openings mastered
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {((stats.masteredOpenings / Math.max(stats.totalOpenings, 1)) * 100).toFixed(1)}%
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Filter Buttons */}
      <Box display="flex" gap={1} mb={2}>
        <Button
          variant={activeFilter === 'all' ? 'contained' : 'outlined'}
          onClick={() => setActiveFilter('all')}
        >
          All Openings
        </Button>
        <Button
          variant={activeFilter === 'mastered' ? 'contained' : 'outlined'}
          onClick={() => setActiveFilter('mastered')}
        >
          Mastered
        </Button>
        <Button
          variant={activeFilter === 'needs-review' ? 'contained' : 'outlined'}
          onClick={() => setActiveFilter('needs-review')}
        >
          Needs Review
        </Button>
        <Button
          variant="outlined"
          onClick={loadProgressData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Opening List */}
      <List>
        {filteredProgress.map((item, index) => (
          <React.Fragment key={item.id}>
            <ListItem>
              <ListItemIcon>
                {item.mastered ? (
                  <CheckCircle color="success" />
                ) : item.practiceCount > 0 ? (
                  <TrendingUp color="warning" />
                ) : (
                  <Schedule color="disabled" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {item.eco} • {item.difficulty}
                      </Typography>
                    </Box>
                    <Box display="flex" gap={1} alignItems="center">
                      {item.mastered && <Star color="warning" />}
                      <Chip 
                        label={item.difficulty} 
                        size="small"
                        color={getDifficultyColor(item.difficulty) as any}
                      />
                      {item.practiceCount > 0 && (
                        <Chip 
                          label={`${item.averageScore}%`}
                          size="small"
                          color={getScoreColor(item.averageScore) as any}
                          variant="outlined"
                        />
                      )}
                      <Chip 
                        label={`${item.practiceCount}x`}
                        size="small"
                        variant="outlined"
                      />
                      {item.bestScore && item.bestScore > 0 && (
                        <Chip 
                          label={`Best: ${item.bestScore}%`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    {item.lastPracticed ? (
                      <Typography variant="caption" color="text.secondary">
                        Last practiced: {item.lastPracticed.toLocaleDateString()}
                        {item.nextReview && item.nextReview <= new Date() && (
                          <Chip 
                            label="Review Due" 
                            color="warning" 
                            size="small" 
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not practiced yet
                      </Typography>
                    )}
                  </Box>
                }
              />
              {onOpenOpening && (
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => onOpenOpening(item.id)}
                  sx={{ ml: 1 }}
                >
                  Practice
                </Button>
              )}
            </ListItem>
            {index < filteredProgress.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>

      {filteredProgress.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {activeFilter === 'all' 
            ? "No openings found. Start practicing to track your progress!"
            : `No openings match the "${activeFilter}" filter. Try practicing some openings!`
          }
        </Alert>
      )}
    </Paper>
  );
}