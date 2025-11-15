// src/hooks/useTrain.ts
import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import type { Square } from "chess.js";

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  solution: string[];
  rating: number;
  theme?: string;
  userSide: 'white' | 'black';
}

export default function useTrain(setId?: string) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [solvedCount, setSolvedCount] = useState(0);

  const determineUserSide = (puzzle: any): 'white' | 'black' => {
    const solution = puzzle.solution || puzzle.moves || [];
    
    if (solution.length === 0) {
      try {
        const game = new Chess(puzzle.fen || puzzle.position);
        return game.turn() === 'w' ? 'white' : 'black';
      } catch {
        return 'white';
      }
    }
    
    try {
      const game = new Chess(puzzle.fen || puzzle.position);
      
      for (let i = 0; i < solution.length - 1; i++) {
        const moveUCI = solution[i];
        const move = uciToMove(moveUCI);
        if (move) {
          game.move(move);
        }
      }
      
      const finalMoveColor = game.turn() === 'w' ? 'white' : 'black';
      
      return finalMoveColor;
      
    } catch (error) {
      const userSide = solution.length % 2 === 1 ? 'white' : 'black';
      return userSide;
    }
  };

  const extractMoves = (puzzleData: any): string[] => {
    if (Array.isArray(puzzleData.moves)) {
      return puzzleData.moves;
    } else if (typeof puzzleData.moves === "string") {
      return puzzleData.moves.split(/\s+/).filter(Boolean);
    } else if (Array.isArray(puzzleData.solution)) {
      return puzzleData.solution;
    } else if (typeof puzzleData.solution === "string") {
      return puzzleData.solution.split(/\s+/).filter(Boolean);
    } else {
      return [];
    }
  };

  const uciToMove = (uci: string) => {
    if (!uci || uci.length < 4) return null;
    
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const promotion = uci.length > 4 ? uci[4] as 'q' | 'r' | 'b' | 'n' : undefined;

    return {
      from,
      to,
      promotion: promotion || 'q'
    };
  };

  const loadFromLocal = async (packId?: string) => {
    if (!packId) return false;
    
    try {
      const response = await fetch(`/puzzle-sets/set_${packId}.json`);
      
      if (!response.ok) {
        return false;
      }

      const localPuzzles = await response.json();
      
      if (!Array.isArray(localPuzzles) || localPuzzles.length === 0) {
        return false;
      }

      const processedPuzzles: Puzzle[] = localPuzzles.map((puzzle: any) => {
        const movesArray = extractMoves(puzzle);
        const userSide = determineUserSide(puzzle);
        
        return {
          id: puzzle.id || `local-${Math.random().toString(36).substr(2, 9)}`,
          fen: puzzle.fen || puzzle.FEN || puzzle.position || "start",
          moves: movesArray,
          solution: movesArray,
          rating: puzzle.rating || 1200,
          theme: puzzle.theme || puzzle.themes?.[0] || packId,
          userSide,
        };
      });

      const validPuzzles = processedPuzzles.filter(p => p.solution.length > 0);
      
      if (validPuzzles.length === 0) {
        return false;
      }

      const shuffled = [...validPuzzles].sort(() => 0.5 - Math.random());
      const pick = shuffled[0];
      
      setPuzzles(shuffled);
      setCurrentPuzzle(pick);
      
      return true;
      
    } catch (error) {
      return false;
    }
  };

  const loadFallbackPuzzles = async () => {
    try {
      const { puzzles: fallbackPuzzles } = await import('../data/puzzles');
      
      const processedPuzzles: Puzzle[] = fallbackPuzzles.map((puzzle: any) => {
        const movesArray = extractMoves(puzzle);
        const userSide = determineUserSide(puzzle);
        
        return {
          id: puzzle.id,
          fen: puzzle.fen,
          moves: movesArray,
          solution: movesArray,
          rating: puzzle.rating || 1200,
          theme: puzzle.theme || "fallback",
          userSide,
        };
      });

      const validPuzzles = processedPuzzles.filter(p => p.solution.length > 0);
      
      if (validPuzzles.length > 0) {
        const shuffled = [...validPuzzles].sort(() => 0.5 - Math.random());
        setPuzzles(shuffled);
        setCurrentPuzzle(shuffled[0]);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  const fetchRandomPuzzle = async (packId?: string) => {
    setLoading(true);
    try {
      if (packId) {
        const loadedLocal = await loadFromLocal(packId);
        if (!loadedLocal) {
          await loadFallbackPuzzles();
        }
      } else {
        await loadFallbackPuzzles();
      }
      
    } catch (error) {
      // Silently handle error
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 100);
    }
  };

  const handleNextPuzzle = (packId?: string) => {
    if (puzzles.length > 1) {
      const currentIndex = puzzles.findIndex(p => p.id === currentPuzzle?.id);
      const nextIndex = (currentIndex + 1) % puzzles.length;
      setCurrentPuzzle(puzzles[nextIndex]);
    } else {
      fetchRandomPuzzle(packId);
    }
  };

  const handleSolvePuzzle = (correct: boolean) => {
    if (!currentPuzzle) return;
    if (correct) {
      setSolvedCount(prev => prev + 1);
    }
  };

  useEffect(() => {
    fetchRandomPuzzle(setId);
  }, [setId]);

  return {
    puzzles,
    currentPuzzle,
    loading,
    solvedCount,
    totalPuzzles: puzzles.length,
    handleNextPuzzle,
    handleSolvePuzzle,
  };
}