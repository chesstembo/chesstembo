import { EngineWorker } from "@/types/engine";
import { isIosDevice, isMobileDevice } from "./shared";

export const getEngineWorker = (enginePath: string): EngineWorker => {
  console.log(`Creating worker from ${enginePath}`);

  // FIXED: Ensure the path is correct for public folder structure
  const fullPath = enginePath.startsWith('/') ? enginePath : `/${enginePath}`;
  
  // FIXED: Add /play/ prefix if not already present for engines
  const correctedPath = fullPath.includes('/play/engines/') 
    ? fullPath 
    : fullPath.replace('/engines/', '/play/engines/');

  console.log(`🔄 Corrected engine path: ${correctedPath}`);

  try {
    const worker = new window.Worker(correctedPath);

    const engineWorker: EngineWorker = {
      isReady: false,
      uci: (command: string) => worker.postMessage(command),
      listen: () => null,
      terminate: () => worker.terminate(),
    };

    worker.onmessage = (event) => {
      if (engineWorker.listen) {
        engineWorker.listen(event.data);
      }
    };

    worker.onerror = (error) => {
      console.error(`❌ Worker error for ${correctedPath}:`, error);
    };

    return engineWorker;
  } catch (error) {
    console.error(`❌ Failed to create worker from ${correctedPath}:`, error);
    throw new Error(`Unable to load chess engine from ${correctedPath}`);
  }
};

export const sendCommandsToWorker = (
  worker: EngineWorker,
  commands: string[],
  finalMessage: string,
  onNewMessage?: (messages: string[]) => void
): Promise<string[]> => {
  return new Promise((resolve) => {
    const messages: string[] = [];

    worker.listen = (data) => {
      messages.push(data);
      onNewMessage?.(messages);

      if (data.startsWith(finalMessage)) {
        resolve(messages);
      }
    };

    for (const command of commands) {
      worker.uci(command);
    }
  });
};

export const getRecommendedWorkersNb = (): number => {
  // FIXED: More conservative worker calculation for better stability
  const maxWorkersNbFromThreads = Math.max(
    1,
    Math.min(
      Math.floor(navigator.hardwareConcurrency / 2),
      Math.round(navigator.hardwareConcurrency - 2)
    )
  );

  const maxWorkersNbFromMemory =
    "deviceMemory" in navigator && typeof navigator.deviceMemory === "number"
      ? Math.max(1, Math.floor(navigator.deviceMemory))
      : 2;

  const maxWorkersNbFromDevice = isIosDevice() ? 1 : isMobileDevice() ? 2 : 4;

  const recommended = Math.min(
    maxWorkersNbFromThreads,
    maxWorkersNbFromMemory,
    maxWorkersNbFromDevice
  );

  console.log(`🔄 Recommended workers: ${recommended} (threads: ${navigator.hardwareConcurrency}, memory: ${navigator.deviceMemory || 'unknown'})`);
  
  return recommended;
};