import { CalamityEvent } from '../types/disaster';
import { 
  SpectralBandConfig, 
  SatelliteOverpass, 
  InSARDamageProxy, 
  SpectralIndexType 
} from '../types/geospatial';

/**
 * Remote Sensing & Earth Observation (EO) Engine
 * Provides spectral indices, Sentinel/Landsat orbital pass calculations,
 * and InSAR interferometric coherence loss modeling.
 */

export const SPECTRAL_INDICES: Record<SpectralIndexType, SpectralBandConfig> = {
  NDVI: {
    name: 'Normalized Difference Vegetation Index',
    formula: '(NIR - Red) / (NIR + Red)  [B8 - B4 in Sentinel-2]',
    primaryApplication: 'Vegetation health, agricultural drought monitoring, post-fire recovery',
    interpretationRanges: [
      { min: -1.0, max: 0.0, label: 'Water / Snow / Cloud', color: '#0284c7' },
      { min: 0.0, max: 0.2, label: 'Bare Soil / Burn Scars', color: '#b45309' },
      { min: 0.2, max: 0.5, label: 'Sparse / Stressed Canopy', color: '#84cc16' },
      { min: 0.5, max: 1.0, label: 'Dense Healthy Rainforest', color: '#15803d' },
    ],
  },
  NDWI: {
    name: 'Normalized Difference Water Index (McFeeters)',
    formula: '(Green - NIR) / (Green + NIR)  [B3 - B8 in Sentinel-2]',
    primaryApplication: 'Flash flood inundation surface delineation, reservoir depletion',
    interpretationRanges: [
      { min: -1.0, max: 0.0, label: 'Non-water / Terrestrial', color: '#64748b' },
      { min: 0.0, max: 0.3, label: 'Saturated Soil / Marshland', color: '#38bdf8' },
      { min: 0.3, max: 1.0, label: 'Open Inundated Water Surface', color: '#0369a1' },
    ],
  },
  MNDWI: {
    name: 'Modified NDWI (Xu 2006)',
    formula: '(Green - SWIR1) / (Green + SWIR1)  [B3 - B11 in Sentinel-2]',
    primaryApplication: 'Urban flash flood boundary mapping with built-up noise suppression',
    interpretationRanges: [
      { min: -1.0, max: 0.0, label: 'Built-up / Roads / Soils', color: '#475569' },
      { min: 0.0, max: 0.4, label: 'Submerged Urban Areas', color: '#06b6d4' },
      { min: 0.4, max: 1.0, label: 'Deep Flood Inundation', color: '#0284c7' },
    ],
  },
  NBR: {
    name: 'Normalized Burn Ratio',
    formula: '(NIR - SWIR2) / (NIR + SWIR2)  [B8 - B12 in Sentinel-2]',
    primaryApplication: 'Active wildfire burn detection and charcoal moisture deficit',
    interpretationRanges: [
      { min: -1.0, max: -0.1, label: 'Severely Burned Ashes', color: '#dc2626' },
      { min: -0.1, max: 0.1, label: 'Low Severity Burn', color: '#f97316' },
      { min: 0.1, max: 1.0, label: 'Unburned Canopy', color: '#22c55e' },
    ],
  },
  dNBR: {
    name: 'Differenced Normalized Burn Ratio (Pre-fire - Post-fire)',
    formula: 'NBR_prefire - NBR_postfire  (USGS Wildland Fire Severity Metric)',
    primaryApplication: 'Wildfire burn severity classification & soil erosion risk',
    interpretationRanges: [
      { min: -0.5, max: 0.1, label: 'Unburned / Enhanced Regrowth', color: '#16a34a' },
      { min: 0.1, max: 0.27, label: 'Low Burn Severity', color: '#eab308' },
      { min: 0.27, max: 0.66, label: 'Moderate-High Severity', color: '#ea580c' },
      { min: 0.66, max: 1.3, label: 'High Severity Canopy Destruction', color: '#991b1b' },
    ],
  },
  SAR_COHERENCE: {
    name: 'InSAR Complex Interferometric Coherence (γ)',
    formula: '|E[S1 · S2*]| / sqrt(E[|S1|²] · E[|S2|²])  [Copernicus Sentinel-1 C-band]',
    primaryApplication: 'Damage Proxy Map (DPM): Building structural collapse & ground rupture',
    interpretationRanges: [
      { min: 0.0, max: 0.25, label: 'High Structural Destruction (Decoherence)', color: '#ef4444' },
      { min: 0.25, max: 0.55, label: 'Moderate Structural Disturbance', color: '#f59e0b' },
      { min: 0.55, max: 1.0, label: 'Stable Intact Infrastructure', color: '#10b981' },
    ],
  },
};

/**
 * Calculates current and upcoming satellite overpass schedules over an incident target
 */
export function calculateSatelliteOverpasses(
  incidentLat: number, 
  incidentLng: number, 
  incidentName: string
): SatelliteOverpass[] {
  const now = new Date();

  // Pseudo-ephemeris model based on polar sun-synchronous orbit inclinations (~98°)
  const satellites = [
    { name: 'Sentinel-1A (SAR C-Band)', constellation: 'Copernicus ESA', sensor: 'C-SAR (5.405 GHz)', swath: 250, res: 10, mode: 'Interferometric Wide (IW)', repeatDays: 12 },
    { name: 'Sentinel-2A (MSI Optical)', constellation: 'Copernicus ESA', sensor: 'MSI (13 spectral bands)', swath: 290, res: 10, mode: 'Multispectral VNIR/SWIR', repeatDays: 5 },
    { name: 'Sentinel-2B (MSI Optical)', constellation: 'Copernicus ESA', sensor: 'MSI (13 spectral bands)', swath: 290, res: 10, mode: 'Multispectral VNIR/SWIR', repeatDays: 5 },
    { name: 'Landsat-9 (OLI-2 / TIRS-2)', constellation: 'NASA / USGS', sensor: 'OLI-2 & Thermal TIRS-2', swath: 185, res: 15, mode: 'Panchromatic / 30m Multispectral', repeatDays: 16 },
    { name: 'Terra (MODIS / ASTER)', constellation: 'NASA Earth Observing', sensor: 'MODIS (36 bands)', swath: 2330, res: 250, mode: 'Global Daily Radiometry', repeatDays: 1 },
    { name: 'PlanetScope Dove-R', constellation: 'Planet Labs (Commercial)', sensor: '8-Band SuperDove', swath: 32, res: 3.7, mode: 'Ultra-High Res Daily Constellation', repeatDays: 1 },
  ];

  return satellites.map((sat, index) => {
    // Deterministic pass delay based on coordinates and index
    const seed = Math.abs(Math.sin(incidentLat * 12.34 + incidentLng * 56.78 + index * 9.1));
    const minutesDelay = Math.round(18 + seed * 420); // 18m to 7 hours
    const passTime = new Date(now.getTime() + minutesDelay * 60 * 1000);
    const lookAngle = Math.round(15 + seed * 25);

    return {
      satelliteName: sat.name,
      constellation: sat.constellation,
      sensor: sat.sensor,
      nextPassUtc: passTime.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      minutesUntilPass: minutesDelay,
      lookAngleDegrees: lookAngle,
      swathWidthKm: sat.swath,
      spatialResolutionM: sat.res,
      acquisitionMode: sat.mode,
      targetIncidentName: incidentName,
    };
  }).sort((a, b) => a.minutesUntilPass - b.minutesUntilPass);
}

/**
 * Generates an InSAR Damage Proxy Map (DPM) assessment for a seismic / catastrophic incident
 */
export function generateInSARDamageProxy(event: CalamityEvent): InSARDamageProxy {
  const isCritical = event.severity === 'CRITICAL';
  const popFactor = Math.min(10, Math.max(1, event.medicalEmergency.affectedPopulation / 50000));
  
  const severeKm2 = isCritical ? +(18.5 * popFactor).toFixed(1) : +(4.2 * popFactor).toFixed(1);
  const modKm2 = +(severeKm2 * 2.8).toFixed(1);
  const minorKm2 = +(severeKm2 * 5.4).toFixed(1);

  return {
    sceneId: `S1A_IW_SLC__1SDV_${new Date().getUTCFullYear()}1008T_COH`,
    referenceDate: 'Oct 02, 2026 (Pre-event baseline)',
    secondaryDate: 'Oct 08, 2026 (Post-event SAR pass)',
    temporalBaselineDays: 6,
    perpendicularBaselineM: 42.8,
    meanCoherenceLoss: isCritical ? 0.68 : 0.42,
    damageSeverityAreaKm2: {
      severeCollapse: severeKm2,
      moderateStructural: modKm2,
      minorSlight: minorKm2,
    },
  };
}
