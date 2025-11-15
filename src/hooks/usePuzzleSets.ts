// src/hooks/usePuzzleSets.ts
import { useEffect, useState } from "react";

interface PuzzleSet {
  id: string;
  name: string;
  description: string;
  count: number;
  isPremium: boolean;
  downloaded: boolean;
}

interface StoredSet {
  puzzles: any[];
  timestamp: number;
}

class PuzzleSetDB {
  private dbName = 'PuzzleSetsDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('sets')) {
          db.createObjectStore('sets', { keyPath: 'id' });
        }
      };
    });
  }

  async getSet(id: string): Promise<StoredSet | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sets'], 'readonly');
      const store = transaction.objectStore('sets');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async setSet(id: string, data: StoredSet): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sets'], 'readwrite');
      const store = transaction.objectStore('sets');
      const request = store.put({ ...data, id });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async deleteSet(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sets'], 'readwrite');
      const store = transaction.objectStore('sets');
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllSetIds(): Promise<string[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sets'], 'readonly');
      const store = transaction.objectStore('sets');
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }
}

export default function usePuzzleSets() {
  const [sets, setSets] = useState<PuzzleSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [db] = useState(() => new PuzzleSetDB());

  // Initialize available puzzle packs
  useEffect(() => {
    const initializeSets = async () => {
      try {
        await db.init();
        
        const puzzleThemes = [
          "advancedpawn", "advantage", "anastasiamate", "arabianmate", "attackingf2f7",
          "attraction", "backrankmate", "bishopendgame", "bodenmate", "capturingdefender",
          "castling", "clearance", "crushing", "defensivemove", "deflection",
          "discoveredattack", "doublebishopmate", "doublecheck", "dovetailmate", "endgame",
          "enpassant", "equality", "exposedking", "fork", "hangingpiece",
          "hookmate", "interference", "intermezzo", "killboxmate", "kingsideattack",
          "long", "master", "mate", "middlegame", "opening"
        ];

        const downloadedIds = await db.getAllSetIds();
        const downloadedSet = new Set(downloadedIds);

        const list: PuzzleSet[] = puzzleThemes.map((theme) => ({
          id: theme,
          name: theme.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toUpperCase(),
          description: `A focused tactical theme to sharpen your skills in ${theme.replace(/_/g, " ")}.`,
          count: 2500,
          isPremium: false,
          downloaded: downloadedSet.has(theme),
        }));

        setSets(list);
        setLoading(false);
      } catch (err) {
        setError("Failed to initialize puzzle sets");
        setLoading(false);
      }
    };

    initializeSets();
  }, [db]);

  // Download a specific puzzle set
  const downloadSet = async (id: string, onProgress?: (p: number) => void) => {
    if (!id || typeof id !== "string" || id.trim() === "") {
      setError("Invalid puzzle set ID");
      return;
    }

    try {
      setError(null);
      
      // Check if already downloaded
      const existing = await db.getSet(id);
      if (existing) {
        setSets(prev => prev.map(s => (s.id === id ? { ...s, downloaded: true } : s)));
        return;
      }

      const response = await fetch(`/puzzle-sets/set_${id}.json`);

      if (!response.ok) {
        throw new Error(`Failed to fetch puzzles for '${id}' (${response.status})`);
      }

      // Track progress for large files
      const reader = response.body?.getReader();
      const contentLength = +response.headers.get("Content-Length")!;
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;

        if (onProgress && contentLength) {
          const percent = Math.round((receivedLength / contentLength) * 100);
          onProgress(Math.min(percent, 100));
        }
      }

      const chunksAll = new Uint8Array(receivedLength);
      let position = 0;
      for (let chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
      }

      const resultText = new TextDecoder("utf-8").decode(chunksAll);
      const data = JSON.parse(resultText);

      // Store in IndexedDB
      await db.setSet(id, { puzzles: data, timestamp: Date.now() });

      setSets(prev => prev.map(s => (s.id === id ? { ...s, downloaded: true } : s)));

    } catch (err: any) {
      setError(err.message || "Failed to download set");
    }
  };

  // Delete a local puzzle set
  const deleteSet = async (id: string) => {
    if (!id) return;
    
    try {
      await db.deleteSet(id);
      setSets(prev => prev.map(s => (s.id === id ? { ...s, downloaded: false } : s)));
    } catch (err) {
      setError("Failed to delete set");
    }
  };

  // Get puzzles for a specific set
  const getPuzzles = async (id: string): Promise<any[] | null> => {
    try {
      const stored = await db.getSet(id);
      return stored?.puzzles || null;
    } catch (err) {
      return null;
    }
  };

  return { sets, loading, error, downloadSet, deleteSet, getPuzzles };
}