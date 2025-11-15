// hooks/useDataGridGames.ts
import { useMemo } from 'react';

export const useDataGridGames = (games: any[]) => {
  const rows = useMemo(() => {
    return games.map((game, index) => ({
      ...game,
      // Robust composite key that handles all edge cases
      gridId: createGameGridId(game, index),
    }));
  }, [games]);

  return { rows };
};

const createGameGridId = (game: any, index: number): string => {
  const id = game.id || `local-${index}`;
  const date = game.date || new Date().toISOString().split('T')[0];
  const type = game.gameType || 'unknown';
  
  // Include timestamp to ensure uniqueness even with identical data
  const timestamp = Date.now().toString(36);
  
  return `${type}-${id}-${date}-${timestamp}`;
};