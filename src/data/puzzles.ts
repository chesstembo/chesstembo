// src/data/puzzles.ts
import { Puzzle } from "@/types/puzzle";

export const puzzles: Puzzle[] = [
  {
    id: "mate-in-1-1",
    fen: "7k/5P2/6K1/8/8/8/8/8 w - - 0 1",
    solution: ["f7f8=Q"],
    title: "Pawn Promotion Mate",
    description: "Promote and checkmate in one.",
    rating: 800,
    theme: "promotion"
  },
  {
    id: "mate-in-1-2",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1",
    solution: ["e1h5"],
    title: "Queen Sacrifice",
    description: "Sacrifice to open lines.",
    rating: 1200,
    theme: "sacrifice"
  },
  {
    id: "castle-1",
    fen: "r3k2r/pppq1ppp/2n2n2/3pp3/3P4/2NBPN2/PPPQ1PPP/R3K2R w KQkq - 0 1",
    solution: ["O-O"],
    title: "Kingside Castle",
    description: "Castle to safety.",
    rating: 900,
    theme: "castling"
  },
  {
    id: "fork-1",
    fen: "8/8/8/3n4/3P4/8/5N2/7k w - - 0 1",
    solution: ["f2d3"],
    title: "Knight Fork",
    description: "Fork king and rook.",
    rating: 1000,
    theme: "fork"
  }
];