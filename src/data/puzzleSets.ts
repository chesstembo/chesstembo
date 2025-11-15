// src/data/puzzleSets.ts
export interface PuzzleSet {
  id: string;
  name: string;
  description: string;
  file: string; // relative path to JSON file
  count: number;
  isPremium?: boolean;
}

export const PUZZLE_SETS: PuzzleSet[] = [
  { id: "advancedpawn", name: "Advanced Pawn Tactics", file: "/puzzle-sets/set_advancedpawn.json", count: 2500 },
  { id: "advantage", name: "Advantage Conversion", file: "/puzzle-sets/set_advantage.json", count: 2500 },
  { id: "anastasiamate", name: "Anastasia’s Mate", file: "/puzzle-sets/set_anastasiamate.json", count: 2500 },
  { id: "arabianmate", name: "Arabian Mate", file: "/puzzle-sets/set_arabianmate.json", count: 2500 },
  { id: "attackingf2f7", name: "Attacking f2 & f7", file: "/puzzle-sets/set_attackingf2f7.json", count: 2500 },
  { id: "attraction", name: "Attraction Sacrifices", file: "/puzzle-sets/set_attraction.json", count: 2500 },
  { id: "backrankmate", name: "Back Rank Mate", file: "/puzzle-sets/set_backrankmate.json", count: 2500 },
  { id: "bishopendgame", name: "Bishop Endgames", file: "/puzzle-sets/set_bishopendgame.json", count: 2500 },
  { id: "bodenmate", name: "Boden’s Mate", file: "/puzzle-sets/set_bodenmate.json", count: 2000 },
  { id: "capturingdefender", name: "Capturing the Defender", file: "/puzzle-sets/set_capturingdefender.json", count: 2500 },
  { id: "castling", name: "Castling Safety", file: "/puzzle-sets/set_castling.json", count: 450 },
  { id: "clearance", name: "Clearance Tactics", file: "/puzzle-sets/set_clearance.json", count: 2500 },
  { id: "crushing", name: "Crushing Finishers", file: "/puzzle-sets/set_crushing.json", count: 2500 },
  { id: "defensivemove", name: "Defensive Moves", file: "/puzzle-sets/set_defensivemove.json", count: 1000 },
  { id: "deflection", name: "Deflection Patterns", file: "/puzzle-sets/set_deflection.json", count: 2500 },
  { id: "discoveredattack", name: "Discovered Attacks", file: "/puzzle-sets/set_discoveredattack.json", count: 2500 },
  { id: "doublebishopmate", name: "Double Bishop Mate", file: "/puzzle-sets/set_doublebishopmate.json", count: 1900 },
  { id: "doublecheck", name: "Double Checks", file: "/puzzle-sets/set_doublecheck.json", count: 2500 },
  { id: "dovetailmate", name: "Dovetail Mate", file: "/puzzle-sets/set_dovetailmate.json", count: 2000 },
  { id: "endgame", name: "Endgame Studies", file: "/puzzle-sets/set_endgame.json", count: 2500 },
  { id: "equality", name: "Equality Defense", file: "/puzzle-sets/set_equality.json", count: 2500 },
  { id: "exposedking", name: "Exposed King", file: "/puzzle-sets/set_exposedking.json", count: 2500 },
  { id: "fork", name: "Fork Tactics", file: "/puzzle-sets/set_fork.json", count: 2500 },
  { id: "hangingpiece", name: "Hanging Pieces", file: "/puzzle-sets/set_hangingpiece.json", count: 2500 },
  { id: "kingsideattack", name: "Kingside Attack", file: "/puzzle-sets/set_kingsideattack.json", count: 2500 },
  { id: "mate", name: "Mate Patterns", file: "/puzzle-sets/set_mate.json", count: 2500 },
  { id: "middlegame", name: "Middlegame Strategy", file: "/puzzle-sets/set_middlegame.json", count: 2500 },
  { id: "opening", name: "Opening Tactics", file: "/puzzle-sets/set_opening.json", count: 1400 },
  // Mark premium ones:
].map((s, i) => ({ ...s, isPremium: i >= 6 })); // first 6 free, rest premium
