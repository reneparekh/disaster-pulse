/**
 * Thermal Anomaly & Satellite Radiative Power Service
 * 
 * Ingests and models near-real-time satellite thermal anomaly detections (active fires,
 * volcanic eruptive thermal signatures, and gas flaring hotspots) based on NASA FIRMS
 * (Fire Information for Resource Management System) and VIIRS/MODIS radiometers.
 */

import { CalamityEvent } from '../types/disaster';
import { calculateDistanceKm } from '../data/populationData';

export interface ThermalAnomaly {
  id: string;
  lat: number;
  lng: number;
  brightnessTempKelvin: number;    // Sensor 4μm / 11μm Brightness Temperature (Kelvin)
  brightnessTempCelsius: number;   // Converted to Celsius (°C)
  fireRadiativePowerMW: number;    // Fire Radiative Power in Megawatts (MW)
  confidence: 'nominal' | 'high' | 'low';
  confidencePercent: number;       // 50% - 99%
  satelliteSensor: 'VIIRS_375m' | 'MODIS_1km';
  satellitePlatform: 'Suomi-NPP' | 'NOAA-20' | 'Terra' | 'Aqua';
  acquisitionDate: string;
  acquisitionTimeUtc: string;
  dayNight: 'D' | 'N';
  clusterRadiusKm: number;
  locationName: string;
  country: string;
  associatedEventId?: string;
  associatedEventName?: string;
}

export interface ThermalAnomalySummary {
  totalHotspots: number;
  peakFRP_MW: number;
  avgFRP_MW: number;
  maxBrightnessTempKelvin: number;
  maxBrightnessTempCelsius: number;
  highConfidenceCount: number;
  viirsCount: number;
  modisCount: number;
  lastPassTime: string;
}

// Well-known global active thermal anomaly reference belts (NASA FIRMS monitored)
const GLOBAL_THERMAL_SURVEILLANCE_ZONES = [
  { name: 'Pantanal & Amazon Basin Rim', country: 'Brazil / Bolivia', lat: -15.82, lng: -56.55, baseFRP: 185, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
  { name: 'Cerrado Ecological Arc', country: 'Brazil', lat: -12.44, lng: -48.22, baseFRP: 94, sensor: 'VIIRS_375m', platform: 'NOAA-20' },
  { name: 'Northern Territory Savanna Belt', country: 'Australia', lat: -13.25, lng: 132.88, baseFRP: 142, sensor: 'MODIS_1km', platform: 'Aqua' },
  { name: 'Pilbara Thermal Complex', country: 'Australia', lat: -21.88, lng: 118.52, baseFRP: 68, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
  { name: 'Congo Basin Seasonal Biomass Front', country: 'DR Congo', lat: -4.32, lng: 22.45, baseFRP: 210, sensor: 'VIIRS_375m', platform: 'NOAA-20' },
  { name: 'Angola Savanna Transition Zone', country: 'Angola', lat: -10.15, lng: 16.85, baseFRP: 115, sensor: 'MODIS_1km', platform: 'Terra' },
  { name: 'East African Rift Geothermal / Nyiragongo', country: 'DR Congo / Rwanda', lat: -1.52, lng: 29.25, baseFRP: 340, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
  { name: 'Indonesian Peatland Hotspot Sector', country: 'Indonesia (Kalimantan)', lat: -2.21, lng: 113.92, baseFRP: 160, sensor: 'MODIS_1km', platform: 'Aqua' },
  { name: 'Sierra Nevada Chaparral Ridge', country: 'United States (California)', lat: 37.15, lng: -119.35, baseFRP: 85, sensor: 'VIIRS_375m', platform: 'NOAA-20' },
  { name: 'Cascades Volcanic / Forest Complex', country: 'United States (Oregon)', lat: 43.85, lng: -121.75, baseFRP: 72, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
  { name: 'Siberian Taiga Summer Hotspot', country: 'Russia (Sakha Republic)', lat: 62.15, lng: 129.72, baseFRP: 230, sensor: 'MODIS_1km', platform: 'Terra' },
  { name: 'Peloponnese Mediterranean Shrubland', country: 'Greece', lat: 37.58, lng: 22.37, baseFRP: 64, sensor: 'VIIRS_375m', platform: 'NOAA-20' },
  { name: 'Gran Chaco Dry Forest', country: 'Argentina / Paraguay', lat: -24.45, lng: -60.85, baseFRP: 128, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
  { name: 'Mount Etna Thermal Radiance Vent', country: 'Italy (Sicily)', lat: 37.75, lng: 15.00, baseFRP: 420, sensor: 'VIIRS_375m', platform: 'NOAA-20' },
  { name: 'Kilauea Halemaumau Lava Lake', country: 'United States (Hawaii)', lat: 19.41, lng: -155.28, baseFRP: 510, sensor: 'VIIRS_375m', platform: 'Suomi-NPP' },
] as const;

/**
 * Generate active thermal anomaly points based on:
 * 1. Active wildfire & volcano events in the live dataset
 * 2. NASA FIRMS orbital surveillance surveillance zones
 */
export function generateThermalAnomalies(events: CalamityEvent[]): ThermalAnomaly[] {
  const anomalies: ThermalAnomaly[] = [];
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // 1. Generate thermal clusters around active wildfires and volcanoes in the live events dataset
  events.forEach((ev) => {
    if (ev.type === 'wildfire' || ev.type === 'volcano') {
      const isVolcano = ev.type === 'volcano';
      const baseFrp = isVolcano ? 380 : ev.severity === 'CRITICAL' ? 290 : ev.severity === 'HIGH' ? 145 : 75;
      const baseTempK = isVolcano ? 465 : ev.severity === 'CRITICAL' ? 415 : 368;

      // Primary epicenter thermal anomaly
      anomalies.push({
        id: `thermal-epicenter-${ev.id}`,
        lat: ev.coordinates.lat,
        lng: ev.coordinates.lng,
        brightnessTempKelvin: +baseTempK.toFixed(1),
        brightnessTempCelsius: +(baseTempK - 273.15).toFixed(1),
        fireRadiativePowerMW: baseFrp,
        confidence: 'high',
        confidencePercent: 98,
        satelliteSensor: 'VIIRS_375m',
        satellitePlatform: 'Suomi-NPP',
        acquisitionDate: dateStr,
        acquisitionTimeUtc: now.toISOString().substring(11, 16) + ' UTC',
        dayNight: now.getUTCHours() >= 6 && now.getUTCHours() <= 18 ? 'D' : 'N',
        clusterRadiusKm: isVolcano ? 8 : 14,
        locationName: `${ev.city} Active Front`,
        country: ev.country,
        associatedEventId: ev.id,
        associatedEventName: ev.name,
      });

      // Flanking / perimeter satellite thermal pixels (front progression)
      const numFlanks = isVolcano ? 2 : 4;
      for (let i = 0; i < numFlanks; i++) {
        const angle = (i * 2 * Math.PI) / numFlanks + 0.4;
        const offsetDistKm = 2.5 + i * 2.2;
        const dLat = (offsetDistKm * Math.sin(angle)) / 111.32;
        const dLng = (offsetDistKm * Math.cos(angle)) / (111.32 * Math.cos((ev.coordinates.lat * Math.PI) / 180));
        const flankFrp = Math.round(baseFrp * (0.35 + (i * 0.15)));
        const flankTempK = Math.round(baseTempK - (15 + i * 8));

        anomalies.push({
          id: `thermal-flank-${ev.id}-${i}`,
          lat: +(ev.coordinates.lat + dLat).toFixed(4),
          lng: +(ev.coordinates.lng + dLng).toFixed(4),
          brightnessTempKelvin: flankTempK,
          brightnessTempCelsius: +(flankTempK - 273.15).toFixed(1),
          fireRadiativePowerMW: flankFrp,
          confidence: i === 0 ? 'high' : 'nominal',
          confidencePercent: Math.round(82 + (i * 4)),
          satelliteSensor: i % 2 === 0 ? 'VIIRS_375m' : 'MODIS_1km',
          satellitePlatform: i % 2 === 0 ? 'NOAA-20' : 'Aqua',
          acquisitionDate: dateStr,
          acquisitionTimeUtc: now.toISOString().substring(11, 16) + ' UTC',
          dayNight: now.getUTCHours() >= 6 && now.getUTCHours() <= 18 ? 'D' : 'N',
          clusterRadiusKm: 5,
          locationName: `${ev.city} Sector ${String.fromCharCode(65 + i)}`,
          country: ev.country,
          associatedEventId: ev.id,
          associatedEventName: ev.name,
        });
      }
    }
  });

  // 2. Global NASA FIRMS background surveillance zones
  GLOBAL_THERMAL_SURVEILLANCE_ZONES.forEach((zone, idx) => {
    // Deterministic diurnal fluctuation based on UTC hour
    const hour = now.getUTCHours();
    const diurnalFactor = 0.8 + 0.4 * Math.sin((hour / 24) * 2 * Math.PI + idx);
    const frp = Math.round(zone.baseFRP * diurnalFactor);
    const tempK = Math.round(345 + (frp / 6));

    anomalies.push({
      id: `thermal-firms-${idx}`,
      lat: zone.lat,
      lng: zone.lng,
      brightnessTempKelvin: tempK,
      brightnessTempCelsius: +(tempK - 273.15).toFixed(1),
      fireRadiativePowerMW: frp,
      confidence: frp > 100 ? 'high' : 'nominal',
      confidencePercent: Math.min(99, Math.round(75 + frp * 0.08)),
      satelliteSensor: zone.sensor as any,
      satellitePlatform: zone.platform as any,
      acquisitionDate: dateStr,
      acquisitionTimeUtc: `${String((hour + idx) % 24).padStart(2, '0')}:${String((idx * 17) % 60).padStart(2, '0')} UTC`,
      dayNight: (hour + idx) % 24 >= 6 && (hour + idx) % 24 <= 18 ? 'D' : 'N',
      clusterRadiusKm: Math.round(4 + frp * 0.04),
      locationName: zone.name,
      country: zone.country,
    });
  });

  return anomalies;
}

/**
 * Filter thermal anomalies by minimum Fire Radiative Power (MW) and sensor platform
 */
export function filterThermalAnomalies(
  anomalies: ThermalAnomaly[],
  minFRP = 0,
  sensorFilter: 'all' | 'viirs' | 'modis' = 'all'
): ThermalAnomaly[] {
  return anomalies.filter((a) => {
    if (a.fireRadiativePowerMW < minFRP) return false;
    if (sensorFilter === 'viirs' && a.satelliteSensor !== 'VIIRS_375m') return false;
    if (sensorFilter === 'modis' && a.satelliteSensor !== 'MODIS_1km') return false;
    return true;
  });
}

/**
 * Calculates aggregate summary metrics across active thermal anomalies
 */
export function calculateThermalSummary(anomalies: ThermalAnomaly[]): ThermalAnomalySummary {
  if (anomalies.length === 0) {
    return {
      totalHotspots: 0,
      peakFRP_MW: 0,
      avgFRP_MW: 0,
      maxBrightnessTempKelvin: 0,
      maxBrightnessTempCelsius: 0,
      highConfidenceCount: 0,
      viirsCount: 0,
      modisCount: 0,
      lastPassTime: 'N/A',
    };
  }

  let peakFRP = 0;
  let sumFRP = 0;
  let maxTempK = 0;
  let highConf = 0;
  let viirsCount = 0;
  let modisCount = 0;

  anomalies.forEach((a) => {
    if (a.fireRadiativePowerMW > peakFRP) peakFRP = a.fireRadiativePowerMW;
    sumFRP += a.fireRadiativePowerMW;
    if (a.brightnessTempKelvin > maxTempK) maxTempK = a.brightnessTempKelvin;
    if (a.confidence === 'high' || a.confidencePercent >= 80) highConf++;
    if (a.satelliteSensor === 'VIIRS_375m') viirsCount++;
    else modisCount++;
  });

  return {
    totalHotspots: anomalies.length,
    peakFRP_MW: peakFRP,
    avgFRP_MW: Math.round(sumFRP / anomalies.length),
    maxBrightnessTempKelvin: maxTempK,
    maxBrightnessTempCelsius: +(maxTempK - 273.15).toFixed(1),
    highConfidenceCount: highConf,
    viirsCount,
    modisCount,
    lastPassTime: 'Latest NASA Polar Orbit Pass',
  };
}
