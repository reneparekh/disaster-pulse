import { CalamityEvent } from '../types/disaster';
import { 
  CascadingHazardNode, 
  PlumeDispersionPoint, 
  TropicalCycloneTrackForecast 
} from '../types/geospatial';

/**
 * Cascading Multi-Hazard Simulation & GeoAI Dispersion Engine
 */

/**
 * Generates a cascading disaster chain network for a given trigger calamity
 */
export function generateHazardCascadeChain(event: CalamityEvent): CascadingHazardNode[] {
  const isCritical = event.severity === 'CRITICAL';

  switch (event.type) {
    case 'earthquake':
      return [
        {
          id: 'casc-01',
          hazardType: 'earthquake',
          title: `Primary Rupture: ${event.name}`,
          triggerProbability: 100,
          expectedLagHours: 0,
          impactMagnitude: `${event.intensity.value} Mainshock`,
          status: 'TRIGGERED',
          dependencies: [],
          mitigationStrategy: 'Drop, Cover, and Hold on; shut off municipal natural gas mains.',
        },
        {
          id: 'casc-02',
          hazardType: 'tsunami',
          title: 'Subsea Seafloor Uplift & Tsunami Ocean Surge',
          triggerProbability: isCritical ? 92 : 45,
          expectedLagHours: 0.75,
          impactMagnitude: '3.2m Peak Run-up Amplitude',
          status: isCritical ? 'TRIGGERED' : 'ELEVATED_THREAT',
          dependencies: ['casc-01'],
          mitigationStrategy: 'Immediate vertical coastal evacuation above 20m contour.',
        },
        {
          id: 'casc-03',
          hazardType: 'landslide',
          title: 'Steep Escarpment Seismically-Induced Rockslide',
          triggerProbability: 78,
          expectedLagHours: 1.5,
          impactMagnitude: '1.2M m³ Debris Flow',
          status: 'ELEVATED_THREAT',
          dependencies: ['casc-01'],
          mitigationStrategy: 'Close mountain pass roads and clear settlements beneath scree slopes.',
        },
        {
          id: 'casc-04',
          hazardType: 'flood',
          title: 'Liquefaction & Water Mains Hydraulic Rupture',
          triggerProbability: 64,
          expectedLagHours: 4.0,
          impactMagnitude: 'Subsurface Geyser Flooding',
          status: 'MONITORING',
          dependencies: ['casc-01'],
          mitigationStrategy: 'Deploy portable desalinization and bladder water tankers.',
        },
      ];

    case 'wildfire':
      return [
        {
          id: 'casc-fire-01',
          hazardType: 'wildfire',
          title: `Primary Front: ${event.name}`,
          triggerProbability: 100,
          expectedLagHours: 0,
          impactMagnitude: 'Active Crown Fire (>4,500 MW)',
          status: 'TRIGGERED',
          dependencies: [],
          mitigationStrategy: 'Aerial retardant drops; mandatory residential evacuation.',
        },
        {
          id: 'casc-fire-02',
          hazardType: 'extreme_temp',
          title: 'Pyrocumulonimbus Thermal Heat Dome',
          triggerProbability: 84,
          expectedLagHours: 2.0,
          impactMagnitude: '48°C Canopy Air Temp Spike',
          status: 'TRIGGERED',
          dependencies: ['casc-fire-01'],
          mitigationStrategy: 'Hydration centers and thermal stress shelters for firefighters.',
        },
        {
          id: 'casc-fire-03',
          hazardType: 'landslide',
          title: 'Post-Fire Hydrophobic Soil Debris Flow (Next Rain)',
          triggerProbability: 88,
          expectedLagHours: 48.0,
          impactMagnitude: 'Saturated Ash & Mud Slurry',
          status: 'ELEVATED_THREAT',
          dependencies: ['casc-fire-01'],
          mitigationStrategy: 'Install K-rails and concrete deflection jersey barriers along canyons.',
        },
      ];

    case 'volcano':
      return [
        {
          id: 'casc-volc-01',
          hazardType: 'volcano',
          title: `Crater Venting: ${event.name}`,
          triggerProbability: 100,
          expectedLagHours: 0,
          impactMagnitude: 'Plinian Ash Column (FL280)',
          status: 'TRIGGERED',
          dependencies: [],
          mitigationStrategy: 'Enforce 6km exclusion perimeter and ground commercial flights.',
        },
        {
          id: 'casc-volc-02',
          hazardType: 'landslide',
          title: 'Rain-Triggered Cold Lahar River Surge',
          triggerProbability: 79,
          expectedLagHours: 6.0,
          impactMagnitude: 'Hyper-concentrated Volcanic Slurry',
          status: 'ELEVATED_THREAT',
          dependencies: ['casc-volc-01'],
          mitigationStrategy: 'Divert river weirs and clear bridge piers of log-jam debris.',
        },
        {
          id: 'casc-volc-03',
          hazardType: 'virus',
          title: 'Silicosis ARDS Mass Respiratory Overload',
          triggerProbability: 72,
          expectedLagHours: 12.0,
          impactMagnitude: '15,000 Inhalation Casualties',
          status: 'MONITORING',
          dependencies: ['casc-volc-01'],
          mitigationStrategy: 'Preposition medical oxygen concentrators and N95 masks.',
        },
      ];

    default:
      return [
        {
          id: 'casc-gen-01',
          hazardType: event.type,
          title: `Primary Threat: ${event.name}`,
          triggerProbability: 100,
          expectedLagHours: 0,
          impactMagnitude: `${event.intensity.value}`,
          status: 'TRIGGERED',
          dependencies: [],
          mitigationStrategy: event.publicAdvisory.immediateAction,
        },
        {
          id: 'casc-gen-02',
          hazardType: 'flood',
          title: 'Critical Infrastructure Drainage Overload',
          triggerProbability: 60,
          expectedLagHours: 6,
          impactMagnitude: 'Secondary Municipal Flooding',
          status: 'ELEVATED_THREAT',
          dependencies: ['casc-gen-01'],
          mitigationStrategy: 'Preposition submersible dewatering pumps.',
        },
      ];
  }
}

/**
 * Calculates atmospheric Gaussian smoke / ash plume dispersion downwind
 */
export function calculateGaussianPlumeDispersion(
  originLat: number,
  originLng: number,
  windAzimuthDeg = 65, // wind blowing towards East-North-East
  windSpeedKmh = 28,
  emissionRateKgSec = 450
): PlumeDispersionPoint[] {
  const points: PlumeDispersionPoint[] = [];
  const rad = (windAzimuthDeg * Math.PI) / 180;
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos((originLat * Math.PI) / 180);

  const downwindDistancesKm = [2, 5, 12, 25, 45, 80, 140];

  downwindDistancesKm.forEach((distKm) => {
    // Standard Pasquill-Gifford dispersion coefficients
    const sigmaY = 0.16 * Math.pow(distKm, 0.9); // crosswind spread in km
    const dLat = (distKm * Math.cos(rad)) / kmPerLat;
    const dLng = (distKm * Math.sin(rad)) / kmPerLng;

    // Centerline concentration decay inversely proportional to wind speed and dispersion width
    const concentrationPpm = +(
      (emissionRateKgSec / (windSpeedKmh * sigmaY * 12)) *
      Math.exp(-0.015 * distKm)
    ).toFixed(1);

    const aqi = Math.min(500, Math.round(concentrationPpm * 14 + 40));

    points.push({
      lat: +(originLat + dLat).toFixed(4),
      lng: +(originLng + dLng).toFixed(4),
      distanceDownwindKm: distKm,
      dispersionWidthKm: +(sigmaY * 2.5).toFixed(1),
      concentrationPpm,
      airQualityIndex: aqi,
      altitudeM: Math.round(180 + distKm * 35),
    });
  });

  return points;
}

/**
 * Generates Tropical Cyclone Forward Ensemble Track & Cone of Uncertainty
 */
export function generateTropicalCycloneCone(
  startLat: number,
  startLng: number,
  stormName = 'Super Typhoon / Tropical Cyclone'
): TropicalCycloneTrackForecast {
  const forecastHorizons = [
    { hours: 0, deltaLat: 0, deltaLng: 0, uncertaintyKm: 18, winds: 215, cat: 'Category 4' },
    { hours: 24, deltaLat: 1.8, deltaLng: -2.4, uncertaintyKm: 75, winds: 225, cat: 'Category 4 Super Typhoon' },
    { hours: 48, deltaLat: 3.9, deltaLng: -5.1, uncertaintyKm: 145, winds: 240, cat: 'Category 5 Violent' },
    { hours: 72, deltaLat: 6.2, deltaLng: -7.5, uncertaintyKm: 230, winds: 195, cat: 'Category 3 Post-Landfall' },
    { hours: 120, deltaLat: 9.8, deltaLng: -9.8, uncertaintyKm: 390, winds: 120, cat: 'Tropical Storm Remnants' },
  ];

  return {
    stormName,
    currentIntensityCat: 4,
    centralPressureHpa: 932,
    maxWindsKmh: 215,
    coneForecastPoints: forecastHorizons.map((f) => ({
      hoursAhead: f.hours,
      lat: +(startLat + f.deltaLat).toFixed(4),
      lng: +(startLng + f.deltaLng).toFixed(4),
      uncertaintyRadiusKm: f.uncertaintyKm,
      predictedWindsKmh: f.winds,
      category: f.cat,
    })),
  };
}
