import { CalamityEvent, CalamityType } from '../types/disaster';
import { UserGeoLocation, calculatePreciseDistanceKm } from './geolocationUtils';

export interface ParsedDisasterQuery {
  rawQuery: string;
  hazardType?: CalamityType | 'all';
  locationKeywords?: string[];
  isNearMe?: boolean;
  timeWindowHours?: number; // e.g. 24, 168 (7 days), 720 (30 days)
  isBiggestOnly?: boolean;
  minMagnitude?: number;
  interpretedDescription: string;
}

export interface QueryFilterResult {
  matchedEvents: CalamityEvent[];
  parsedQuery: ParsedDisasterQuery;
  hasQuery: boolean;
  noDataMessage?: string;
  appliedFiltersSummary: string;
}

/**
 * Maps everyday human keywords to standard CalamityType
 */
const HAZARD_KEYWORD_MAP: Record<string, CalamityType> = {
  earthquake: 'earthquake',
  earthquakes: 'earthquake',
  quake: 'earthquake',
  quakes: 'earthquake',
  tremor: 'earthquake',
  tremors: 'earthquake',
  seismic: 'earthquake',

  fire: 'wildfire',
  fires: 'wildfire',
  wildfire: 'wildfire',
  wildfires: 'wildfire',
  bushfire: 'wildfire',
  bushfires: 'wildfire',
  smoke: 'wildfire',

  flood: 'flood',
  floods: 'flood',
  flooding: 'flood',
  inundation: 'flood',

  storm: 'cyclone',
  storms: 'cyclone',
  cyclone: 'cyclone',
  cyclones: 'cyclone',
  hurricane: 'cyclone',
  hurricanes: 'cyclone',
  typhoon: 'cyclone',
  typhoons: 'cyclone',
  tornado: 'tornado',
  tornadoes: 'tornado',
  twister: 'tornado',

  volcano: 'volcano',
  volcanoes: 'volcano',
  eruption: 'volcano',
  eruptions: 'volcano',
  ash: 'volcano',

  tsunami: 'tsunami',
  tsunamis: 'tsunami',

  avalanche: 'avalanche',
  avalanches: 'avalanche',
  snowslide: 'avalanche',

  blizzard: 'blizzard',
  blizzards: 'blizzard',
  snowstorm: 'blizzard',
  snow: 'blizzard',

  landslide: 'landslide',
  landslides: 'landslide',
  mudslide: 'landslide',

  drought: 'drought',
  droughts: 'drought',
  heatwave: 'extreme_temp',
  heat: 'extreme_temp',
  virus: 'virus',
  outbreak: 'virus',
  pandemic: 'pandemic',
};

/**
 * Common stop words that don't indicate location or hazard
 */
const STOP_WORDS = new Set([
  'what', 'are', 'is', 'there', 'any', 'the', 'in', 'at', 'on', 'near', 'by',
  'around', 'me', 'my', 'this', 'last', 'past', 'today', 'yesterday', 'week',
  'month', 'hours', 'hour', 'days', 'day', 'tell', 'show', 'find', 'search',
  'check', 'disaster', 'disasters', 'calamity', 'calamities', 'happening',
  'current', 'active', 'biggest', 'biggest', 'major', 'large', 'big', 'strongest',
  'strong', 'worst', 'critical', 'severe', 'please', 'where', 'how', 'many'
]);

/**
 * Converts a plain-English human question into structured disaster filters
 */
export function parseNaturalLanguageQuery(query: string): ParsedDisasterQuery {
  const normalized = query.trim().toLowerCase();
  const words = normalized.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean);

  let hazardType: CalamityType | 'all' = 'all';
  let isNearMe = false;
  let timeWindowHours: number | undefined = undefined;
  let isBiggestOnly = false;
  const locationTokens: string[] = [];

  // Check for "near me" or "nearby"
  if (
    normalized.includes('near me') ||
    normalized.includes('around me') ||
    normalized.includes('nearby') ||
    normalized.includes('close to me') ||
    normalized.includes('my area') ||
    normalized.includes('where i am')
  ) {
    isNearMe = true;
  }

  // Check for time phrases
  if (
    normalized.includes('today') ||
    normalized.includes('last 24') ||
    normalized.includes('past 24') ||
    normalized.includes('24 hours') ||
    normalized.includes('right now') ||
    normalized.includes('currently')
  ) {
    timeWindowHours = 24;
  } else if (
    normalized.includes('yesterday')
  ) {
    timeWindowHours = 48;
  } else if (
    normalized.includes('this week') ||
    normalized.includes('last week') ||
    normalized.includes('past week') ||
    normalized.includes('7 days') ||
    normalized.includes('last 7')
  ) {
    timeWindowHours = 168; // 7 days
  } else if (
    normalized.includes('this month') ||
    normalized.includes('past month') ||
    normalized.includes('last 30') ||
    normalized.includes('30 days')
  ) {
    timeWindowHours = 720; // 30 days
  }

  // Check for "biggest" or "major"
  if (
    normalized.includes('biggest') ||
    normalized.includes('strongest') ||
    normalized.includes('major') ||
    normalized.includes('severe') ||
    normalized.includes('worst') ||
    normalized.includes('critical') ||
    normalized.includes('large')
  ) {
    isBiggestOnly = true;
  }

  // Detect hazard types and extract potential place names
  for (const word of words) {
    if (HAZARD_KEYWORD_MAP[word]) {
      hazardType = HAZARD_KEYWORD_MAP[word];
    } else if (!STOP_WORDS.has(word) && word.length >= 3) {
      locationTokens.push(word);
    }
  }

  // Build a human-readable interpretation
  const parts: string[] = [];
  if (isBiggestOnly) parts.push('Major / Highest-intensity');
  if (hazardType !== 'all') {
    parts.push(hazardType.charAt(0).toUpperCase() + hazardType.slice(1) + 's');
  } else {
    parts.push('All disasters');
  }

  if (isNearMe) {
    parts.push('near your current location');
  } else if (locationTokens.length > 0) {
    parts.push(`in or near "${locationTokens.join(' ')}"`);
  }

  if (timeWindowHours) {
    if (timeWindowHours <= 24) parts.push('(Last 24 Hours)');
    else if (timeWindowHours <= 48) parts.push('(Last 48 Hours)');
    else if (timeWindowHours <= 168) parts.push('(This Past Week)');
    else parts.push('(Past 30 Days)');
  }

  return {
    rawQuery: query,
    hazardType,
    locationKeywords: locationTokens.length > 0 ? locationTokens : undefined,
    isNearMe,
    timeWindowHours,
    isBiggestOnly,
    interpretedDescription: parts.join(' '),
  };
}

/**
 * Filters the real live dataset according to the parsed human query.
 * Strictly checks real data and never invents nonexistent incidents.
 */
export function executeNaturalLanguageSearch(
  events: CalamityEvent[],
  rawQuery: string,
  userLocation: UserGeoLocation | null
): QueryFilterResult {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return {
      matchedEvents: events,
      parsedQuery: { rawQuery: '', interpretedDescription: 'All active events' },
      hasQuery: false,
      appliedFiltersSummary: 'Showing all active verified disasters',
    };
  }

  const parsed = parseNaturalLanguageQuery(trimmed);
  const now = Date.now();

  let filtered = events.filter((ev) => {
    // 1. Hazard Type match
    if (parsed.hazardType && parsed.hazardType !== 'all') {
      if (ev.type !== parsed.hazardType) return false;
    }

    // 2. Time Window match
    if (parsed.timeWindowHours && ev.occurredAt) {
      const eventTime = new Date(ev.occurredAt).getTime();
      const cutoff = now - parsed.timeWindowHours * 60 * 60 * 1000;
      if (eventTime < cutoff) return false;
    }

    // 3. Severity / Biggest filter
    if (parsed.isBiggestOnly) {
      const isCriticalOrHigh = ev.severity === 'CRITICAL' || ev.severity === 'HIGH';
      if (!isCriticalOrHigh) return false;
    }

    // 4. Place name match (if not "near me")
    if (parsed.locationKeywords && parsed.locationKeywords.length > 0 && !parsed.isNearMe) {
      const searchableText = `${ev.name} ${ev.city} ${ev.country} ${ev.type}`.toLowerCase();
      const matchesPlace = parsed.locationKeywords.some((keyword) =>
        searchableText.includes(keyword)
      );
      if (!matchesPlace) return false;
    }

    // 5. "Near me" match (within 500 km radius of user GPS)
    if (parsed.isNearMe && userLocation) {
      const dist = calculatePreciseDistanceKm(
        userLocation.lat,
        userLocation.lng,
        ev.coordinates.lat,
        ev.coordinates.lng
      );
      if (dist > 500) return false;
    }

    return true;
  });

  // If "near me", sort results by distance
  if (parsed.isNearMe && userLocation) {
    filtered = [...filtered].sort((a, b) => {
      const distA = calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, a.coordinates.lat, a.coordinates.lng);
      const distB = calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, b.coordinates.lat, b.coordinates.lng);
      return distA - distB;
    });
  } else if (parsed.isBiggestOnly) {
    // Sort critical first
    filtered = [...filtered].sort((a, b) => {
      const weightA = a.severity === 'CRITICAL' ? 3 : a.severity === 'HIGH' ? 2 : 1;
      const weightB = b.severity === 'CRITICAL' ? 3 : b.severity === 'HIGH' ? 2 : 1;
      return weightB - weightA;
    });
  }

  // Requirement 4: "If there is no data for the question, say 'I don't have data for that.' Do not guess."
  let noDataMessage: string | undefined = undefined;
  if (filtered.length === 0) {
    noDataMessage = `I don't have data for that.`;
  }

  return {
    matchedEvents: filtered,
    parsedQuery: parsed,
    hasQuery: true,
    noDataMessage,
    appliedFiltersSummary: parsed.interpretedDescription,
  };
}
