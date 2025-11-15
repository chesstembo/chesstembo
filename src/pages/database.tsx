import { Grid2 as Grid, Typography, LinearProgress } from "@mui/material";
import { Icon } from "@iconify/react";
import {
  DataGrid,
  GridColDef,
  GridLocaleText,
  GRID_DEFAULT_LOCALE_TEXT,
  GridActionsCellItem,
  GridRowId,
} from "@mui/x-data-grid";
import { useCallback, useMemo, useState, useEffect } from "react";
import { blue, red } from "@mui/material/colors";
import LoadGameButton from "@/sections/loadGame/loadGameButton";
import { useGameDatabase } from "@/hooks/useGameDatabase";
import { useRouter } from "next/router";
import { PageTitle } from "@/components/pageTitle";

const gridLocaleText: GridLocaleText = {
  ...GRID_DEFAULT_LOCALE_TEXT,
  noRowsLabel: "No games found",
};

export default function GameDatabase() {
  const { games, isLoading, deleteGame } = useGameDatabase(true);
  const router = useRouter();
  const [displayedGames, setDisplayedGames] = useState<any[]>([]);

  // Optimize rendering by batching updates
  useEffect(() => {
    if (games.length > 0) {
      setDisplayedGames(games.map((game, index) => ({
        ...game,
        gridId: game.displayId, // Use the actual ID for grid operations
        rowNumber: index + 1, // For display only
      })));
    } else {
      setDisplayedGames([]);
    }
  }, [games]);

  const handleDeleteGameRow = useCallback(
    (id: GridRowId) => async () => {
      // Find the actual game to determine if it's online or local
      const gameToDelete = games.find(g => g.displayId === id);
      if (!gameToDelete) {
        throw new Error("Game not found");
      }
      
      const isOnlineGame = gameToDelete.gameType === "Online";
      await deleteGame(id, isOnlineGame);
    },
    [games, deleteGame]
  );

  const handleCopyGameRow = useCallback(
    (id: GridRowId) => async () => {
      const game = games.find(g => g.displayId === id);
      if (game) {
        await navigator.clipboard?.writeText?.(game.pgn);
      }
    },
    [games]
  );

  const handleOpenAnalysis = useCallback(
    (id: GridRowId) => {
      router.push({ pathname: "/", query: { gameId: id } });
    },
    [router]
  );

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "rowNumber",
        headerName: "#",
        width: 60,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "gameType",
        headerName: "Type",
        width: 100,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "event",
        headerName: "Event",
        width: 150,
      },
      {
        field: "site",
        headerName: "Site",
        width: 150,
      },
      {
        field: "date",
        headerName: "Date",
        width: 120,
      },
      {
        field: "whiteLabel",
        headerName: "White",
        width: 180,
        headerAlign: "center",
        align: "center",
        valueGetter: (_, row) =>
          `${row.white.name ?? "Unknown"} (${row.white.rating ?? "?"})`,
      },
      {
        field: "result",
        headerName: "Result",
        headerAlign: "center",
        align: "center",
        width: 100,
      },
      {
        field: "blackLabel",
        headerName: "Black",
        width: 180,
        headerAlign: "center",
        align: "center",
        valueGetter: (_, row) =>
          `${row.black.name ?? "Unknown"} (${row.black.rating ?? "?"})`,
      },
      {
        field: "timeControl",
        headerName: "Time Control",
        width: 120,
        headerAlign: "center",
        align: "center",
      },
      {
        field: "eval",
        headerName: "Evaluation",
        type: "boolean",
        headerAlign: "center",
        align: "center",
        width: 100,
        valueGetter: (_, row) => !!row.eval,
      },
      {
        field: "openEvaluation",
        type: "actions",
        headerName: "Analyze",
        width: 100,
        cellClassName: "actions",
        getActions: ({ id }) => {
          return [
            <GridActionsCellItem
              icon={
                <Icon icon="streamline:magnifying-glass-solid" width="20px" />
              }
              label="Open Evaluation"
              onClick={() => handleOpenAnalysis(id)}
              color="inherit"
              key={`${id}-open-eval-button`}
            />,
          ];
        },
      },
      {
        field: "delete",
        type: "actions",
        headerName: "Delete",
        width: 100,
        cellClassName: "actions",
        getActions: ({ id }) => {
          return [
            <GridActionsCellItem
              icon={
                <Icon icon="mdi:delete-outline" color={red[400]} width="20px" />
              }
              label="Delete"
              onClick={handleDeleteGameRow(id)}
              color="inherit"
              key={`${id}-delete-button`}
            />,
          ];
        },
      },
      {
        field: "copy pgn",
        type: "actions",
        headerName: "Copy PGN",
        width: 100,
        cellClassName: "actions",
        getActions: ({ id }) => {
          return [
            <GridActionsCellItem
              icon={
                <Icon icon="ri:clipboard-line" color={blue[400]} width="20px" />
              }
              label="Copy PGN"
              onClick={handleCopyGameRow(id)}
              color="inherit"
              key={`${id}-copy-button`}
            />,
          ];
        },
      },
    ],
    [handleDeleteGameRow, handleCopyGameRow, handleOpenAnalysis]
  );

  return (
    <Grid
      container
      justifyContent="center"
      alignItems="center"
      gap={4}
      marginTop={6}
    >
      <PageTitle title="Chesskit Game Database" />

      <Grid container justifyContent="center" alignItems="center" size={12}>
        <LoadGameButton />
      </Grid>

      <Grid container justifyContent="center" alignItems="center" size={12}>
        <Typography variant="subtitle2">
          You have {games.length} game{games.length !== 1 && "s"} in your database
          {isLoading && " (loading...)"}
        </Typography>
      </Grid>

      {isLoading && (
        <Grid size={12}>
          <LinearProgress />
        </Grid>
      )}

      <Grid maxWidth="100%" minWidth="50px" size={12}>
        <DataGrid
          aria-label="Games list"
          rows={displayedGames}
          columns={columns}
          disableColumnMenu
          hideFooter={games.length <= 100}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 },
            },
            sorting: {
              sortModel: [
                {
                  field: "date",
                  sort: "desc",
                },
              ],
            },
          }}
          localeText={gridLocaleText}
          loading={isLoading}
          getRowId={(row) => row.gridId} // Use the actual game ID
        />
      </Grid>
    </Grid>
  );
}