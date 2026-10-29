import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { calculateDistanceKm } from '../data/populationData';

export interface NewsArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
  socialimage?: string;
}

function classifyDisaster(title: string, description: string = ''): { type: CalamityType | null; confidence: number; keywords: string[] } {
  const text = (title + ' ' + description).toLowerCase();
  
  const patterns: Array<{ type: CalamityType; keywords: string[]; weight: number }> = [
    { type: 'earthquake', keywords: ['earthquake', 'quake', 'tremor', 'seismic', 'aftershock', 'magnitude'], weight: 1.0 },
    { type: 'tsunami', keywords: ['tsunami'], weight: 1.0 },
    { type: 'cyclone', keywords: ['cyclone', 'hurricane', 'typhoon', 'tropical storm', 'super cyclone', 'depression'], weight: 1.0 },
    { type: 'flood', keywords: ['flood', 'flooding', 'flash flood', 'cloudburst', 'inundation', 'deluge'], weight: 0.9 },
    { type: 'wildfire', keywords: ['wildfire', 'forest fire', 'bushfire', 'wild fire', 'fire incident'], weight: 0.9 },
    { type: 'volcano', keywords: ['volcano', 'volcanic', 'eruption', 'lava', 'ash cloud'], weight: 1.0 },
    { type: 'landslide', keywords: ['landslide', 'mudslide', 'debris flow', 'slope collapse'], weight: 0.9 },
    { type: 'avalanche', keywords: ['avalanche'], weight: 1.0 },
    { type: 'blizzard', keywords: ['blizzard', 'snowstorm', 'heavy snowfall'], weight: 0.8 },
    { type: 'tornado', keywords: ['tornado', 'twister'], weight: 1.0 },
    { type: 'drought', keywords: ['drought', 'water scarcity'], weight: 0.8 },
    { type: 'extreme_temp', keywords: ['heatwave', 'heat wave', 'cold wave', 'extreme heat', 'scorching', 'record heat'], weight: 0.8 },
    { type: 'virus', keywords: ['virus outbreak', 'disease outbreak', 'epidemic', 'infection cluster'], weight: 0.7 },
    { type: 'pandemic', keywords: ['pandemic'], weight: 0.9 },
  ];
  
  let bestMatch: { type: CalamityType | null; confidence: number; keywords: string[] } = { type: null, confidence: 0, keywords: [] };
  
  for (const pattern of patterns) {
    const matches = pattern.keywords.filter(k => text.includes(k));
    if (matches.length > 0) {
      const confidence = Math.min(0.95, (matches.length / pattern.keywords.length) * pattern.weight + 0.3);
      if (confidence > bestMatch.confidence) {
        bestMatch = { type: pattern.type, confidence, keywords: matches };
      }
    }
  }
  
  return bestMatch;
}

function extractLocation(title: string): { city: string; country: string } {
  // Try to extract location patterns
  const commonCountries = [
    'india', 'pakistan', 'bangladesh', 'nepal', 'sri lanka', 'china', 'japan', 'indonesia', 
    'philippines', 'vietnam', 'thailand', 'myanmar', 'usa', 'united states', 'mexico', 
    'australia', 'afghanistan', 'iran', 'turkey', 'italy', 'greece', 'spain', 'chile', 
    'peru', 'ecuador', 'colombia', 'brazil'
  ];
  
  const text = title.toLowerCase();
  for (const country of commonCountries) {
    if (text.includes(country)) {
      // Try to find city before country
      const idx = text.indexOf(country);
      const before = title.substring(Math.max(0, idx - 40), idx).trim();
      const words = before.split(/[\s,]+/).filter(w => w.length > 2);
      const city = words.slice(-2).join(' ') || country;
      return { city: city.charAt(0).toUpperCase() + city.slice(1), country: country === 'usa' || country === 'united states' ? 'United States' : country.charAt(0).toUpperCase() + country.slice(1) };
    }
  }
  
  return { city: 'Affected Region', country: 'Unknown' };
}

// Approximate coordinates for common disaster-prone regions
const regionCoords: Record<string, [number, number]> = {
  'india': [20.5937, 78.9629],
  'pakistan': [30.3753, 69.3451],
  'bangladesh': [23.685, 90.3563],
  'nepal': [28.3949, 84.124],
  'sri lanka': [7.8731, 80.7718],
  'china': [35.8617, 104.1954],
  'japan': [36.2048, 138.2529],
  'indonesia': [ -0.7893, 113.9213],
  'philippines': [12.8797, 121.774],
  'vietnam': [14.0583, 108.2772],
  'thailand': [15.87, 100.9925],
  'myanmar': [21.9162, 95.956],
  'usa': [37.0902, -95.7129],
  'mexico': [23.6345, -102.5528],
  'australia': [-25.2744, 133.7751],
  'afghanistan': [33.9391, 67.71],
  'iran': [32.4279, 53.688],
  'turkey': [38.9637, 35.2433],
  'italy': [41.8719, 12.5674],
  'chile': [-35.6751, -71.543],
  'peru': [-9.19, -75.0152],
  'ecuador': [-1.8312, -78.1834],
};

export function newsArticleToEvent(article: NewsArticle, index: number): CalamityEvent | null {
  const classification = classifyDisaster(article.title);
  if (!classification.type || classification.confidence < 0.4) {
    return null;
  }
  
  const location = extractLocation(article.title);
  const countryLower = location.country.toLowerCase();
  let coords: [number, number] = regionCoords[countryLower] || [20, 0];
  // Add some randomness to spread multiple events
  coords = [coords[0] + (Math.random() - 0.5) * 4, coords[1] + (Math.random() - 0.5) * 8];
  
  const severity: SeverityLevel = classification.confidence > 0.8 ? 'HIGH' : 'MODERATE';
  const basePop = classification.type === 'cyclone' ? 200000 : classification.type === 'earthquake' ? 150000 : 50000;
  const dangerZonePop = Math.round(basePop * (0.5 + Math.random() * 0.5));
  
  const seendate = article.seendate;
  let occurredAt = new Date().toISOString();
  try {
    // GDELT format: YYYYMMDDTHHMMSSZ
    if (seendate && seendate.length >= 8) {
      const year = seendate.substring(0, 4);
      const month = seendate.substring(4, 6);
      const day = seendate.substring(6, 8);
      const hour = seendate.substring(9, 11) || '00';
      const min = seendate.substring(11, 13) || '00';
      const sec = seendate.substring(13, 15) || '00';
      occurredAt = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
    }
  } catch {}
  
  return {
    id: `news-live-${Date.now()}-${index}`,
    name: `LIVE: ${article.title.substring(0, 80)}${article.title.length > 80 ? '...' : ''}`,
    type: classification.type,
    country: location.country,
    city: location.city,
    coordinates: { lat: coords[0], lng: coords[1] },
    severity: severity,
    intensity: {
      scaleName: 'News-Based Assessment',
      value: classification.confidence > 0.7 ? 'Significant' : 'Developing',
      unit: 'Confidence',
      interpretation: `Detected from live news via GDELT. Keywords: ${classification.keywords.join(', ')}`,
      secondaryMetric: {
        label: 'News Source',
        value: article.domain,
      },
    },
    satelliteTelemetry: {
      satellite: 'GDELT Global News Monitoring',
      sensor: 'Real-time News Event Detection',
      lastPassTime: new Date().toISOString(),
      confidence: Math.round(classification.confidence * 100),
    },
    officialAgency: {
      agencyName: 'GDELT Project - Global Database of Events, Language, and Tone',
      agencyAcronym: 'GDELT',
      bulletinId: `news-${index}`,
      officialBulletinUrl: article.url,
      verbatimWarningText: article.title,
      issuingOffice: 'GDELT Media Monitoring Network',
      alertLevelCode: severity === 'HIGH' ? 'NEWS ALERT' : 'NEWS MONITOR',
    },
    civilDefenseDirectives: {
      issuingAgency: 'Local Authorities (Verify via Official Channels)',
      mandatoryAction: 'Monitor official disaster management agencies for confirmed alerts. Verify information through government sources.',
      evacuationPerimeterKm: classification.type === 'cyclone' ? 50 : 20,
      safeEvacuationCorridors: ['Follow local emergency management directives'],
      localEmergencyNumber: location.country.toLowerCase() === 'india' ? '112 / NDMA Helpline 1078' : '112 / Local Emergency Services',
      shelterLocationsNotice: 'Check with local disaster management authority for shelter locations.',
      liabilityNotice: 'News-based detection - always verify with official sources before taking action.',
    },
    medicalEmergency: {
      isMedicalAlert: severity === 'HIGH',
      affectedPopulation: dangerZonePop,
      casualtiesEstimated: 0,
      hospitalPressure: severity === 'HIGH' ? 'HIGH' : 'MODERATE',
      pathogenOrCondition: classification.type === 'flood' ? 'Waterborne Disease Risk' : 'Monitor for injuries',
      bloodAndMedicalSuppliesNeeded: ['First Aid Supplies'],
    },
    publicAdvisory: {
      headline: `NEWS ALERT: ${article.title}`,
      immediateAction: 'Stay tuned to official government disaster alerts and local emergency broadcasts.',
      evacuationZoneKm: classification.type === 'cyclone' ? 50 : 20,
      safeCorridors: ['Follow official evacuation orders'],
      emergencyContact: location.country.toLowerCase() === 'india' ? 'NDMA India: 1078 or 112' : 'Local Emergency Services: 112',
    },
    dataFreshness: {
      lastSyncedUtc: new Date().toISOString(),
      latencyMinutes: Math.max(0, Math.round((Date.now() - new Date(occurredAt).getTime()) / 60000)),
      isStale: false,
      staleThresholdMinutes: 120,
    },
    occurredAt: occurredAt,
    updatedAt: occurredAt,
    source: 'GDELT Live News Monitoring (Real-time)',
    isLiveFeed: true,
    liveFeedSource: 'NEWS_GDELT',
    liveIngestionTime: new Date().toLocaleTimeString(),
    rawFeedUrl: article.url,
  };
}
