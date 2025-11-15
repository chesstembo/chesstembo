// src/hooks/usePuzzles.ts
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import { Chess } from 'chess.js';

interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  rating: number;
  theme: string;
  userSide: 'white' | 'black';
}

// 🆕 Validate FEN string
function isValidFEN(fen: string): boolean {
  try {
    const chess = new Chess();
    chess.load(fen);
    return true;
  } catch (error) {
    console.warn('Invalid FEN:', fen, error);
    return false;
  }
}

// 🆕 Determine user side based on FEN and solution
function determineUserSide(fen: string, solution: string[]): 'white' | 'black' {
  try {
    const chess = new Chess(fen);
    
    // Count moves for white and black in the solution
    let whiteMoves = 0;
    let blackMoves = 0;
    
    const tempGame = new Chess(fen);
    for (const moveUCI of solution) {
      if (moveUCI.length < 4) continue;
      
      const from = moveUCI.slice(0, 2);
      const to = moveUCI.slice(2, 4);
      const promotion = moveUCI.length > 4 ? moveUCI[4] : undefined;
      
      try {
        const move = tempGame.move({
          from: from as any,
          to: to as any,
          promotion: promotion as any
        });
        
        if (move) {
          if (move.color === 'w') whiteMoves++;
          else blackMoves++;
        }
      } catch (error) {
        console.warn('Invalid move in solution:', moveUCI, error);
      }
    }
    
    // User plays the color that makes the last move
    const lastMoveColor = solution.length % 2 === 0 ? 'black' : 'white';
    return lastMoveColor;
    
  } catch (error) {
    console.warn('Error determining user side, defaulting to white:', error);
    return 'white';
  }
}

// 🆕 Fallback puzzles in case Firestore fails
const FALLBACK_PUZZLES: Puzzle[] = [
  {
    id: 'fallback-1',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    solution: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
    rating: 1200,
    theme: 'Opening',
    userSide: 'white'
  },
  {
    id: 'fallback-2',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    solution: ['f1c4', 'f8c5', 'd2d3', 'g8f6', 'c2c3'],
    rating: 1300,
    theme: 'Italian Game',
    userSide: 'white'
  }
];

export function usePuzzles(themeId: string, batchSize: number = 10) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        setLoading(true);
        setError(null);

        let puzzlesData: Puzzle[] = [];
        
        try {
          // Try to fetch from Firestore first
          const puzzlesQuery = query(
            collection(db, 'themes', themeId, 'puzzles'),
            orderBy('rating'),
            limit(batchSize)
          );
          
          const querySnapshot = await getDocs(puzzlesQuery);
          
          puzzlesData = querySnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                fen: data.fen || '',
                solution: data.solution || data.moves || [],
                rating: data.rating || 1200,
                theme: data.theme || themeId,
                userSide: 'white' as const // Temporary, will be updated
              };
            })
            .filter(puzzle => {
              // Filter out puzzles with invalid FEN
              if (!isValidFEN(puzzle.fen)) {
                console.warn('Skipping puzzle with invalid FEN:', puzzle.id, puzzle.fen);
                return false;
              }
              
              // Filter out puzzles with empty solutions
              if (!puzzle.solution || puzzle.solution.length === 0) {
                console.warn('Skipping puzzle with empty solution:', puzzle.id);
                return false;
              }
              
              return true;
            })
            .map(puzzle => ({
              ...puzzle,
              userSide: determineUserSide(puzzle.fen, puzzle.solution)
            }));

          
        } catch (firestoreError) {
          console.error('Firestore error, using fallback puzzles:', firestoreError);
          setError('Failed to load puzzles from server. Using demo puzzles.');
          puzzlesData = FALLBACK_PUZZLES;
        }

        // If no puzzles were fetched, use fallback
        if (puzzlesData.length === 0) {
          console.warn('No valid puzzles found, using fallback');
          puzzlesData = FALLBACK_PUZZLES;
        }

        setPuzzles(puzzlesData);

      } catch (err) {
        console.error('Error in usePuzzles:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setPuzzles(FALLBACK_PUZZLES);
      } finally {
        setLoading(false);
      }
    };

    fetchPuzzles();
  }, [themeId, batchSize]);

  return { puzzles, loading, error };
}