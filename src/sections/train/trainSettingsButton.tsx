import { Button, Grid2 as Grid } from "@mui/material";
import { useState } from "react";

export default function TrainSettingsButton({ onStart }: { onStart: () => void }) {
  const [difficulty, setDifficulty] = useState("easy");
  const [theme, setTheme] = useState("tactics");

  return (
    <Grid container justifyContent="center" alignItems="center" gap={2} size={12}>
      <Button
        variant="contained"
        color="primary"
        onClick={() => onStart()}
        sx={{ minWidth: 200 }}
      >
        Start Training
      </Button>

      <Button
        variant="outlined"
        sx={{ minWidth: 200 }}
        onClick={() =>
          alert(`Mode: ${difficulty}, Theme: ${theme} — Settings panel coming soon`)
        }
      >
        Change Settings
      </Button>
    </Grid>
  );
}
