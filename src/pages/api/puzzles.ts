// pages/api/puzzles.ts
import { puzzles } from "@/lib/puzzles";

export default function handler(req, res) {
  res.status(200).json({ puzzles });
}
