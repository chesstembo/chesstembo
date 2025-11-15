import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  auth,
  sendMagicLink,
  ensureUserDoc,
  signInWithGoogle,
  isMagicLink,
  getStoredEmail,
  clearAuthStorage,
  getAuthErrorMessage,
} from "../lib/firebaseClient";
import {
  onAuthStateChanged,
  User,
  isSignInWithEmailLink,
  signInWithEmailLink,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError,
  linkWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  CircularProgress, 
  Paper,
  Alert,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Link,
  useTheme,
  useMediaQuery
} from "@mui/material";
import { Google, Email, VpnKey } from "@mui/icons-material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [showAnonymousDialog, setShowAnonymousDialog] = useState(false);
  const [anonymousAction, setAnonymousAction] = useState<() => Promise<void>>(() => async () => {});

  // ✅ Check if user is anonymous (has no email/password provider)
  const isAnonymousUser = (user: User | null): boolean => {
    if (!user) return false;
    
    // Check if user has no linked email/password account
    const hasEmailProvider = user.providerData.some(
      provider => provider.providerId === 'password'
    );
    
    // If user is authenticated but has no email provider, treat as anonymous
    // or if user has no provider data at all (fresh anonymous user)
    return !hasEmailProvider && user.providerData.length === 0;
  };

  // ✅ Enhanced magic link detection with new utilities
  useEffect(() => {
    const handleMagicLink = async () => {
      if (isMagicLink()) {
        setLoading(true);
        try {
          let email = getStoredEmail();
          
          if (!email) {
            email = window.prompt('Please provide your email for confirmation');
          }

          if (email) {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            clearAuthStorage();
            
            setMessage({ type: 'success', text: '✅ Successfully signed in!' });
            setTimeout(() => router.push('/'), 1500);
          } else {
            setMessage({ type: 'error', text: '❌ Email is required.' });
            setLoading(false);
          }
        } catch (err: any) {
          console.error('Magic link confirmation error:', err);
          const errorMessage = getAuthErrorMessage(err);
          setMessage({ 
            type: 'error', 
            text: `❌ ${errorMessage}` 
          });
          setLoading(false);
        }
      } else {
        setIsCheckingAuth(false);
      }
    };

    handleMagicLink();
  }, [router]);

  // ✅ Enhanced auth state tracking - don't auto-redirect anonymous users
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsCheckingAuth(false);
      
      // Only auto-redirect if user is properly authenticated (has email provider)
      if (currentUser && !isMagicLink() && !isAnonymousUser(currentUser)) {
        setTimeout(() => router.push('/'), 1000);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ✅ Handle authentication for anonymous users
  const handleAnonymousAuth = async (authFunction: () => Promise<void>) => {
    if (user && isAnonymousUser(user)) {
      // Show dialog to confirm linking account
      setAnonymousAction(() => authFunction);
      setShowAnonymousDialog(true);
    } else {
      // Regular authentication flow
      await authFunction();
    }
  };

  // ✅ Confirm linking anonymous account
  const handleConfirmLinkAccount = async () => {
    setShowAnonymousDialog(false);
    setLoading(true);
    
    try {
      await anonymousAction();
    } catch (error) {
      console.error('Error linking account:', error);
      setLoading(false);
    }
  };

  // ✅ Cancel linking anonymous account
  const handleCancelLinkAccount = () => {
    setShowAnonymousDialog(false);
    // User can continue as anonymous or try different login method
  };

  // ✅ Enhanced Magic Link Login with better error handling
  const handleMagicLinkLogin = async () => {
    if (!email) {
      setMessage({ type: 'error', text: '❌ Please enter your email address.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage({ type: 'error', text: '❌ Please enter a valid email address.' });
      return;
    }

    await handleAnonymousAuth(async () => {
      try {
        setLoading(true);
        setMessage(null);
        
        await sendMagicLink(email);
        setMessage({ 
          type: 'success', 
          text: `📧 Login link sent to ${email}. Check your inbox!` 
        });
        setEmail("");
      } catch (err: any) {
        console.error('Magic link error:', err);
        const errorMessage = getAuthErrorMessage(err);
        setMessage({ type: 'error', text: `❌ ${errorMessage}` });
        
        // Switch to Google tab if magic link is not enabled
        if (err.code === 'auth/operation-not-allowed') {
          setTabValue(1);
        }
      } finally {
        setLoading(false);
      }
    });
  };

  // ✅ Email/Password Login (Fallback)
  const handleEmailPasswordLogin = async () => {
    if (!email || !password) {
      setMessage({ type: 'error', text: '❌ Please enter both email and password.' });
      return;
    }

    await handleAnonymousAuth(async () => {
      try {
        setLoading(true);
        setMessage(null);
        
        let result;
        let signInError = null;
        
        try {
          // Try to sign in
          result = await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
          signInError = error;
          if (error.code === 'auth/user-not-found') {
            // Create new user with demo password
            result = await createUserWithEmailAndPassword(auth, email, password);
            setMessage({ type: 'success', text: '✅ Account created! Welcome to Tembo Chess!' });
          } else if (error.code === 'auth/wrong-password') {
            setMessage({ type: 'error', text: '❌ Incorrect password. Try "chess123" or create a new account.' });
            setLoading(false);
            return;
          } else {
            throw error;
          }
        }
        
        if (result) {
          await ensureUserDoc(result.user.uid, {
            email: result.user.email || undefined,
          });
          
          if (!signInError) {
            setMessage({ type: 'success', text: '✅ Successfully signed in!' });
          }
          
          setTimeout(() => router.push('/'), 1000);
        }
        
      } catch (err: any) {
        console.error('Email/password login error:', err);
        const errorMessage = getAuthErrorMessage(err);
        setMessage({ 
          type: 'error', 
          text: `❌ ${errorMessage}` 
        });
        setLoading(false);
      }
    });
  };

  // ✅ Enhanced Google Login with new utility
  const handleGoogleLogin = async () => {
    await handleAnonymousAuth(async () => {
      try {
        setLoading(true);
        setMessage(null);
        
        const result = await signInWithGoogle();
        
        setMessage({ type: 'success', text: '✅ Successfully signed in with Google!' });
        setTimeout(() => router.push('/'), 1000);
        
      } catch (err: any) {
        console.error('Google sign-in error:', err);
        const errorMessage = getAuthErrorMessage(err);
        setMessage({ type: 'error', text: `❌ ${errorMessage}` });
        setLoading(false);
      }
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setMessage(null);
  };

  // Show loading while checking authentication state
  if (isCheckingAuth) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor={theme.palette.background.default}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 2,
            textAlign: "center",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="h6">Checking authentication...</Typography>
        </Paper>
      </Box>
    );
  }

  // Only auto-redirect if user is properly authenticated (not anonymous)
  if (user && !isMagicLink() && !isAnonymousUser(user)) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor={theme.palette.background.default}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 2,
            textAlign: "center",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography variant="h5" gutterBottom color="success.main">
            Welcome back! 🎉
          </Typography>
          <Typography variant="body1" mb={2}>
            Signed in as <strong>{user.email}</strong>
          </Typography>
          <CircularProgress size={24} sx={{ mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Redirecting to homepage...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Login | Tembo Chess</title>
      </Head>

      {/* Anonymous User Dialog */}
      <Dialog
        open={showAnonymousDialog}
        onClose={handleCancelLinkAccount}
        aria-labelledby="anonymous-dialog-title"
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
          }
        }}
      >
        <DialogTitle id="anonymous-dialog-title">
          Link Your Account?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            We noticed you've been playing as a guest. Would you like to link your progress to an account? 
            This will allow you to access your stats from any device and save your progress permanently.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelLinkAccount} color="primary">
            Continue as Guest
          </Button>
          <Button onClick={handleConfirmLinkAccount} color="primary" variant="contained" autoFocus>
            Link Account
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor={theme.palette.background.default}
        p={2}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3 },
            width: "100%",
            maxWidth: 400,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            color="primary" 
            fontWeight="bold" 
            textAlign="center"
            fontSize={{ xs: '1.75rem', sm: '2.125rem' }}
          >
            Tembo Chess
          </Typography>
          
          <Typography 
            variant="h6" 
            component="h2" 
            mb={2} 
            color="text.secondary" 
            textAlign="center"
            fontSize={{ xs: '1rem', sm: '1.25rem' }}
          >
            {user && isAnonymousUser(user) ? "Link Your Account to Save Progress" : "Login to Your Account"}
          </Typography>

          {user && isAnonymousUser(user) && (
            <Alert 
              severity="info" 
              sx={{ 
                mb: 2,
                backgroundColor: theme.palette.info.light,
                color: theme.palette.info.contrastText,
              }}
            >
              You're currently playing as a guest. Sign in to save your progress permanently!
            </Alert>
          )}

          {message && (
            <Alert 
              severity={message.type} 
              sx={{ mb: 2 }}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}

          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            centered 
            sx={{ mb: 1 }}
            variant={isMobile ? "fullWidth" : "standard"}
          >
            <Tab icon={<Email />} label={isMobile ? "Email" : "Email Link"} />
            <Tab icon={<Google />} label="Google" />
            <Tab icon={<VpnKey />} label="Password" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <TextField
              fullWidth
              type="email"
              label="Email Address"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="your@email.com"
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleMagicLinkLogin}
              disabled={loading || !email}
              sx={{ py: 1.2 }}
            >
              {loading ? <CircularProgress size={20} /> : "Send Magic Link"}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              We'll email you a secure login link
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleGoogleLogin}
              disabled={loading}
              startIcon={<Google />}
              sx={{ py: 1.2 }}
            >
              {loading ? <CircularProgress size={20} /> : "Sign in with Google"}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Fast and secure Google sign-in
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <TextField
              fullWidth
              type="email"
              label="Email Address"
              variant="outlined"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Use any password"
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleEmailPasswordLogin}
              disabled={loading || !email || !password}
              sx={{ py: 1.2 }}
            >
              {loading ? <CircularProgress size={20} /> : "Sign In / Create Account"}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
              Use any password - we'll create your account
            </Typography>
          </TabPanel>

          {/* Terms Acceptance */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              By continuing, you agree to our{" "}
              <Link 
                href="/privacy-policy.html" 
                target="_blank"
                sx={{ 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  color: theme.palette.primary.main,
                  '&:hover': {
                    color: theme.palette.primary.dark,
                  }
                }}
              >
                Privacy Policy
              </Link>
              {" "}and{" "}
              <Link 
                href="/terms-of-service.html" 
                target="_blank"
                sx={{ 
                  cursor: 'pointer', 
                  fontWeight: 'bold',
                  color: theme.palette.primary.main,
                  '&:hover': {
                    color: theme.palette.primary.dark,
                  }
                }}
              >
                Terms of Service
              </Link>
            </Typography>
          </Box>

          {/* Track Your Progress Section - Theme Aware */}
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              mt: 2, 
              backgroundColor: theme.palette.mode === 'dark' 
                ? theme.palette.grey[900] 
                : theme.palette.grey[50],
              borderColor: theme.palette.mode === 'dark' 
                ? theme.palette.grey[700] 
                : theme.palette.grey[300],
            }}
          >
            <Typography 
              variant="body2" 
              color="text.primary"
              fontWeight="bold"
              sx={{ mb: 1 }}
            >
              Track your progress:
            </Typography>
            <Box 
              component="ul" 
              sx={{ 
                pl: 2, 
                mt: 0.5, 
                mb: 0,
                '& li': {
                  color: theme.palette.text.secondary,
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                }
              }}
            >
              <li>Opening practice history</li>
              <li>Mastery statistics</li>
              <li>Personal best scores</li>
              <li>Training streaks</li>
              <li>Performance analytics</li>
            </Box>
          </Paper>
        </Paper>
      </Box>
    </>
  );
}