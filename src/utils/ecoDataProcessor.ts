// src/utils/ecoDataProcessor.ts
export interface Variation {
  name: string;
  moves: string;
  description: string;
}

export interface Opening {
  id: string;
  name: string;
  eco: string;
  description: string;
  moves: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
  variations: Variation[];
  keyIdeas: string[];
  commonTraps: any[];
  aliases: string[];
  fen?: string;
}

export interface ECOData {
  [fen: string]: {
    src: string;
    eco: string;
    moves: string;
    name: string;
    scid?: string;
    aliases?: {
      [key: string]: string | string[];
    };
  };
}

export class ECODataProcessor {
  static processECOData(ecoData: ECOData): Opening[] {
    const processed: Opening[] = [];
    const seenIds = new Set<string>();
    
    for (const [fen, openingData] of Object.entries(ecoData)) {
      const processedOpening = this.processSingleOpening(fen, openingData);
      if (processedOpening) {
        // Check for duplicates and make unique if needed
        let finalId = processedOpening.id;
        if (seenIds.has(finalId)) {
          console.warn('Duplicate ID found:', finalId, 'for opening:', processedOpening.name);
          // Add FEN hash to make it unique
          finalId = `${finalId}-${this.simpleHash(fen)}`;
        }
        
        if (seenIds.has(finalId)) {
          // If still duplicate, use a counter
          let counter = 1;
          while (seenIds.has(`${finalId}-${counter}`)) {
            counter++;
          }
          finalId = `${finalId}-${counter}`;
        }
        
        seenIds.add(finalId);
        processed.push({
          ...processedOpening,
          id: finalId
        });
      }
    }
    
    console.log(`Processed ${processed.length} openings with ${seenIds.size} unique IDs`);
    return processed.sort((a, b) => a.name.localeCompare(b.name));
  }

  static processSingleOpening(fen: string, openingData: any): Opening | null {
    try {
      // Use FEN-based ID for guaranteed uniqueness
      const id = this.generateId(fen, openingData.name);
      
      return {
        id: id,
        fen: fen,
        name: openingData.name,
        eco: openingData.eco,
        moves: openingData.moves,
        aliases: this.extractAliases(openingData.aliases),
        difficulty: this.calculateDifficulty(openingData),
        popularity: this.calculatePopularity(openingData),
        variations: this.extractVariations(openingData),
        description: this.generateDescription(openingData),
        keyIdeas: this.generateKeyIdeas(openingData),
        commonTraps: []
      };
    } catch (error) {
      console.error('Error processing opening:', openingData.name, error);
      return null;
    }
  }
  
  // Most robust solution - use FEN for unique IDs
  static generateId(fen: string, name: string): string {
    // Create a hash from the FEN string to ensure uniqueness
    const fenHash = this.simpleHash(fen);
    const nameSlug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    return `${nameSlug}-${fenHash}`;
  }

  // Simple hash function for FEN strings
  static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  static extractAliases(aliasesData: any): string[] {
    if (!aliasesData) return [];
    
    const aliases: string[] = [];
    
    if (typeof aliasesData === 'object') {
      Object.values(aliasesData).forEach(value => {
        if (typeof value === 'string') {
          aliases.push(value);
        } else if (Array.isArray(value)) {
          value.forEach(alias => {
            if (typeof alias === 'string') {
              aliases.push(alias);
            }
          });
        }
      });
    }
    
    return [...new Set(aliases)];
  }
  
  static calculateDifficulty(openingData: any): 'beginner' | 'intermediate' | 'advanced' {
    try {
      const moveCount = openingData.moves ? openingData.moves.split(' ').length : 0;
      if (moveCount <= 4) return 'beginner';
      if (moveCount <= 8) return 'intermediate';
      return 'advanced';
    } catch {
      return 'intermediate';
    }
  }
  
  static calculatePopularity(openingData: any): number {
    try {
      const ecoFirstChar = openingData.eco ? openingData.eco.charAt(0) : 'A';
      const popularityMap: { [key: string]: number } = { 
        'A': 70, 'B': 85, 'C': 90, 'D': 80, 'E': 75 
      };
      return popularityMap[ecoFirstChar] || 70;
    } catch {
      return 70;
    }
  }
  
  static extractVariations(openingData: any): Variation[] {
    try {
      // For eco.json data, create a single variation from the main line
      return [{
        name: "Main Line",
        moves: openingData.moves || '',
        description: `Main line of the ${openingData.name}`
      }];
    } catch {
      return [];
    }
  }
  
  static generateDescription(openingData: any): string {
    try {
      const baseDescription = `The ${openingData.name} is a chess opening classified under ECO code ${openingData.eco}.`;
      
      const aliases = this.extractAliases(openingData.aliases);
      if (aliases.length > 0) {
        return `${baseDescription} Also known as: ${aliases.slice(0, 3).join(', ')}.`;
      }
      
      return baseDescription;
    } catch {
      return 'A chess opening with rich strategic possibilities.';
    }
  }
  
  static generateKeyIdeas(openingData: any): string[] {
    const baseIdeas = [
      "Control the center with pawns and pieces",
      "Develop knights and bishops to active squares",
      "Prepare for castling to ensure king safety",
      "Coordinate pieces for effective attacks"
    ];
    
    try {
      const moves = (openingData.moves || '').toLowerCase();
      
      if (moves.includes('e4') && moves.includes('e5')) {
        return [...baseIdeas, "Focus on king-side attacking chances"];
      }
      
      if (moves.includes('d4') && moves.includes('d5')) {
        return [...baseIdeas, "Establish strong pawn center"];
      }
      
      if (moves.includes('c5') || moves.includes('c4')) {
        return [...baseIdeas, "Control the game from the flanks"];
      }
      
    } catch {
      // Fall through to base ideas
    }
    
    return baseIdeas.slice(0, 4);
  }

  // Method to find opening by ID in ECO data
  static findOpeningById(ecoData: ECOData, openingId: string): Opening | null {
    for (const [fen, openingData] of Object.entries(ecoData)) {
      const processed = this.processSingleOpening(fen, openingData);
      if (processed && processed.id === openingId) {
        return processed;
      }
    }
    return null;
  }

  // Method to load and merge all ECO files
  static async loadAllECOData(): Promise<ECOData> {
    const ecoFiles = ['ecoA.json', 'ecoB.json', 'ecoC.json', 'ecoD.json', 'ecoE.json'];
    let mergedData: ECOData = {};

    for (const file of ecoFiles) {
      try {
        const response = await fetch(`/data/${file}`);
        if (response.ok) {
          const data = await response.json();
          mergedData = { ...mergedData, ...data };
          console.log(`Successfully loaded ${file}`);
        } else {
          console.warn(`Failed to load ${file}: ${response.status}`);
        }
      } catch (error) {
        console.warn(`Error loading ${file}:`, error);
      }
    }

    return mergedData;
  }

  // Debug method to find duplicates
  static findDuplicateOpenings(ecoData: ECOData): void {
    const nameCounts: { [key: string]: number } = {};
    const idCounts: { [key: string]: number } = {};
    
    for (const [fen, openingData] of Object.entries(ecoData)) {
      const id = this.generateId(fen, openingData.name);
      const name = openingData.name;
      
      nameCounts[name] = (nameCounts[name] || 0) + 1;
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
    
    // Log duplicates
    console.log('=== DUPLICATE OPENING NAMES ===');
    Object.entries(nameCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([name, count]) => {
        console.log(`${name}: ${count} occurrences`);
      });
    
    console.log('=== DUPLICATE IDs ===');
    Object.entries(idCounts)
      .filter(([_, count]) => count > 1)
      .forEach(([id, count]) => {
        console.log(`${id}: ${count} occurrences`);
      });
  }
}