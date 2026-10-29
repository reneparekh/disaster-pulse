import { CalamityEvent, CalamityType } from './disaster';

// --- 1. Earth Observation & Remote Sensing Types ---
export type SpectralIndexType = 'NDVI' | 'NDWI' | 'MNDWI' | 'NBR' | 'dNBR' | 'SAR_COHERENCE';

export interface SpectralBandConfig {
  name: string;
  formula: string;
  primaryApplication: string;
  interpretationRanges: {
    min: number;
    max: number;
    label: string;
    color: string;
  }[];
}

export interface SatelliteOverpass {
  satelliteName: string;
  constellation: string;
  sensor: string;
  nextPassUtc: string;
  minutesUntilPass: number;
  lookAngleDegrees: number;
  swathWidthKm: number;
  spatialResolutionM: number;
  acquisitionMode: string;
  targetIncidentName: string;
}

export interface InSARDamageProxy {
  sceneId: string;
  referenceDate: string;
  secondaryDate: string;
  temporalBaselineDays: number;
  perpendicularBaselineM: number;
  meanCoherenceLoss: number; // 0.0 - 1.0
  damageSeverityAreaKm2: {
    severeCollapse: number;
    moderateStructural: number;
    minorSlight: number;
  };
}

// --- 2. Advanced Spatial Analysis & Isochrones ---
export type TravelMode = 'pedestrian' | 'vehicle' | 'emergency_evacuation';

export interface IsochroneContour {
  minutes: number; // 15, 30, 60
  radiusKm: number;
  areaKm2: number;
  color: string;
  populationCovered: number;
  reachableSheltersCount: number;
  polygonCoordinates: [number, number][]; // lat, lng points
}

export interface IsochroneResult {
  originLat: number;
  originLng: number;
  originName: string;
  mode: TravelMode;
  speedKmH: number;
  contours: IsochroneContour[];
}

// --- 3. Spatial MCDA / AHP Shelter Suitability ---
export interface AHPCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 0.0 - 1.0 (sums to 1)
  idealDirection: 'min' | 'max' | 'target';
  unit: string;
}

export interface EvaluatedShelter {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  capacityPeople: number;
  currentOccupancy: number;
  slopeDegrees: number;
  elevationAboveFloodM: number;
  distanceToHospitalKm: number;
  accessRoadStatus: 'CLEAR_HIGHWAY' | 'SECONDARY_ROAD' | 'UNPAVED' | 'RESTRICTED';
  suitabilityScore: number; // 0 - 100
  suitabilityGrade: 'OPTIMAL' | 'FAVORABLE' | 'MARGINAL' | 'UNSUITABLE';
}

// --- 4. Cascading Multi-Hazard & Dispersion ---
export interface CascadingHazardNode {
  id: string;
  hazardType: CalamityType;
  title: string;
  triggerProbability: number; // 0 - 100%
  expectedLagHours: number;
  impactMagnitude: string;
  status: 'TRIGGERED' | 'ELEVATED_THREAT' | 'MONITORING' | 'MITIGATED';
  dependencies: string[]; // parent node IDs
  mitigationStrategy: string;
}

export interface PlumeDispersionPoint {
  lat: number;
  lng: number;
  concentrationPpm: number;
  distanceDownwindKm: number;
  dispersionWidthKm: number;
  airQualityIndex: number;
  altitudeM: number;
}

export interface TropicalCycloneTrackForecast {
  stormName: string;
  currentIntensityCat: number; // 1-5
  centralPressureHpa: number;
  maxWindsKmh: number;
  coneForecastPoints: {
    hoursAhead: number; // 0, 24, 48, 72, 120
    lat: number;
    lng: number;
    uncertaintyRadiusKm: number;
    predictedWindsKmh: number;
    category: string;
  }[];
}

// --- 5. GIS Interoperability & OGC ---
export interface OGCWebLayer {
  id: string;
  title: string;
  serviceType: 'WMS' | 'WMTS' | 'XYZ';
  url: string;
  layers?: string;
  attribution: string;
  opacity: number;
  visible: boolean;
}

export interface TerrainElevationProfilePoint {
  distanceKm: number;
  elevationM: number;
  slopePercent: number;
  lat: number;
  lng: number;
  hazardZoning?: 'CLEAR' | 'CAUTION_SLOPE' | 'DEBRIS_CHUTE' | 'AVALANCHE_RUNOUT';
}
