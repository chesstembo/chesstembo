// pages/download.tsx
import Head from "next/head";
import Image from "next/image";
import {
  Box,
  Typography,
  Button,
  Paper,
  useTheme,
} from "@mui/material";
import { Icon } from "@iconify/react";

export default function DownloadPage() {
  const theme = useTheme();

  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.chesstembo.app";

  return (
    <>
      <Head>
        <title>Download Chess Tembo</title>
      </Head>

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
            p: { xs: 2, sm: 4 },
            width: "100%",
            maxWidth: 900,
            borderRadius: 3,
            backgroundColor: theme.palette.background.paper,
            textAlign: "center",
          }}
        >
          <Typography
            variant="h3"
            fontWeight="bold"
            color="primary"
            gutterBottom
          >
            Play Chess. Improve Every Day.
          </Typography>

          <Typography variant="h6" color="text.secondary" mb={3}>
            Free powerful chess engines • Game analysis • Openings • Puzzles • Offline play
          </Typography>

          {/* Download Button */}
          <Button
            variant="contained"
            size="large"
            href={playStoreUrl}
            target="_blank"
            startIcon={<Icon icon="mdi:google-play" />}
            sx={{
              mb: 4,
              px: 4,
              py: 1.5,
              fontSize: "1.1rem",
            }}
          >
            Download on Google Play
          </Button>

          {/* Screenshots */}
          <Box
            display="grid"
            gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr 1fr" }}
            gap={2}
          >
            <Image
              src="/screenshot1.jpg"
              alt="Chess Tembo Screenshot 1"
              width={300}
              height={600}
              style={{ width: "100%", height: "auto", borderRadius: 12 }}
            />
            <Image
              src="/screenshot2.jpg"
              alt="Chess Tembo Screenshot 2"
              width={300}
              height={600}
              style={{ width: "100%", height: "auto", borderRadius: 12 }}
            />
            <Image
              src="/screenshot3.jpg"
              alt="Chess Tembo Screenshot 3"
              width={300}
              height={600}
              style={{ width: "100%", height: "auto", borderRadius: 12 }}
            />
          </Box>

          <Typography variant="body2" color="text.secondary" mt={4}>
            Available for Android phones, tablets, Chromebooks and Google Play Games on PC.
          </Typography>
        </Paper>
      </Box>
    </>
  );
          }
