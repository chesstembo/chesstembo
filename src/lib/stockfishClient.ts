// src/lib/stockfishClient.ts
// Tembo — Stockfish Integration
// A robust, production-ready Stockfish client for your web app
// Uses your locally hosted engine: /public/engine/stockfish-11.js

export type Variation = { pv: string[]; score?: { type: string; value: number } };

export function createStockfishWorker(path = "/engine/stockfish-11.js") {
  let worker: Worker | null = null;

  try {
    worker = new Worker(path);
  } catch (err) {
    console.error("❌ Failed to create Stockfish worker:", err);
    throw new Error("Stockfish engine not found at " + path);
  }

  function send(cmd: string) {
    if (!worker) return;
    worker.postMessage(cmd);
  }

  function parseInfoLine(line: string) {
    const mpMatch = line.match(/multipv (\d+)/);
    const pvMatch = line.match(/ pv (.+)$/);
    const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
    const multipv = mpMatch ? Number(mpMatch[1]) : null;
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : null;
    const score = scoreMatch ? { type: scoreMatch[1], value: Number(scoreMatch[2]) } : null;
    return { multipv, pv, score };
  }

  async function analyzeFen(
    fen: string,
    opts: { multiPV?: number; depth?: number; movetime?: number } = {}
  ): Promise<Variation[]> {
    const { multiPV = 6, depth = 18, movetime = 2000 } = opts;

    return new Promise((resolve) => {
      if (!worker) {
        console.warn("Stockfish worker not initialized — restarting.");
        worker = new Worker(path);
      }

      const results: (Variation | null)[] = [];
      const timeout = setTimeout(() => {
        worker?.removeEventListener("message", onMsg);
        resolve(results.filter(Boolean) as Variation[]);
      }, movetime + 3000);

      const onMsg = (e: MessageEvent) => {
        const data = typeof e.data === "string" ? e.data : "";
        if (!data) return;

        const lines = data.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith("info")) {
            const parsed = parseInfoLine(line);
            if (parsed.multipv && parsed.pv) {
              const idx = parsed.multipv - 1;
              results[idx] = { pv: parsed.pv, score: parsed.score || undefined };
            }
          }
          if (line.startsWith("bestmove")) {
            clearTimeout(timeout);
            worker?.removeEventListener("message", onMsg);
            const filtered = results.filter(Boolean) as Variation[];
            resolve(filtered.length ? filtered : []);
            return;
          }
        }
      };

      worker.addEventListener("message", onMsg);

      // Reset and start a fresh search
      send("uci");
      send(`setoption name MultiPV value ${multiPV}`);
      send(`position fen ${fen}`);
      if (movetime) send(`go movetime ${movetime}`);
      else send(`go depth ${depth}`);
    });
  }

  function destroy() {
    try {
      worker?.terminate();
      worker = null;
    } catch (err) {
      console.warn("Failed to terminate Stockfish worker:", err);
    }
  }

  return { analyzeFen, send, destroy };
}
 