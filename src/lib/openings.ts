export async function fetchOpenings(limit = 300) {
  const url =
    process.env.NEXT_PUBLIC_OPENINGS_URL ||
    "https://raw.githubusercontent.com/lichess-org/chess-openings/master/dist/openings.json";
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.slice(0, limit);
  } catch {
    return [
      { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"] },
      { eco: "B20", name: "Sicilian Defence", moves: ["e4", "c5"] },
    ];
  }
}
