// src/pages/train/index.tsx
import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
  useTheme,
  Alert,
} from "@mui/material";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import usePuzzleSets from "../../hooks/usePuzzleSets";

export default function TrainHomePage() {
  const router = useRouter();
  const theme = useTheme();
  const { sets, loading, error, downloadSet, deleteSet } = usePuzzleSets();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const handleDownload = async (id: string) => {
    setDownloading(id);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return p + 10;
      });
    }, 300);

    try {
      await downloadSet(id, (p: number) => setProgress(p));
      setProgress(100);
      setTimeout(() => {
        clearInterval(interval);
        setDownloading(null);
      }, 600);
    } catch (err) {
      clearInterval(interval);
      setDownloading(null);
      
    }
  };

  return (
    <>
      <Head>
        <title>Tembo — Train</title>
        <meta
          name="description"
          content="Sharpen your chess instincts with Tembo's training modes — puzzles and openings."
        />
      </Head>

      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="80vh"
        px={3}
        textAlign="center"
      >
        <Typography
          variant="h3"
          fontWeight={800}
          mb={2}
          sx={{ fontFamily: "'Playfair Display', serif" }}
        >
          Train Like a Grandmaster 🧩
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          maxWidth="700px"
          mb={5}
        >
          Boost your tactical vision and refine your openings — Tembo's training hub is your path to mastery.
        </Typography>

        <Grid
          container
          spacing={4}
          justifyContent="center"
          alignItems="stretch"
          maxWidth="900px"
        >
          <Grid item xs={12} sm={6} md={6}>
            <Paper
              elevation={4}
              sx={{
                p: 4,
                borderRadius: 3,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "0.3s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: `0px 6px 16px ${theme.palette.primary.main}30`,
                },
              }}
            >
              <SportsEsportsIcon
                fontSize="large"
                color="primary"
                sx={{ mb: 2 }}
              />
              <Typography variant="h5" fontWeight={700}>
                Train with Puzzles
              </Typography>
              <Typography variant="body2" color="text.secondary" my={2}>
                Solve tactical challenges, improve your calculation speed, and track your progress.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => {
                  const puzzleSection = document.getElementById("puzzle-packs");
                  if (puzzleSection)
                    puzzleSection.scrollIntoView({ behavior: "smooth" });
                }}
              >
                View Puzzle Packs
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} sm={6} md={6}>
            <Paper
              elevation={4}
              sx={{
                p: 4,
                borderRadius: 3,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                transition: "0.3s",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: `0px 6px 16px ${theme.palette.secondary.main}30`,
                },
              }}
            >
              <AutoGraphIcon
                fontSize="large"
                color="secondary"
                sx={{ mb: 2 }}
              />
              <Typography variant="h5" fontWeight={700}>
                Train Openings
              </Typography>
              <Typography variant="body2" color="text.secondary" my={2}>
                Learn powerful opening systems, study variations, and test your understanding interactively.
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                size="large"
                onClick={() => router.push("/train/openings")}
              >
                Start Openings Training
              </Button>
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 6, width: "80%" }} />

        <Typography variant="body2" color="text.secondary" mt={2}>
          🎯 Tip: Sign in to save progress and synchronize your training stats.
        </Typography>
      </Box>

      <Box
        id="puzzle-packs"
        py={8}
        px={3}
        bgcolor={theme.palette.background.default}
      >
        <Typography
          variant="h4"
          textAlign="center"
          fontWeight={700}
          mb={4}
          sx={{ fontFamily: "'Playfair Display', serif" }}
        >
          Puzzle Packs
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ maxWidth: 600, mx: 'auto' }}>
            {error}
          </Alert>
        ) : (
          <Grid container spacing={3} justifyContent="center">
            {sets.map((s) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                <Card
                  elevation={4}
                  sx={{
                    borderRadius: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "0.3s",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: `0 6px 12px ${theme.palette.primary.main}30`,
                    },
                    opacity: s.isPremium ? 0.9 : 1,
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight={700}>
                      {s.name} {s.isPremium && "🔒"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      {s.count.toLocaleString()} puzzles
                    </Typography>

                    {downloading === s.id && (
                      <Box mt={2}>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 8,
                            borderRadius: 2,
                          }}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          mt={0.5}
                        >
                          Downloading... {progress}%
                        </Typography>
                      </Box>
                    )}

                    <Box mt={2} display="flex" gap={1}>
                      {s.downloaded ? (
                        <>
                          <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={() =>
                              router.push(`/train/puzzles?set=${s.id}`)
                            }
                          >
                            Play
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            onClick={() => deleteSet(s.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : (
                        !downloading && (
                          <Button
                            fullWidth
                            variant="outlined"
                            color="primary"
                            onClick={() =>
                              s.isPremium
                                ? alert("🔒 This pack is available for premium users only.")
                                : handleDownload(s.id)
                            }
                          >
                            {s.isPremium ? "Premium" : "⬇️ Download"}
                          </Button>
                        )
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </>
  );
}