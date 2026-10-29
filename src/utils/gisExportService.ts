import { CalamityEvent } from '../types/disaster';
import { PredictiveHotspot } from '../types/mlForecasting';

/**
 * GIS Data Export & Interoperability Service
 * Generates standards-compliant GeoJSON, KML, and QGIS spatial layer files.
 */

/**
 * Generates GeoJSON FeatureCollection containing all active calamities and predicted hotspots
 */
export function generateDisasterGeoJSON(
  events: CalamityEvent[],
  hotspots: PredictiveHotspot[] = []
): string {
  const features: any[] = [];

  // 1. Point features for Calamities
  events.forEach((ev) => {
    features.push({
      type: 'Feature',
      id: ev.id,
      geometry: {
        type: 'Point',
        coordinates: [ev.coordinates.lng, ev.coordinates.lat],
      },
      properties: {
        id: ev.id,
        name: ev.name,
        type: ev.type,
        country: ev.country,
        city: ev.city,
        severity: ev.severity,
        intensityScale: ev.intensity.scaleName,
        intensityValue: ev.intensity.value,
        affectedPopulation: ev.medicalEmergency.affectedPopulation,
        evacuationRadiusKm: ev.publicAdvisory.evacuationZoneKm,
        occurredAt: ev.occurredAt,
        source: ev.source,
        isLiveFeed: !!ev.isLiveFeed,
      },
    });

    // 2. Polygon feature for Evacuation Buffer Perimeter
    const evacKm = Math.max(ev.publicAdvisory.evacuationZoneKm || 15, 5);
    const numPoints = 20;
    const ringCoords: [number, number][] = [];
    const kmPerLat = 111.32;
    const kmPerLng = 111.32 * Math.cos((ev.coordinates.lat * Math.PI) / 180);

    for (let i = 0; i <= numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints;
      const dLat = (evacKm * Math.sin(angle)) / kmPerLat;
      const dLng = (evacKm * Math.cos(angle)) / kmPerLng;
      ringCoords.push([+(ev.coordinates.lng + dLng).toFixed(5), +(ev.coordinates.lat + dLat).toFixed(5)]);
    }

    features.push({
      type: 'Feature',
      id: `evac-poly-${ev.id}`,
      geometry: {
        type: 'Polygon',
        coordinates: [ringCoords],
      },
      properties: {
        parentEventId: ev.id,
        featureClass: 'EvacuationPerimeter',
        evacuationRadiusKm: evacKm,
        headline: ev.publicAdvisory.headline,
      },
    });
  });

  // 3. Predictive Hotspot Features
  hotspots.forEach((h) => {
    features.push({
      type: 'Feature',
      id: h.id,
      geometry: {
        type: 'Point',
        coordinates: [h.coordinates.lng, h.coordinates.lat],
      },
      properties: {
        featureClass: 'ML_Predictive_Hotspot',
        name: h.name,
        hazardType: h.hazardType,
        country: h.country,
        region: h.region,
        probabilityPct: h.probability,
        confidenceLowPct: h.confidenceInterval.low,
        confidenceHighPct: h.confidenceInterval.high,
        forecastHorizon: h.horizon,
        estimatedImpactRadiusKm: h.estimatedImpactRadiusKm,
        populationAtRisk: h.populationAtRisk,
      },
    });
  });

  const geoJsonObj = {
    type: 'FeatureCollection',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      generator: 'Global Disaster Management Platform - MSc Geoinformatics Suite',
      featureCount: features.length,
    },
    features,
  };

  return JSON.stringify(geoJsonObj, null, 2);
}

/**
 * Generates KML (Keyhole Markup Language) file string for Google Earth
 */
export function generateDisasterKML(events: CalamityEvent[]): string {
  const placemarks = events.map((ev) => `
    <Placemark>
      <name><![CDATA[${ev.name}]]></name>
      <description><![CDATA[
        <strong>Type:</strong> ${ev.type.toUpperCase()}<br/>
        <strong>Severity:</strong> ${ev.severity}<br/>
        <strong>Location:</strong> ${ev.city}, ${ev.country}<br/>
        <strong>Intensity:</strong> ${ev.intensity.value} (${ev.intensity.scaleName})<br/>
        <strong>Affected Population:</strong> ${ev.medicalEmergency.affectedPopulation.toLocaleString()}<br/>
        <strong>Advisory:</strong> ${ev.publicAdvisory.headline}
      ]]></description>
      <Point>
        <coordinates>${ev.coordinates.lng},${ev.coordinates.lat},0</coordinates>
      </Point>
    </Placemark>
  `).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Global Active Disaster Hotspots</name>
    <description>Exported from Global Disaster Intelligence System</description>
    ${placemarks}
  </Document>
</kml>`;
}

/**
 * Triggers a client-side file download
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
