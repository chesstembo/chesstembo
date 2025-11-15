import { Box, Typography, Paper, Container, Link } from "@mui/material";
import Head from "next/head";
import { useRouter } from "next/router";

export default function TermsOfServicePage() {
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Terms of Service | Tembo Chess</title>
      </Head>

      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            Terms of Service
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last updated: {new Date().toLocaleDateString()}
          </Typography>

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1" paragraph>
              By using Tembo Chess, you agree to these terms and our Privacy Policy.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              2. User Accounts
            </Typography>
            <Typography variant="body1" paragraph>
              You are responsible for maintaining the security of your account and all activities that occur under it.
            </Typography>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              3. Acceptable Use
            </Typography>
            <Typography variant="body1" paragraph>
              You agree not to misuse the service or help others do so. This includes:
            </Typography>
            <ul>
              <li>Cheating or exploiting vulnerabilities</li>
              <li>Creating multiple accounts to manipulate leaderboards</li>
              <li>Attempting to access other users' accounts</li>
            </ul>

            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              4. Intellectual Property
            </Typography>
            <Typography variant="body1" paragraph>
              All chess puzzles and training content are proprietary to Tembo Chess.
            </Typography>

            <Typography variant="body1" sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              Questions? Contact us at{" "}
              <Link href="mailto:chesstembo@gmail.com">chesstembo@gmail.com</Link>
            </Typography>
          </Box>

          <Box sx={{ mt: 4 }}>
            <Link 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                router.back();
              }}
              sx={{ textDecoration: 'none' }}
            >
              ← Back to App
            </Link>
          </Box>
        </Paper>
      </Container>
    </>
  );
}