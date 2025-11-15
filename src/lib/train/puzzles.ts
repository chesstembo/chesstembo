import { Puzzle } from './types';

export const puzzles: Puzzle[] = [
  {
    id: 'puzzle1',
    fen: '8/8/8/8/8/8/8/7k w - - 0 1',
    solution: ['h2h1=Q'],
    title: 'Promotion puzzle',
    description: 'Convert pawn to queen and checkmate.'
  },
  {
    id: 'puzzle2',
    fen: 'r3k2r/pppq1ppp/2n2n2/3pp3/3P4/2NBPN2/PPPQ1PPP/R3K2R w KQkq - 0 1',
    solution: ['O-O', 'O-O-O'],
    title: 'Castle for safety',
    description: 'Find best castling move.'
  }
];
