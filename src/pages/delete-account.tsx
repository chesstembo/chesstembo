// pages/delete-account.tsx
import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { auth, db } from "../lib/firebaseClient";
import { onAuthStateChanged, deleteUser, User } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Container
} from "@mui/material";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async () => {
    if (!user) {
      setMessage({ type: "error", text: "No user authenticated." });
      return;
    }

    try {
      setDeleting(true);

      // Delete Firestore user document
      await deleteDoc(doc(db, "users", user.uid));

      // Delete the user from Firebase Authentication
      await deleteUser(user);

      setMessage({
        type: "success",
        text: "Your account and all associated data have been deleted successfully."
      });

      setTimeout(() => {
        router.push("/");
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setMessage({
        type: "error",
        text: err.message || "Failed to delete account."
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box minHeight="100vh" display="flex" justifyContent="center" alignItems="center">
        <Paper sx={{ p: 4, maxWidth: 400, textAlign: "center" }}>
          <Typography variant="h6">You must be logged in</Typography>
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => router.push("/login")}>
            Go to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>Delete Account | Tembo Chess</title>
      </Head>

      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Delete Your Account
          </Typography>

          <Alert severity="warning" sx={{ mb: 3 }}>
            This action is <b>permanent</b>. All your progress, data, and account information will be permanently deleted.
          </Alert>

          {message && (
            <Alert severity={message.type} sx={{ mb: 2 }}>
              {message.text}
            </Alert>
          )}

          <Button
            variant="contained"
            color="error"
            fullWidth
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete My Account"}
          </Button>

          <Button
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => router.push("/profile")}
          >
            Cancel
          </Button>
        </Paper>
      </Container>
    </>
  );
}
