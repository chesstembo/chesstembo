// pages/profile.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  auth,
  ensureUserDoc,
  getAuthErrorMessage,
  getUserStats,
  UserStats
} from "../lib/firebaseClient";
import {
  onAuthStateChanged,
  User,
  signOut
} from "firebase/auth";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Divider,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Grid,
  Avatar
} from "@mui/material";
import {
  Logout,
  AccountCircle,
  BarChart,
  TrendingUp,
  CalendarToday,
  Star,
  EmojiEvents,
  Settings,
  Delete,
  Download,
  Security
} from "@mui/icons-material";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Ensure user document exists
          await ensureUserDoc(currentUser.uid, {
            email: currentUser.email || undefined,
            displayName: currentUser.displayName || undefined,
            photoURL: currentUser.photoURL || undefined,
          });
          
          // Load user stats
          const userStats = await getUserStats(currentUser.uid);
          setStats(userStats);
        } catch (error) {
          console.error('Error loading user data:', error);
          setMessage({ type: 'error', text: 'Failed to load user statistics' });
        }
      } else {
        // No user, redirect to login
        router.push('/login');
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setMessage({ type: 'success', text: 'Successfully logged out' });
      setTimeout(() => router.push('/'), 1000);
    } catch (err: any) {
      console.error('Logout error:', err);
      const errorMessage = getAuthErrorMessage(err);
      setMessage({ type: 'error', text: `Logout failed: ${errorMessage}` });
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // Note: This is a placeholder - actual account deletion requires additional security steps
    setMessage({ type: 'error', text: 'Account deletion feature coming soon. Please contact support for now.' });
    setShowDeleteDialog(false);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getJoinDuration = (creationTime: string) => {
    const joinDate = new Date(creationTime);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - joinDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f8f9fa"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="h6">Loading your profile...</Typography>
        </Paper>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f8f9fa"
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <Typography variant="h6" gutterBottom>
            Please sign in
          </Typography>
          <Button
            variant="contained"
            onClick={() => router.push('/login')}
            sx={{ mt: 2 }}
          >
            Go to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Profile | Tembo Chess</title>
      </Head>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        aria-labelledby="logout-dialog-title"
      >
        <DialogTitle id="logout-dialog-title">
          Confirm Logout
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to logout? Your progress is saved and you can sign back in anytime.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogoutDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleLogout} color="primary" variant="contained">
            Logout
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Account
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone. All your progress, statistics, and account data will be permanently deleted.
            </Alert>
            Are you sure you want to delete your account?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAccount} color="error" variant="contained">
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        minHeight="100vh"
        bgcolor="#f8f9fa"
        py={4}
        px={2}
      >
        <Box maxWidth="800px" margin="0 auto">
          {/* Header */}
          <Paper
            elevation={2}
            sx={{
              p: 3,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              mb: 3
            }}
          >
            <Box display="flex" alignItems="center" gap={3}>
              <Avatar
                src={user.photoURL || undefined}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  border: '3px solid rgba(255,255,255,0.3)'
                }}
              >
                <AccountCircle sx={{ fontSize: 60 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {user.displayName || 'Chess Player'}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {user.email}
                </Typography>
                <Chip 
                  label={`Member for ${getJoinDuration(user.metadata.creationTime!)}`}
                  sx={{ 
                    mt: 1, 
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white'
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {message && (
            <Alert 
              severity={message.type} 
              sx={{ mb: 3 }}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Statistics Section */}
            <Grid item xs={12} md={8}>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChart /> Your Chess Statistics
              </Typography>

              <Grid container spacing={2}>
                {/* Puzzle Stats */}
                <Grid item xs={12} sm={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Star color="primary" />
                        <Typography variant="h6">Puzzle Progress</Typography>
                      </Box>
                      <Typography variant="h3" color="primary" fontWeight="bold">
                        {stats?.totalPuzzlesCompleted || 0}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Puzzles Completed
                      </Typography>
                      <Box mt={1}>
                        <Chip 
                          size="small" 
                          label={`${stats?.currentStreak || 0} day streak`}
                          color="success"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Performance Stats */}
                <Grid item xs={12} sm={6}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <TrendingUp color="secondary" />
                        <Typography variant="h6">Performance</Typography>
                      </Box>
                      <Typography variant="h3" color="secondary" fontWeight="bold">
                        {stats?.successRate ? `${Math.round(stats.successRate)}%` : '0%'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                      <Box mt={1}>
                        <Chip 
                          size="small" 
                          label={`Best: ${stats?.bestRating || 0}`}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Recent Activity */}
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarToday /> Recent Activity
                      </Typography>
                      {stats?.lastPlayed ? (
                        <Typography>
                          Last played: {formatDate(stats.lastPlayed)}
                        </Typography>
                      ) : (
                        <Typography color="text.secondary">
                          No recent activity
                        </Typography>
                      )}
                      {stats?.favoriteOpening && (
                        <Typography sx={{ mt: 1 }}>
                          Favorite Opening: <Chip label={stats.favoriteOpening} size="small" />
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Grid>

            {/* Account Actions */}
            <Grid item xs={12} md={4}>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Settings /> Account
              </Typography>

              <Card>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Security color="info" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Account Security" 
                      secondary="Manage your login methods"
                    />
                  </ListItem>
                  <Divider />

                  <ListItem>
                    <ListItemIcon>
                      <Download color="action" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Export Data" 
                      secondary="Download your progress"
                    />
                  </ListItem>
                  <Divider />

                  <ListItem 
                    button 
                    onClick={() => setShowLogoutDialog(true)}
                    sx={{ color: 'primary.main' }}
                  >
                    <ListItemIcon>
                      <Logout color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Logout" 
                      secondary="Sign out of your account"
                    />
                  </ListItem>
                  <Divider />

                  <ListItem 
                    button 
                    onClick={() => setShowDeleteDialog(true)}
                    sx={{ color: 'error.main' }}
                  >
                    <ListItemIcon>
                      <Delete color="error" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Delete Account" 
                      secondary="Permanently remove your account"
                    />
                  </ListItem>
                </List>
              </Card>

              {/* Quick Stats */}
              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Quick Stats
                  </Typography>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Puzzles Today:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats?.puzzlesToday || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">This Week:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats?.puzzlesThisWeek || 0}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2">This Month:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats?.puzzlesThisMonth || 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </>
  );
}