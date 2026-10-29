export type CalamityType =
  | 'volcano'
  | 'tsunami'
  | 'earthquake'
  | 'wildfire'
  | 'virus'
  | 'landslide'
  | 'avalanche'
  | 'cyclone'
  | 'tornado'
  | 'flood'
  | 'drought'
  | 'blizzard'
  | 'extreme_temp'
  | 'pandemic';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'ADVISORY';

export interface OfficialAgencySource {
  agencyName: string; // e.g. "USGS Earthquake Hazards Program", "GDACS / JRC European Commission", "NASA FIRMS", "IMD Tropical Cyclone Warning"
  agencyAcronym: 'USGS' | 'GDACS' | 'NASA' | 'NOAA' | 'IMD' | 'JMA' | 'BOM' | 'COPERNICUS' | 'PVMBG' | 'GDELT' | 'OTHER';
  bulletinId?: string;
  officialBulletinUrl: string;
  verbatimWarningText: string;
  issuingOffice: string;
  alertLevelCode: string; // e.g. "PAGER RED", "GDACS RED ALERT", "WARNING CAT 5"
}

export interface CalamityEvent {
  id: string;
  name: string;
  type: CalamityType;
  country: string;
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  // Optional actual hazard boundary polygon footprint (lat, lng pairs)
  hazardAreaPolygon?: [number, number][];
  severity: SeverityLevel;
  
  // Explicit distinction: Source Magnitude vs Local Felt/Impact Intensity
  magnitude?: {
    value: number | string;
    scale: string; // e.g. "Mw (Moment Magnitude)", "Mb", "Richter"
    depthKm?: number;
    epicenterDescription?: string;
  };

  intensity: {
    scaleName: string; // Official regional scale: e.g. "Modified Mercalli (MMI)", "Saffir-Simpson (Cat 1-5)", "IMD Cyclone Scale", "VEI"
    value: number | string;
    unit: string;
    interpretation: string;
    secondaryMetric?: {
      label: string;
      value: string | number;
    };
  };

  satelliteTelemetry: {
    satellite: string;
    sensor: string;
    lastPassTime: string;
    thermalAnomalyOrRad?: string;
    cloudOrPlumeTop?: string;
    confidence: number; // percentage
  };

  // Official Civil Defense and Evacuation Directives (replacing speculative AI medical prescriptions)
  civilDefenseDirectives?: {
    issuingAgency: string;
    mandatoryAction: string;
    evacuationPerimeterKm: number;
    safeEvacuationCorridors: string[];
    localEmergencyNumber: string; // "911", "112", etc.
    shelterLocationsNotice: string;
    liabilityNotice: string;
  };

  // Deprecated backwards-compatible field (retaining affectedPopulation without medical prescribing)
  medicalEmergency: {
    isMedicalAlert: boolean;
    affectedPopulation: number;
    casualtiesEstimated?: number;
    hospitalPressure: 'CRITICAL_OVERWHELMED' | 'HIGH' | 'MODERATE' | 'NORMAL';
    pathogenOrCondition?: string;
    quarantineLevel?: string;
    bloodAndMedicalSuppliesNeeded?: string[];
  };

  publicAdvisory: {
    headline: string;
    immediateAction: string;
    evacuationZoneKm: number;
    safeCorridors: string[];
    emergencyContact: string;
  };

  // Official Source & Data Freshness Tracking
  officialAgency?: OfficialAgencySource;
  dataFreshness?: {
    lastSyncedUtc: string;
    latencyMinutes: number;
    isStale: boolean;
    staleThresholdMinutes: number;
    sensorPassAgeHours?: number;
    stalenessWarningNotice?: string;
  };

  occurredAt: string; // ISO 8601 string of actual occurrence date & time
  occurrenceTimeLocal?: string; // Optional local time string for the affected zone
  updatedAt: string;
  source: string;
  isLiveFeed?: boolean;
  liveFeedSource?: 'USGS' | 'NASA_EONET' | 'OPEN_METEO' | string;
  liveIngestionTime?: string;
  rawFeedUrl?: string;
}

export interface CalamityMetadata {
  id: CalamityType;
  title: string;
  iconName: string;
  color: string;
  scientificScale: string;
  description: string;
}
