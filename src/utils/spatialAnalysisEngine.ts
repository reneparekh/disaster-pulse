import { 
  IsochroneResult, 
  IsochroneContour, 
  TravelMode, 
  AHPCriterion, 
  EvaluatedShelter, 
  TerrainElevationProfilePoint 
} from '../types/geospatial';

/**
 * Advanced Spatial Analysis & Geoprocessing Engine
 * Isochrone reachability, AHP Multi-Criteria Decision Analysis, and 3D DEM Profiles.
 */

// Speeds for different evacuation transport modes (km/h)
const TRAVEL_SPEEDS: Record<TravelMode, number> = {
  pedestrian: 4.5,
  vehicle: 42.0,
  emergency_evacuation: 65.0,
};

/**
 * Generates polygon coordinates for an isochrone contour
 * using geodesic radial offsets with terrain roughness distortion
 */
function generateGeodesicPolygon(
  centerLat: number, 
  centerLng: number, 
  radiusKm: number, 
  numPoints = 24
): [number, number][] {
  const points: [number, number][] = [];
  const kmPerLatDegree = 111.32;
  const kmPerLngDegree = 111.32 * Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    // Introduce deterministic pseudo-topographic distortion (valleys allow further travel, mountains restrict)
    const distortion = 0.88 + 0.24 * Math.sin(angle * 3 + centerLat) * Math.cos(angle * 2);
    const effRadius = radiusKm * distortion;

    const dLat = (effRadius * Math.sin(angle)) / kmPerLatDegree;
    const dLng = (effRadius * Math.cos(angle)) / kmPerLngDegree;

    points.push([centerLat + dLat, centerLng + dLng]);
  }
  return points;
}

/**
 * Generates 15, 30, and 60-minute Evacuation Isochrone Reachability Polygons
 */
export function generateIsochrones(
  originLat: number,
  originLng: number,
  originName: string,
  mode: TravelMode = 'vehicle'
): IsochroneResult {
  const speed = TRAVEL_SPEEDS[mode] || 42.0;

  const intervals = [
    { minutes: 15, color: '#10b981', label: '15 Min Immediate Evac' },
    { minutes: 30, color: '#f59e0b', label: '30 Min Secondary Corridor' },
    { minutes: 60, color: '#8b5cf6', label: '60 Min Extended Zone' },
  ];

  const contours: IsochroneContour[] = intervals.map((int) => {
    const hours = int.minutes / 60;
    // Radius in km with road network circuity factor (~0.85)
    const radiusKm = +(speed * hours * 0.85).toFixed(1);
    const areaKm2 = +(Math.PI * radiusKm * radiusKm * 0.78).toFixed(1);

    const popDensityEstimated = 350; // people / km2
    const populationCovered = Math.round(areaKm2 * popDensityEstimated);
    const reachableSheltersCount = Math.max(1, Math.round(areaKm2 / 45));

    const polygonCoordinates = generateGeodesicPolygon(originLat, originLng, radiusKm);

    return {
      minutes: int.minutes,
      radiusKm,
      areaKm2,
      color: int.color,
      populationCovered,
      reachableSheltersCount,
      polygonCoordinates,
    };
  });

  return {
    originLat,
    originLng,
    originName,
    mode,
    speedKmH: speed,
    contours,
  };
}

// --- Spatial MCDA / AHP Shelter Suitability ---

export const DEFAULT_AHP_CRITERIA: AHPCriterion[] = [
  {
    id: 'slope',
    name: 'Topographic Slope Gradient',
    description: 'Flat terrain (slope < 5°) prevents mudslide and structural slide risk.',
    weight: 0.30,
    idealDirection: 'min',
    unit: 'degrees',
  },
  {
    id: 'flood',
    name: 'Elevation Above 100-Yr Flood Line',
    description: 'Vertical clearance above maximum inundation and storm surge watermark.',
    weight: 0.30,
    idealDirection: 'max',
    unit: 'meters',
  },
  {
    id: 'hospital',
    name: 'Proximity to Regional Trauma Center',
    description: 'Rapid ambulance transit for severe casualties requiring surgery or oxygen.',
    weight: 0.22,
    idealDirection: 'min',
    unit: 'km',
  },
  {
    id: 'road',
    name: 'Arterial Highway Access & Dual-Carriageway',
    description: 'Multi-lane pavement ensuring unblocked heavy relief supply logistics.',
    weight: 0.18,
    idealDirection: 'max',
    unit: 'status index',
  },
];

export const MOCK_REGIONAL_SHELTERS: EvaluatedShelter[] = [
  {
    id: 'sh-01',
    name: 'Central Municipal Sports Complex & Gymnasium',
    coordinates: { lat: 0, lng: 0 },
    capacityPeople: 4500,
    currentOccupancy: 820,
    slopeDegrees: 2.1,
    elevationAboveFloodM: 18.5,
    distanceToHospitalKm: 2.4,
    accessRoadStatus: 'CLEAR_HIGHWAY',
    suitabilityScore: 92.4,
    suitabilityGrade: 'OPTIMAL',
  },
  {
    id: 'sh-02',
    name: 'Highland Polytechnic Campus Dormitories',
    coordinates: { lat: 0, lng: 0 },
    capacityPeople: 2800,
    currentOccupancy: 350,
    slopeDegrees: 4.8,
    elevationAboveFloodM: 32.0,
    distanceToHospitalKm: 5.6,
    accessRoadStatus: 'SECONDARY_ROAD',
    suitabilityScore: 84.1,
    suitabilityGrade: 'FAVORABLE',
  },
  {
    id: 'sh-03',
    name: 'Riverside Agricultural Expo Pavilion',
    coordinates: { lat: 0, lng: 0 },
    capacityPeople: 3200,
    currentOccupancy: 1100,
    slopeDegrees: 1.5,
    elevationAboveFloodM: 3.2,
    distanceToHospitalKm: 7.8,
    accessRoadStatus: 'CLEAR_HIGHWAY',
    suitabilityScore: 61.5,
    suitabilityGrade: 'MARGINAL',
  },
  {
    id: 'sh-04',
    name: 'Valley Foothills Elementary Community Center',
    coordinates: { lat: 0, lng: 0 },
    capacityPeople: 1200,
    currentOccupancy: 950,
    slopeDegrees: 14.2,
    elevationAboveFloodM: 8.0,
    distanceToHospitalKm: 12.1,
    accessRoadStatus: 'UNPAVED',
    suitabilityScore: 41.2,
    suitabilityGrade: 'UNSUITABLE',
  },
];

/**
 * Re-scores shelter suitability using user-defined AHP weights
 */
export function evaluateSheltersWithAHP(
  shelters: EvaluatedShelter[],
  weights: { slope: number; flood: number; hospital: number; road: number }
): EvaluatedShelter[] {
  const sum = weights.slope + weights.flood + weights.hospital + weights.road;
  const wSlope = weights.slope / sum;
  const wFlood = weights.flood / sum;
  const wHosp = weights.hospital / sum;
  const wRoad = weights.road / sum;

  return shelters.map((sh) => {
    // Normalization scores (0 - 100)
    const slopeScore = Math.max(0, 100 - (sh.slopeDegrees / 15) * 100);
    const floodScore = Math.min(100, (sh.elevationAboveFloodM / 30) * 100);
    const hospScore = Math.max(0, 100 - (sh.distanceToHospitalKm / 15) * 100);
    const roadScore = sh.accessRoadStatus === 'CLEAR_HIGHWAY' ? 100
      : sh.accessRoadStatus === 'SECONDARY_ROAD' ? 75
      : sh.accessRoadStatus === 'UNPAVED' ? 40 : 20;

    const totalScore = +(
      slopeScore * wSlope +
      floodScore * wFlood +
      hospScore * wHosp +
      roadScore * wRoad
    ).toFixed(1);

    const grade: EvaluatedShelter['suitabilityGrade'] = totalScore >= 85 ? 'OPTIMAL'
      : totalScore >= 70 ? 'FAVORABLE'
      : totalScore >= 50 ? 'MARGINAL' : 'UNSUITABLE';

    return {
      ...sh,
      suitabilityScore: totalScore,
      suitabilityGrade: grade,
    };
  }).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// --- 3D Digital Elevation Model & Profile ---

/**
 * Generates an elevation & terrain gradient profile between two coordinates
 */
export function generateTerrainElevationProfile(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
  totalDistanceKm: number,
  numSamples = 20
): TerrainElevationProfilePoint[] {
  const profile: TerrainElevationProfilePoint[] = [];

  // Elevation base baseline depending on latitude
  const baseElev = Math.abs(Math.sin(latA) * 220) + 45;

  for (let i = 0; i <= numSamples; i++) {
    const fraction = i / numSamples;
    const curLat = latA + (latB - latA) * fraction;
    const curLng = lngA + (lngB - lngA) * fraction;
    const distKm = +(totalDistanceKm * fraction).toFixed(2);

    // Realistic orographic topography curve with undulating ridge and valley
    const ridgeHarmonic = Math.sin(fraction * Math.PI) * 420;
    const microUndulation = Math.cos(fraction * Math.PI * 5) * 45;
    const elev = Math.max(12, +(baseElev + ridgeHarmonic + microUndulation).toFixed(1));

    // Slope percentage: rate of change
    const prevElev = i > 0 ? profile[i - 1].elevationM : elev;
    const segmentKm = totalDistanceKm / numSamples;
    const deltaM = Math.abs(elev - prevElev);
    const slopePercent = segmentKm > 0 ? +((deltaM / (segmentKm * 1000)) * 100).toFixed(1) : 0;

    let hazardZoning: 'CLEAR' | 'CAUTION_SLOPE' | 'DEBRIS_CHUTE' | 'AVALANCHE_RUNOUT' = 'CLEAR';
    if (slopePercent > 32) {
      hazardZoning = 'AVALANCHE_RUNOUT';
    } else if (slopePercent > 20) {
      hazardZoning = 'DEBRIS_CHUTE';
    } else if (slopePercent > 12) {
      hazardZoning = 'CAUTION_SLOPE';
    }

    profile.push({
      distanceKm: distKm,
      elevationM: elev,
      slopePercent,
      lat: +curLat.toFixed(4),
      lng: +curLng.toFixed(4),
      hazardZoning,
    });
  }

  return profile;
}
