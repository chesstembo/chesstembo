// src/types/puzzle.ts
export interface Puzzle {
  id: string;
  fen: string;
  solution: string[]; // SAN or UCI
  title?: string;
  description?: string;
  rating?: number;
  theme?: string;
}