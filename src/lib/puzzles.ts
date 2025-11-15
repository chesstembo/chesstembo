// src/lib/puzzles.ts
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  solution?: string[];
  rating?: number;
  themes?: string[];
  theme?: string;
  [k: string]: any;
}

/**
 * Very small FEN validator for common issues (not a full chess validator).
 */
export function isValidFEN(fen?: string): boolean {
  if (!fen || typeof fen !== "string") return false;
  try {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) return false;
    const board = parts[0];
    const ranks = board.split("/");
    if (ranks.length !== 8) return false;
    if (!/^[prnbqkPRNBQK1-8\/]+$/.test(board)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch puzzles for the training queue - LOCAL ONLY
 */
export async function puzzlesFetch(
  count = 30,
  opts?: { theme?: string; minRating?: number; maxRating?: number }
): Promise<Puzzle[]> {
  // Try local puzzle sets first
  if (opts?.theme) {
    try {
      const response = await fetch(`/puzzle-sets/set_${opts.theme}.json`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
          return data.slice(0, count).map(normalizePuzzle);
        }
      }
    } catch (e) {
      console.error("Failed to load theme puzzles:", e);
    }
  }

  // Fallback to main puzzles file
  try {
    const response = await fetch("/puzzles.json");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length) {
        return data.slice(0, count).map(normalizePuzzle);
      }
    }
  } catch (e) {
    console.error("Failed to load puzzles.json:", e);
  }

  // Ultimate fallback - use built-in puzzles
  try {
    const { puzzles: builtInPuzzles } = await import('../data/puzzles');
    return builtInPuzzles.slice(0, count).map(normalizePuzzle);
  } catch (e) {
    console.error("All puzzle sources failed:", e);
    return [];
  }
}

/** Normalizes puzzle records to consistent shape for the UI */
function normalizePuzzle(raw: any): Puzzle {
  const moves: string[] =
    raw.moves && Array.isArray(raw.moves)
      ? raw.moves
      : raw.Moves && typeof raw.Moves === "string"
      ? raw.Moves.split(/\s+/).filter(Boolean)
      : raw.solution && Array.isArray(raw.solution)
      ? raw.solution
      : [];

  const themes: string[] =
    raw.themes && Array.isArray(raw.themes)
      ? raw.themes
      : typeof raw.themes === "string"
      ? raw.themes.split(/\s+/).filter(Boolean)
      : raw.theme
      ? [String(raw.theme)]
      : [];

  return {
    id: raw.id || raw.PuzzleId || raw.idString || String(raw._id || ""),
    fen: raw.fen || raw.FEN || "start",
    moves,
    solution: raw.solution || raw.solutionMoves || moves,
    rating: Number(raw.rating || raw.Rating || raw.level || 0) || undefined,
    themes,
    theme: themes[0] || undefined,
    ...raw,
  };
}