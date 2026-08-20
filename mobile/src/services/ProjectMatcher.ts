import { ProjectRecord } from './SQLiteQueueService';
import { LocationData } from './LocationService';

export interface ProjectMatchResult {
  bestMatch: ProjectRecord | null;
  confidence: number; // 0 to 1.0 (0% to 100%)
  matchReason: string;
  isFuzzyConfirmationNeeded: boolean; // True when confidence is between 0.70 and 0.94
}

// Common Australian trade & site synonym mappings
const SYNONYM_MAP: Record<string, string[]> = {
  club: ['course', 'links', 'greens', 'fairway'],
  course: ['club', 'links', 'golf'],
  farm: ['property', 'station', 'paddock', 'homestead', 'ranch'],
  property: ['farm', 'station', 'estate'],
  station: ['farm', 'property'],
  depot: ['shed', 'workshop', 'yard', 'warehouse', 'facility'],
  shed: ['depot', 'workshop', 'garage', 'barn'],
  site: ['facility', 'plant', 'complex', 'location', 'project', 'unit'],
  facility: ['site', 'plant', 'depot', 'complex', 'building'],
  hospital: ['health', 'clinic', 'medical', 'infirmary'],
  quarry: ['mine', 'pit', 'extraction'],
  mine: ['quarry', 'pit', 'facility'],
};

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates
 */
function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalizes and tokenizes a string into clean lowercase word tokens
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !['the', 'and', 'for', 'pty', 'ltd', 'at', 'in', 'on', 'of'].includes(w));
}

/**
 * Computes Jaccard token overlap similarity with synonym expansion
 */
function computeTokenSimilarity(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  let matches = 0;
  for (const qToken of queryTokens) {
    if (targetTokens.includes(qToken)) {
      matches += 1.0;
      continue;
    }

    // Check synonym expansion
    const synonyms = SYNONYM_MAP[qToken] || [];
    const hasSynonymMatch = targetTokens.some((t) => synonyms.includes(t));
    if (hasSynonymMatch) {
      matches += 0.85;
      continue;
    }

    // Partial prefix / substring matching for tokens >= 4 chars
    if (qToken.length >= 4) {
      const hasPrefixMatch = targetTokens.some(
        (t) => t.startsWith(qToken.slice(0, 4)) || qToken.startsWith(t.slice(0, 4))
      );
      if (hasPrefixMatch) {
        matches += 0.75;
      }
    }
  }

  // Jaccard index
  const unionCount = new Set([...queryTokens, ...targetTokens]).size;
  return Math.min(1.0, (matches / Math.max(queryTokens.length, targetTokens.length)) * 1.1);
}

export class ProjectMatcher {
  /**
   * Matches a spoken query against a list of candidate projects
   */
  public static matchProject(
    spokenQuery: string,
    candidates: ProjectRecord[],
    currentGPS?: LocationData | { latitude?: number; longitude?: number }
  ): ProjectMatchResult {
    const cleanQuery = spokenQuery.trim().toLowerCase();
    if (!cleanQuery || candidates.length === 0) {
      return {
        bestMatch: null,
        confidence: 0,
        matchReason: 'Empty query or candidate list',
        isFuzzyConfirmationNeeded: false,
      };
    }

    const queryTokens = tokenize(cleanQuery);
    let bestProject: ProjectRecord | null = null;
    let highestScore = 0;
    let bestReason = 'No match found';

    for (const project of candidates) {
      const cleanProjectName = project.name.trim().toLowerCase();
      let score = 0;
      let reason = '';

      // Tier 1: Exact Match (Auto-bind) or Substring Match (Fuzzy Confirm)
      if (cleanProjectName === cleanQuery) {
        score = 1.0;
        reason = 'Exact match';
      } else if (cleanProjectName.includes(cleanQuery) || cleanQuery.includes(cleanProjectName)) {
        score = 0.88;
        reason = 'Direct substring match';
      } else {
        // Tier 2: Token Similarity with Synonyms
        const projectTokens = tokenize(cleanProjectName);
        const tokenScore = computeTokenSimilarity(queryTokens, projectTokens);
        score = tokenScore;
        reason = `Token & trade synonym match (${Math.round(tokenScore * 100)}%)`;
      }

      // Tier 3: GPS Proximity Boost (+25% boost if within 1.5km of site)
      if (
        currentGPS?.latitude !== undefined &&
        currentGPS?.longitude !== undefined &&
        project.latitude !== undefined &&
        project.longitude !== undefined
      ) {
        const distanceKm = calculateHaversineDistanceKm(
          currentGPS.latitude,
          currentGPS.longitude,
          project.latitude,
          project.longitude
        );

        if (distanceKm <= 0.5) {
          score = Math.min(0.94, score + 0.30);
          reason += ` + On-Site GPS (<500m)`;
        } else if (distanceKm <= 1.5) {
          score = Math.min(0.94, score + 0.20);
          reason += ` + Vicinity GPS (<1.5km)`;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestProject = project;
        bestReason = reason;
      }
    }

    const isFuzzyConfirmation = highestScore >= 0.70 && highestScore < 1.0;

    return {
      bestMatch: highestScore >= 0.70 ? bestProject : null,
      confidence: Number(highestScore.toFixed(2)),
      matchReason: bestReason,
      isFuzzyConfirmationNeeded: isFuzzyConfirmation,
    };
  }
}
