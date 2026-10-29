import { CalamityEvent } from '../types/disaster';

export interface UserGeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  name: string;
  source: 'browser' | 'preset' | 'ip';
  timestamp: number;
  isSimulated?: boolean;
}

export interface LocalHazardInfo {
  event: CalamityEvent;
  distanceKm: number;
  isCritical: boolean;
  isWithinRadius: boolean;
}

// Preset locations near active CRITICAL hazards for immediate testing & simulation
export const TEST_LOCATION_PRESETS: Array<{
  name: string;
  description: string;
  lat: number;
  lng: number;
  targetHazard: string;
}> = [
  {
    name: 'Padang, West Sumatra (Indonesia)',
    description: '72 km from Mount Marapi Explosive Eruption',
    lat: -0.9492,
    lng: 100.3543,
    targetHazard: 'Mount Marapi (CRITICAL Volcano)',
  },
  {
    name: 'Gaziantep / Iskenderun (Turkey)',
    description: '115 km from Antakya Fault Deep Rupture',
    lat: 37.0662,
    lng: 37.3833,
    targetHazard: 'Antakya Rupture (CRITICAL Earthquake)',
  },
  {
    name: 'Suva, Fiji (South Pacific)',
    description: '280 km from Tonga Seismic Tsunami Watch',
    lat: -18.1416,
    lng: 178.4419,
    targetHazard: 'South Pacific Watch (CRITICAL Tsunami)',
  },
  {
    name: 'Redding / Shasta County (California)',
    description: '35 km from Chaparral Ridge Mega-Wildfire',
    lat: 40.5865,
    lng: -122.3917,
    targetHazard: 'Chaparral Ridge (HIGH/CRITICAL Wildfire)',
  },
  {
    name: 'Valencia / Catarroja (Spain)',
    description: '12 km from Mediterranean Inundation',
    lat: 39.4699,
    lng: -0.3763,
    targetHazard: 'Valencia Basin (CRITICAL/HIGH Flood)',
  },
];

/**
 * Calculates great-circle distance between two points on the Earth's surface using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates high-precision distance in kilometers between two coordinates
 */
export function calculatePreciseDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return dist < 10 ? Math.round(dist * 100) / 100 : Math.round(dist * 10) / 10;
}

/**
 * Interpolates points along the great-circle arc connecting two coordinates
 */
export function interpolateGreatCirclePoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  steps = 24
): [number, number][] {
  const points: [number, number][] = [];
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const phi1 = lat1 * toRad;
  const lambda1 = lon1 * toRad;
  const phi2 = lat2 * toRad;
  const lambda2 = lon2 * toRad;

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((phi2 - phi1) / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2
    )
  );

  if (d === 0 || isNaN(d)) {
    return [[lat1, lon1], [lat2, lon2]];
  }

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
    const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);

    const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lambda = Math.atan2(y, x);

    points.push([phi * toDeg, lambda * toDeg]);
  }

  return points;
}

/**
 * Identifies all disasters within the given radius (default 500 km)
 * and classifies which ones are CRITICAL triggering the 'Local Hazard Alert'
 */
export function findNearbyHazards(
  events: CalamityEvent[],
  userLoc: UserGeoLocation | null,
  radiusKm = 500
): {
  localCriticalHazards: LocalHazardInfo[];
  allNearbyHazards: LocalHazardInfo[];
  closestHazard: LocalHazardInfo | null;
} {
  if (!userLoc) {
    return {
      localCriticalHazards: [],
      allNearbyHazards: [],
      closestHazard: null,
    };
  }

  const allWithDistances: LocalHazardInfo[] = events.map(ev => {
    const distanceKm = calculateDistanceKm(
      userLoc.lat,
      userLoc.lng,
      ev.coordinates.lat,
      ev.coordinates.lng
    );
    const isCritical = ev.severity === 'CRITICAL';
    const isWithinRadius = distanceKm <= radiusKm;

    return {
      event: ev,
      distanceKm,
      isCritical,
      isWithinRadius,
    };
  });

  allWithDistances.sort((a, b) => a.distanceKm - b.distanceKm);

  const allNearbyHazards = allWithDistances.filter(h => h.isWithinRadius);
  const localCriticalHazards = allWithDistances.filter(h => h.isWithinRadius && h.isCritical);
  const closestHazard = allWithDistances.length > 0 ? allWithDistances[0] : null;

  return {
    localCriticalHazards,
    allNearbyHazards,
    closestHazard,
  };
}

/**
 * Requests the user's browser location via navigator.geolocation API with robust fallback
 */
export function requestBrowserLocation(): Promise<UserGeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your device or browser.'));
      return;
    }

    // Attempt high-accuracy GPS first with a 6-second timeout
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          name: 'Your Current Precise Location',
          source: 'browser',
          timestamp: Date.now(),
        });
      },
      _highAccError => {
        // Fall back to standard/network-based geolocation (essential for indoor mobile & WebViews)
        navigator.geolocation.getCurrentPosition(
          fallbackPos => {
            resolve({
              lat: fallbackPos.coords.latitude,
              lng: fallbackPos.coords.longitude,
              accuracy: fallbackPos.coords.accuracy,
              name: 'Approximate Location (Network/Cell)',
              source: 'browser',
              timestamp: Date.now(),
            });
          },
          fallbackErr => {
            let msg = 'Unable to retrieve location.';
            if (fallbackErr.code === fallbackErr.PERMISSION_DENIED) {
              msg = 'Location permission was denied. Please allow location access in your system/browser settings.';
            } else if (fallbackErr.code === fallbackErr.POSITION_UNAVAILABLE) {
              msg = 'Location information is currently unavailable.';
            } else if (fallbackErr.code === fallbackErr.TIMEOUT) {
              msg = 'Location request timed out. Please verify GPS/Network connection.';
            }
            reject(new Error(msg));
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Calculates the Universal Transverse Mercator (UTM) zone for given longitude and latitude.
 * In Geoinformatics, UTM is the standard projection reference for local cartography and disaster response.
 */
export function calculateUtmZone(lng: number, lat: number): string {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return 'UTM N/A';
  // Normalize longitude to -180..180
  let normLng = ((lng + 180) % 360 + 360) % 360 - 180;
  const zoneNumber = Math.min(60, Math.max(1, Math.floor((normLng + 180) / 6) + 1));
  const hemisphere = lat >= 0 ? 'N' : 'S';
  return `UTM Zone ${zoneNumber}${hemisphere}`;
}

/**
 * Converts decimal degrees coordinate into Degrees, Minutes, Seconds (DMS) notation.
 */
export function toDms(coordinate: number, isLatitude: boolean): string {
  if (!Number.isFinite(coordinate)) return '0°0\'0"';
  const absolute = Math.abs(coordinate);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.round((minutesNotTruncated - minutes) * 60);
  const direction = isLatitude
    ? coordinate >= 0 ? 'N' : 'S'
    : coordinate >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

export interface GisFormattedCoordinates {
  decimal: string;
  dms: string;
  utm: string;
  copyText: string;
}

/**
 * Produces structured GIS coordinate formats for mapping readouts and clipboard export
 */
export function formatGisCoordinates(lat: number, lng: number): GisFormattedCoordinates {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      decimal: 'N/A',
      dms: 'N/A',
      utm: 'N/A',
      copyText: 'N/A',
    };
  }

  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  const decimal = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
  const dms = `${toDms(lat, true)} ${toDms(lng, false)}`;
  const utm = calculateUtmZone(lng, lat);
  const copyText = `${lat.toFixed(5)}, ${lng.toFixed(5)} (${utm})`;

  return {
    decimal,
    dms,
    utm,
    copyText,
  };
}
