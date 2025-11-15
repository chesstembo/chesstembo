import { Button, Grid2 as Grid, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Slider, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { useState } from "react";
import { useSetAtom } from "jotai";
import { engineEloAtom, enginePlayNameAtom, playerColorAtom, isGameInProgressAtom } from "../states";
import { Color, EngineName } from "@/types/enums";
import { useRouter } from "next/router";

export default function GameSettingsButton() {
  const setEngineElo = useSetAtom(engineEloAtom);
  const setEnginePlayName = useSetAtom(enginePlayNameAtom);
  const setPlayerColor = useSetAtom(playerColorAtom);
  const setIsGameInProgress = useSetAtom(isGameInProgressAtom);

  const [openDialog, setOpenDialog] = useState(false);
  const [elo, setElo] = useState(800);
  const [engineVersion, setEngineVersion] = useState<EngineName>(EngineName.Stockfish17);
  const [color, setColor] = useState<Color>(Color.White);

  const router = useRouter();

  const handleConfirm = () => {
    setEngineElo(elo);
    setEnginePlayName(engineVersion);
    setPlayerColor(color);
    setIsGameInProgress(true);
    setOpenDialog(false);
  };

  const handlePlayOnline = () => {
    router.push("/play-online");
  };

  return (
    <>
      <Grid container justifyContent="center" alignItems="center" gap={2} size={12}>
        <Button variant="contained" color="primary" onClick={() => setOpenDialog(true)} sx={{ minWidth: 200 }}>
          Play vs AI
        </Button>

        <Button variant="contained" color="secondary" onClick={handlePlayOnline} sx={{ minWidth: 200 }}>
          Play Online
        </Button>
      </Grid>

      {/* === SETTINGS DIALOG === */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>🎯 Choose Your Game Settings</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 320 }}>
          <Typography gutterBottom>Engine Strength (ELO)</Typography>
          <Slider
            value={elo}
            onChange={(e, val) => setElo(val as number)}
            min={800}
            max={3000}
            step={50}
            valueLabelDisplay="auto"
          />
          <Typography variant="body2" color="text.secondary">
            {elo} ELO ({elo < 1200 ? "Beginner" : elo < 1800 ? "Intermediate" : "Master"})
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Engine Version</InputLabel>
            <Select
              value={engineVersion}
              onChange={(e) => setEngineVersion(e.target.value as EngineName)}
            >
              <MenuItem value={EngineName.Stockfish11}>Stockfish 11</MenuItem>
              <MenuItem value={EngineName.Stockfish16}>Stockfish 16.1</MenuItem>
              <MenuItem value={EngineName.Stockfish17}>Stockfish 17</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Play as</InputLabel>
            <Select value={color} onChange={(e) => setColor(e.target.value as Color)}>
              <MenuItem value={Color.White}>White</MenuItem>
              <MenuItem value={Color.Black}>Black</MenuItem>
              <MenuItem value={Color.Random}>Random</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleConfirm}>
            Start Game
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
