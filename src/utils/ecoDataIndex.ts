// src/utils/ecoDataIndex.ts
import { ECODataProcessor, Opening } from './ecoDataProcessor';

export interface OpeningIndex {
  id: string;
  name: string;
  eco: string;
  moves: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
  aliases: string[];
  searchableText: string;
}

export class ECODataIndex {
  private static instance: ECODataIndex;
  private index: OpeningIndex[] = [];
  private idMap: Map<string, OpeningIndex> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): ECODataIndex {
    if (!ECODataIndex.instance) {
      ECODataIndex.instance = new ECODataIndex();
    }
    return ECODataIndex.instance;
  }

  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (this.isLoaded) return;

    this.loadPromise = this.loadData();
    return this.loadPromise;
  }

  private async loadData(): Promise<void> {
    try {
      const ecoFiles = ['ecoA.json', 'ecoB.json', 'ecoC.json', 'ecoD.json', 'ecoE.json'];
      let mergedData: any = {};

      // Load all files in parallel for better performance
      const loadPromises = ecoFiles.map(async (file) => {
        try {
          const response = await fetch(`/data/${file}`);
          if (response.ok) {
            return await response.json();
          }
          console.warn(`Failed to load ${file}: ${response.status}`);
          return {};
        } catch (error) {
          console.warn(`Failed to load ${file}:`, error);
          return {};
        }
      });

      const loadedData = await Promise.all(loadPromises);
      
      // Merge all data
      loadedData.forEach(data => {
        mergedData = { ...mergedData, ...data };
      });

      const openings = ECODataProcessor.processECOData(mergedData);
      this.index = openings.map(opening => this.createIndexEntry(opening));
      
      // Build ID map for faster lookups
      this.idMap.clear();
      this.index.forEach(opening => {
        this.idMap.set(opening.id, opening);
      });

      this.isLoaded = true;
      console.log(`ECODataIndex loaded ${this.index.length} openings`);
    } catch (error) {
      console.error('Failed to initialize index:', error);
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }

  private createIndexEntry(opening: Opening): OpeningIndex {
    const searchableText = [
      opening.name?.toLowerCase() || '',
      opening.eco?.toLowerCase() || '',
      opening.moves?.toLowerCase() || '',
      ...(opening.aliases || []).map((alias: string) => alias.toLowerCase()),
      opening.difficulty?.toLowerCase() || ''
    ].join(' ').replace(/\s+/g, ' ').trim();

    return {
      id: opening.id,
      name: opening.name,
      eco: opening.eco,
      moves: opening.moves,
      difficulty: opening.difficulty,
      popularity: opening.popularity,
      aliases: opening.aliases || [],
      searchableText
    };
  }

  // Fast search methods
  search(query: string, limit = 50): OpeningIndex[] {
    this.ensureInitialized();
    
    if (!query.trim()) {
      return this.getPopularOpenings(limit);
    }

    const term = query.toLowerCase().trim();
    const results: { opening: OpeningIndex; score: number }[] = [];
    
    // Simple scoring system for better relevance
    for (const opening of this.index) {
      let score = 0;
      
      // Exact name match gets highest score
      if (opening.name.toLowerCase() === term) {
        score += 100;
      }
      
      // Name starts with query
      if (opening.name.toLowerCase().startsWith(term)) {
        score += 50;
      }
      
      // Name contains query
      if (opening.name.toLowerCase().includes(term)) {
        score += 30;
      }
      
      // ECO code match
      if (opening.eco.toLowerCase().includes(term)) {
        score += 20;
      }
      
      // Aliases match
      if (opening.aliases.some(alias => alias.toLowerCase().includes(term))) {
        score += 15;
      }
      
      // Moves contain the query
      if (opening.moves.toLowerCase().includes(term)) {
        score += 10;
      }
      
      // General searchable text
      if (opening.searchableText.includes(term)) {
        score += 5;
      }
      
      if (score > 0) {
        results.push({ opening, score });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score || b.opening.popularity - a.opening.popularity)
      .slice(0, limit)
      .map(item => item.opening);
  }

  getByLetter(letter: string, limit = 50): OpeningIndex[] {
    this.ensureInitialized();
    
    const upperLetter = letter.toUpperCase();
    return this.index
      .filter(opening => opening.name.charAt(0).toUpperCase() === upperLetter)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  getPopularOpenings(limit = 20): OpeningIndex[] {
    this.ensureInitialized();
    
    return this.index
      .sort((a, b) => b.popularity - a.popularity || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  getByDifficulty(difficulty: string, limit = 50): OpeningIndex[] {
    this.ensureInitialized();
    
    return this.index
      .filter(opening => opening.difficulty === difficulty)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  getAlphabetIndex(): string[] {
    this.ensureInitialized();
    
    const letters = new Set<string>();
    this.index.forEach(opening => {
      if (opening.name && opening.name.length > 0) {
        letters.add(opening.name.charAt(0).toUpperCase());
      }
    });
    return Array.from(letters).sort();
  }

  getTotalCount(): number {
    this.ensureInitialized();
    return this.index.length;
  }

  isInitialized(): boolean {
    return this.isLoaded;
  }

  getOpeningById(id: string): OpeningIndex | undefined {
    this.ensureInitialized();
    return this.idMap.get(id);
  }

  getAllOpenings(limit?: number): OpeningIndex[] {
    this.ensureInitialized();
    return limit ? this.index.slice(0, limit) : [...this.index];
  }

  private ensureInitialized(): void {
    if (!this.isLoaded) {
      throw new Error('ECODataIndex not initialized. Call initialize() first.');
    }
  }

  // Utility method to get openings by ECO code prefix
  getByECOPrefix(prefix: string, limit = 20): OpeningIndex[] {
    this.ensureInitialized();
    
    const upperPrefix = prefix.toUpperCase();
    return this.index
      .filter(opening => opening.eco.startsWith(upperPrefix))
      .sort((a, b) => a.eco.localeCompare(b.eco))
      .slice(0, limit);
  }

  // Clear the index (useful for testing)
  clear(): void {
    this.index = [];
    this.idMap.clear();
    this.isLoaded = false;
    this.loadPromise = null;
  }
}