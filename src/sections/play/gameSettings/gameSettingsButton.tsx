import { Button, Grid2 as Grid } from "@mui/material";
import { useState } from "react";
import GameSettingsDialog from "./gameSettingsDialog";
import { gameAtom } from "../states";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";

export default function GameSettingsButton() {
  const [openDialog, setOpenDialog] = useState(false);
  const game = useAtomValue(gameAtom);
  const router = useRouter();

  const handlePlayOnline = () => {
    router.push("/play-online");
  };

  return (
    <>
      <Grid container justifyContent="center" alignItems="center" gap={2} size={12}>
        <Button variant="contained" color="primary" onClick={() => setOpenDialog(true)} sx={{ minWidth: 200 }}>
          {game.history().length ? "Start new game" : "Play vs AI"}
        </Button>

        <Button variant="contained" color="secondary" onClick={handlePlayOnline} sx={{ minWidth: 200 }}>
          Play Online
        </Button>
      </Grid>

      <GameSettingsDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
      />
    </>
  );
}