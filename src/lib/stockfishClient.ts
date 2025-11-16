// src/lib/stockfishClient.ts
// Tembo — Stockfish Integration
// A robust, production-ready Stockfish client for your web app

export type Variation = { pv: string[]; score?: { type: string; value: number } };

export interface StockfishAnalysis {
  variations: Variation[];
  depth: number;
  timeSpent: number;
}

export function createStockfishWorker(path = "/play/engines/stockfish-11.js") {
  console.log(`🔧 Creating Stockfish worker from: ${path}`);
  
  let worker: Worker | null = null;

  try {
    worker = new Worker(path);
    console.log('✅ Stockfish worker created successfully');
  } catch (err) {
    console.error("❌ Failed to create Stockfish worker:", err);
    throw new Error(`Stockfish engine not found at ${path}. Please make sure the file exists.`);
  }

  function send(cmd: string) {
    if (!worker) {
      console.warn('⚠️ Worker not initialized, cannot send command:', cmd);
      return;
    }
    console.log(`📤 Sending to Stockfish: ${cmd}`);
    worker.postMessage(cmd);
  }

  function parseInfoLine(line: string) {
    const mpMatch = line.match(/multipv (\d+)/);
    const pvMatch = line.match(/ pv (.+)$/);
    const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
    const depthMatch = line.match(/depth (\d+)/);
    
    const multipv = mpMatch ? Number(mpMatch[1]) : null;
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : null;
    const score = scoreMatch ? { type: scoreMatch[1], value: Number(scoreMatch[2]) } : null;
    const depth = depthMatch ? Number(depthMatch[1]) : null;
    
    return { multipv, pv, score, depth };
  }

  async function analyzeFen(
    fen: string,
    opts: { multiPV?: number; depth?: number; movetime?: number } = {}
  ): Promise<StockfishAnalysis> {
    const { multiPV = 3, depth = 18, movetime = 5000 } = opts;

    console.log(`🎯 Starting analysis for FEN: ${fen.substring(0, 50)}...`);

    return new Promise((resolve, reject) => {
      if (!worker) {
        const error = "Stockfish worker not initialized";
        console.error(`❌ ${error}`);
        reject(new Error(error));
        return;
      }

      const results: (Variation | null)[] = [];
      let analysisDepth = 0;
      const startTime = Date.now();

      const timeout = setTimeout(() => {
        console.log('⏰ Analysis timeout reached');
        worker?.removeEventListener("message", onMsg);
        const filtered = results.filter(Boolean) as Variation[];
        resolve({
          variations: filtered.length ? filtered : [{ pv: [], score: { type: 'cp', value: 0 } }],
          depth: analysisDepth,
          timeSpent: Date.now() - startTime
        });
      }, movetime + 1000);

      const onMsg = (e: MessageEvent) => {
        const data = typeof e.data === "string" ? e.data : "";
        if (!data) return;

        const lines = data.split("\n").map((l) => l.trim()).filter(Boolean);
        
        for (const line of lines) {
          console.log(`📨 Stockfish: ${line}`);
          
          if (line.startsWith("info")) {
            const parsed = parseInfoLine(line);
            
            if (parsed.depth) {
              analysisDepth = Math.max(analysisDepth, parsed.depth);
            }
            
            if (parsed.multipv && parsed.pv) {
              const idx = parsed.multipv - 1;
              results[idx] = { 
                pv: parsed.pv, 
                score: parsed.score || { type: 'cp', value: 0 }
              };
              console.log(`📊 Variation ${parsed.multipv}: ${parsed.pv.slice(0, 3).join(' ')}...`);
            }
          }
          
          if (line.startsWith("bestmove")) {
            console.log(`✅ Analysis complete. Best move: ${line}`);
            clearTimeout(timeout);
            worker?.removeEventListener("message", onMsg);
            
            const filtered = results.filter(Boolean) as Variation[];
            const finalResults = filtered.length ? filtered : [{ pv: [], score: { type: 'cp', value: 0 } }];
            
            resolve({
              variations: finalResults,
              depth: analysisDepth,
              timeSpent: Date.now() - startTime
            });
            return;
          }
          
          if (line.includes('error')) {
            console.error(`❌ Stockfish error: ${line}`);
            clearTimeout(timeout);
            worker?.removeEventListener("message", onMsg);
            reject(new Error(`Stockfish error: ${line}`));
            return;
          }
        }
      };

      worker.addEventListener("message", onMsg);
      worker.addEventListener("error", (error) => {
        console.error('❌ Worker error:', error);
        clearTimeout(timeout);
        reject(error);
      });

      // Initialize and start analysis
      console.log('🔧 Initializing Stockfish analysis...');
      send("uci");
      send("isready");
      send(`setoption name MultiPV value ${multiPV}`);
      send(`setoption name Hash value 256`);
      send(`position fen ${fen}`);
      
      if (movetime) {
        send(`go movetime ${movetime}`);
        console.log(`⏱️  Analysis running for ${movetime}ms...`);
      } else {
        send(`go depth ${depth}`);
        console.log(`⏱️  Analysis running to depth ${depth}...`);
      }
    });
  }

  async function getBestMove(
    fen: string,
    opts: { movetime?: number; depth?: number } = {}
  ): Promise<string> {
    console.log(`🤖 Getting best move for position`);
    
    const analysis = await analyzeFen(fen, { ...opts, multiPV: 1 });
    
    if (analysis.variations.length > 0 && analysis.variations[0].pv.length > 0) {
      const bestMove = analysis.variations[0].pv[0];
      console.log(`✅ Best move found: ${bestMove}`);
      return bestMove;
    }
    
    console.warn('⚠️ No best move found, returning empty string');
    return '';
  }

  function destroy() {
    try {
      if (worker) {
        console.log('🧹 Terminating Stockfish worker');
        worker.terminate();
        worker = null;
      }
    } catch (err) {
      console.warn("Failed to terminate Stockfish worker:", err);
    }
  }

  // Test function to verify engine works
  async function testEngine(): Promise<boolean> {
    try {
      console.log('🧪 Testing Stockfish engine...');
      send("uci");
      send("isready");
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('❌ Engine test timeout');
          resolve(false);
        }, 3000);

        const handler = (e: MessageEvent) => {
          const data = e.data;
          console.log(`🧪 Engine test response: ${data}`);
          
          if (data === 'readyok') {
            clearTimeout(timeout);
            worker?.removeEventListener('message', handler);
            console.log('✅ Engine test passed');
            resolve(true);
          }
        };

        worker?.addEventListener('message', handler);
      });
    } catch (error) {
      console.error('❌ Engine test failed:', error);
      return false;
    }
  }

  return { 
    analyzeFen, 
    getBestMove, 
    send, 
    destroy,
    testEngine
  };
}

// Helper function to create different Stockfish versions
export function createStockfishEngine(version: '11' | '16' | '17' = '17', lite: boolean = false) {
  const basePath = '/engines';
  
  const paths = {
    '11': `${basePath}/stockfish-11.js`,
    '16': lite ? `${basePath}/stockfish-16/stockfish-16-nnue-single.js` : `${basePath}/stockfish-16/stockfish-16-single.js`,
    '17': lite ? `${basePath}/stockfish-17/stockfish-17-lite-single.js` : `${basePath}/stockfish-17/stockfish-17-single.js`,
  };

  const path = paths[version];
  console.log(`🎯 Creating Stockfish ${version}${lite ? ' Lite' : ''} from: ${path}`);
  
  return createStockfishWorker(path);
}

// Default export for convenience
export default {
  createStockfishWorker,
  createStockfishEngine,
};