// pages/profile.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  auth,
  getAuthErrorMessage
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
  ListItemButton,
  Chip,
  Grid,
  Avatar,
  Container
} from "@mui/material";
import {
  Logout,
  AccountCircle,
  Settings,
  Delete,
  Download
} from "@mui/icons-material";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
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
    setMessage({ type: 'error', text: 'Account deletion feature coming soon. Please contact support for now.' });
    setShowDeleteDialog(false);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
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
      >
        <Container maxWidth="lg">
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
            <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
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
              <Box flex={1}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  {user.displayName || 'Chess Player'}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {user.email}
                </Typography>
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

          {/* Account Settings */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountCircle /> Account Information
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Display Name"
                        secondary={user.displayName || 'Not set'}
                      />
                      <Button size="small" variant="outlined">
                        Edit
                      </Button>
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Email"
                        secondary={user.email}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Member Since"
                        secondary={formatDate(user.metadata.creationTime)}
                      />
                    </ListItem>
                    <Divider />
                    <ListItem>
                      <ListItemText
                        primary="Last Sign In"
                        secondary={formatDate(user.metadata.lastSignInTime)}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Settings /> Actions
                  </Typography>
                  <List dense>
                    <ListItemButton 
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
                    </ListItemButton>
                    <Divider />
                    <ListItemButton>
                      <ListItemIcon>
                        <Download color="action" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Export Data" 
                        secondary="Download your progress"
                      />
                    </ListItemButton>
                    <Divider />
                    <ListItemButton 
                      onClick={() => setShowDeleteDialog(true)}
                      sx={{ color: 'error.main' }}
                    >
                      <ListItemIcon>
                        <Delete color="error" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Delete Account" 
                        secondary="Permanently remove account"
                      />
                    </ListItemButton>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}
