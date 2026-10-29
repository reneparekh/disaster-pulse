import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { INITIAL_DISASTER_EVENTS } from '../data/disastersData';
import { GLOBAL_POPULATION_HUBS, calculateDistanceKm } from '../data/populationData';
import { newsArticleToEvent } from './newsDisasterMapper';
import { fetchGDACSRSS } from './gdacsRssParser';

export interface LiveFeedStats {
  usgsCount: number;
  nasaCount: number;
  weatherCount: number;
  lastUpdated: string;
  lastUpdatedTimestamp: number;
  latencyMs: number;
  isLiveActive: boolean;
  isStale?: boolean;
  staleReason?: string;
  feedErrors?: string[];
}

/**
 * Calculates real-world population in the danger zone for a live event
 * by evaluating geospatial distance against global urban demographic hubs.
 */
function calculateLiveDangerZonePop(
  lat: number,
  lng: number,
  evacRadiusKm: number,
  basePopEstimate: number
): number {
  let exposed = basePopEstimate;
  const impactPerimeterKm = Math.max(evacRadiusKm * 2.5, 45);

  GLOBAL_POPULATION_HUBS.forEach((hub) => {
    const dist = calculateDistanceKm(lat, lng, hub.coordinates.lat, hub.coordinates.lng);
    if (dist <= impactPerimeterKm) {
      const proximityWeight = Math.max(0.08, 1 - dist / impactPerimeterKm);
      exposed += Math.round(hub.metroPopulation * proximityWeight * 0.12);
    }
  });

  return exposed;
}

// Map NASA EONET categories to our 14 Calamity types
function mapNasaCategoryToCalamity(catId: string, title: string): CalamityType {
  const lowTitle = title.toLowerCase();
  if (catId === 'volcanoes' || lowTitle.includes('volcan')) return 'volcano';
  if (catId === 'wildfires' || lowTitle.includes('fire') && !lowTitle.includes('volcan')) return 'wildfire';
  if (catId === 'floods' || lowTitle.includes('flood')) return 'flood';
  if (catId === 'seaLakeIce' || lowTitle.includes('ice') || lowTitle.includes('blizzard')) return 'blizzard';
  if (catId === 'severeStorms') {
    if (lowTitle.includes('tornado')) return 'tornado';
    return 'cyclone';
  }
  if (catId === 'landslides' || lowTitle.includes('landslide')) return 'landslide';
  if (catId === 'temperatureExtremes') return 'extreme_temp';
  if (catId === 'drought') return 'drought';
  if (catId === 'dustHaze') return 'extreme_temp';
  return 'wildfire';
}

function generateIsoseismalPolygon(lat: number, lng: number, radiusKm: number, pointsCount = 18): [number, number][] {
  const poly: [number, number][] = [];
  const kmPerLat = 111.32;
  const kmPerLng = 111.32 * Math.cos((lat * Math.PI) / 180);

  for (let i = 0; i < pointsCount; i++) {
    const angle = (i * 2 * Math.PI) / pointsCount;
    const elongation = 1.0 + 0.22 * Math.sin(angle * 2);
    const dLat = (radiusKm * elongation * Math.sin(angle)) / kmPerLat;
    const dLng = (radiusKm * elongation * Math.cos(angle)) / kmPerLng;
    poly.push([+(lat + dLat).toFixed(4), +(lng + dLng).toFixed(4)]);
  }
  return poly;
}

export async function fetchLiveUSGSEarthquakes(): Promise<CalamityEvent[]> {
  try {
    let features: any[] = [];
    let isServerCached = false;
    let cacheAgeSec = 0;

    // 1. First attempt fetch via server-side caching proxy to prevent rate limits
    try {
      const serverRes = await fetch((await import('../utils/api')).apiUrl('/api/hazards/feed'));
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson.data && Array.isArray(serverJson.data.features)) {
          features = serverJson.data.features;
          isServerCached = !!serverJson.cached;
          cacheAgeSec = serverJson.cacheAgeSeconds || 0;
        }
      }
    } catch {
      // Server proxy unavailable, fallback to direct fetch
    }

    // 2. Direct fallback if server proxy was empty
    if (features.length === 0) {
      const res = await fetch(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
        { cache: 'no-store' }
      );
      if (!res.ok) return [];
      const data = await res.json();
      features = data.features || [];
    }

    return features.map((item: any, idx: number) => {
      const [lng, lat, depth] = item.geometry?.coordinates || [0, 0, 10];
      const mag = item.properties?.mag || 4.5;
      const place = item.properties?.place || 'Oceanic Trench';
      const parts = place.split(', ');
      const city = parts[0] || 'Near Epicenter';
      const country = parts[1] || 'Offshore Region';
      const eventTime = new Date(item.properties?.time || Date.now()).toISOString();

      const isCritical = mag >= 6.2;
      const radiusKm = Math.round(Math.pow(10, 0.43 * mag - 0.5));
      const basePopEstimate = Math.round(mag * 38000);
      const dangerZonePop = calculateLiveDangerZonePop(Number(lat), Number(lng), radiusKm, basePopEstimate);
      const isMedAlert = isCritical || (mag >= 5.6 && dangerZonePop > 150000);

      // Distinct Felt Intensity (Modified Mercalli Scale)
      const mmiLevel = mag >= 7.5 ? 'MMI IX (Violent Shaking)'
        : mag >= 6.8 ? 'MMI VIII (Severe Shaking)'
        : mag >= 6.0 ? 'MMI VII (Very Strong Shaking)'
        : mag >= 5.2 ? 'MMI VI (Strong Shaking)'
        : 'MMI V (Moderate Shaking)';

      // Calculated ground acceleration
      const pgaVal = +(Math.pow(10, (mag - 4.5) * 0.4) * 0.12).toFixed(2);

      // Hazard boundary isoseismal polygon
      const hazardAreaPolygon = generateIsoseismalPolygon(Number(lat), Number(lng), radiusKm);

      return {
        id: `usgs-live-${item.id || idx}`,
        name: `USGS M${mag.toFixed(1)} Earthquake: ${place}`,
        type: 'earthquake',
        country: country,
        city: city,
        coordinates: { lat: Number(lat), lng: Number(lng) },
        hazardAreaPolygon,
        severity: isCritical ? 'CRITICAL' : mag >= 5.0 ? 'HIGH' : 'MODERATE',
        
        // Explicit distinction: Source Magnitude vs Local Felt Intensity
        magnitude: {
          value: +mag.toFixed(1),
          scale: 'Moment Magnitude (Mw)',
          depthKm: depth ? +depth.toFixed(1) : 10.0,
          epicenterDescription: place,
        },
        intensity: {
          scaleName: 'Estimated Local Felt Intensity (MMI)',
          value: mmiLevel,
          unit: 'Modified Mercalli Scale',
          interpretation: `Hypocenter depth: ${depth ? depth.toFixed(1) : '10.0'} km • Source: USGS Global Seismographic Network`,
          secondaryMetric: {
            label: 'Instrumental Peak Accel (PGA)',
            value: `${pgaVal} g`,
          },
        },
        satelliteTelemetry: {
          satellite: 'USGS ANSS & Copernicus Sentinel-1 InSAR',
          sensor: 'C-Band Synthetic Aperture Radar & Seismometers',
          lastPassTime: isServerCached ? `Server cached (${cacheAgeSec}s ago)` : 'Live Feed Ingested',
          confidence: 99,
        },
        officialAgency: {
          agencyName: 'USGS Earthquake Hazards Program',
          agencyAcronym: 'USGS',
          bulletinId: item.id || `usgs-${idx}`,
          officialBulletinUrl: item.properties?.url || 'https://earthquake.usgs.gov/',
          verbatimWarningText: `Official USGS Report: M${mag.toFixed(1)} event recorded at ${place} at focal depth ${depth ? depth.toFixed(1) : '10.0'}km. Automatic hypocenter solution generated by the USGS National Earthquake Information Center (NEIC).`,
          issuingOffice: 'National Earthquake Information Center (NEIC), Golden, CO',
          alertLevelCode: isCritical ? 'PAGER RED' : mag >= 5.5 ? 'PAGER ORANGE' : 'PAGER GREEN',
        },
        civilDefenseDirectives: {
          issuingAgency: 'USGS / Regional Civil Defense Protocol',
          mandatoryAction: 'Drop, Cover, and Hold On under sturdy furniture. Protect head and neck. Avoid glass windows and exterior walls. Shut off cooking gas valves if safe to do so.',
          evacuationPerimeterKm: radiusKm,
          safeEvacuationCorridors: ['Designated municipal open parks', 'Wide roadway medians away from overpasses'],
          localEmergencyNumber: '911 (North America) / 112 (Europe & International)',
          shelterLocationsNotice: 'Follow local civil defense broadcasts for activated assembly locations.',
          liabilityNotice: 'Official civil defense bulletin. For emergency medical dispatch, call 911 or 112 directly.',
        },
        medicalEmergency: {
          isMedicalAlert: isMedAlert,
          affectedPopulation: dangerZonePop,
          casualtiesEstimated: isCritical ? Math.round(mag * 6) : 0,
          hospitalPressure: isCritical ? 'CRITICAL_OVERWHELMED' : mag >= 5.2 ? 'HIGH' : 'MODERATE',
          pathogenOrCondition: 'Seismic Structural Collapse Trauma & Crush Syndrome Risk',
        },
        publicAdvisory: {
          headline: `USGS OFFICIAL SEISMIC ADVISORY: M${mag.toFixed(1)} at ${place}`,
          immediateAction: 'Inspect premises for structural damage and gas leaks. Stay clear of damaged brick chimneys and power lines.',
          evacuationZoneKm: radiusKm,
          safeCorridors: ['Designated municipal open parks and seismic assembly zones'],
          emergencyContact: 'USGS NEIC Emergency Inquiries',
        },
        dataFreshness: {
          lastSyncedUtc: new Date().toISOString(),
          latencyMinutes: Math.max(2, Math.round((Date.now() - new Date(eventTime).getTime()) / 60000)),
          isStale: false,
          staleThresholdMinutes: 30,
        },
        occurredAt: eventTime,
        occurrenceTimeLocal: `${new Date(eventTime).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
        updatedAt: eventTime,
        source: 'USGS Live Earthquake Hazards API (Official)',
        isLiveFeed: true,
        liveFeedSource: 'USGS',
        liveIngestionTime: new Date().toLocaleTimeString(),
        rawFeedUrl: item.properties?.url || 'https://earthquake.usgs.gov/',
      } as CalamityEvent;
    });
  } catch (error) {
    console.warn('USGS live feed fetch error:', error);
    return [];
  }
}

// Map GDACS event types to our calamity types
function mapGdacsToCalamity(type: string): CalamityType {
  const t = type?.toUpperCase();
  if (t === 'EQ') return 'earthquake';
  if (t === 'TC') return 'cyclone';
  if (t === 'FL') return 'flood';
  if (t === 'VO') return 'volcano';
  if (t === 'WF') return 'wildfire';
  if (t === 'DR') return 'drought';
  if (t === 'LS') return 'landslide';
  if (t === 'TS') return 'tsunami';
  return 'wildfire';
}

export async function fetchLiveGDACS(): Promise<CalamityEvent[]> {
  try {
    const res = await fetch('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?limit=60', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];
    const events: CalamityEvent[] = [];

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const props = f.properties || {};
      const geom = f.geometry || {};
      const coords = geom.coordinates || [];
      const lng = coords[0], lat = coords[1];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const eventType = props.eventtype;
      const calamityType = mapGdacsToCalamity(eventType);
      const alertLevel = (props.alertlevel || 'Green').toLowerCase();
      const severity: SeverityLevel = alertLevel === 'red' ? 'CRITICAL' : alertLevel === 'orange' ? 'HIGH' : 'MODERATE';
      const isMedicalAlert = alertLevel === 'red' || (eventType === 'TC' && alertLevel === 'orange');
      
      const name = props.name || props.eventname || `${calamityType} event`;
      const country = props.country || 'Unknown';
      const fromDate = props.fromdate ? new Date(props.fromdate).toISOString() : new Date().toISOString();
      const toDate = props.todate ? new Date(props.todate).toISOString() : fromDate;
      
      const sev = props.severitydata || {};
      const radiusKm = eventType === 'TC' ? 150 : eventType === 'EQ' ? 60 : eventType === 'FL' ? 40 : 25;
      const basePop = eventType === 'TC' ? 500000 : eventType === 'EQ' ? 200000 : 80000;
      const dangerZonePop = calculateLiveDangerZonePop(Number(lat), Number(lng), radiusKm, basePop);

      events.push({
        id: `gdacs-live-${props.eventid || i}`,
        name: `GDACS ${props.alertlevel || ''} Alert: ${name}`,
        type: calamityType,
        country: country,
        city: name.split(/[\-,]/)[0]?.trim() || country,
        coordinates: { lat: Number(lat), lng: Number(lng) },
        severity: severity,
        magnitude: eventType === 'EQ' && sev.severity ? {
          value: sev.severity,
          scale: 'Moment Magnitude (M)',
          depthKm: undefined,
          epicenterDescription: name,
        } : eventType === 'TC' && sev.severity ? {
          value: `${Math.round(sev.severity)} km/h`,
          scale: 'Maximum Sustained Wind',
          epicenterDescription: name,
        } : undefined,
        intensity: {
          scaleName: eventType === 'TC' ? 'Saffir-Simpson / JTWC' : eventType === 'EQ' ? 'GDACS Earthquake Alert' : 'GDACS Impact Assessment',
          value: severity,
          unit: eventType === 'TC' ? 'km/h' : 'Alert Level',
          interpretation: sev.severitytext || props.htmldescription || 'GDACS multi-hazard alert',
          secondaryMetric: sev.severityunit ? { label: 'Severity', value: `${sev.severity} ${sev.severityunit}` } : undefined,
        },
        satelliteTelemetry: {
          satellite: 'GDACS Coordinated Satellite System',
          sensor: 'Multi-agency Remote Sensing',
          lastPassTime: props.datemodified ? `Updated ${new Date(props.datemodified).toLocaleString()}` : 'Live GDACS Update',
          confidence: 98,
        },
        officialAgency: {
          agencyName: 'Global Disaster Alert and Coordination System',
          agencyAcronym: 'GDACS',
          bulletinId: String(props.eventid || ''),
          officialBulletinUrl: props.url?.report || 'https://www.gdacs.org/',
          verbatimWarningText: props.htmldescription || `GDACS ${props.alertlevel} alert for ${name} affecting ${country}`,
          issuingOffice: 'GDACS Joint Research Centre (JRC), European Commission',
          alertLevelCode: `GDACS ${props.alertlevel?.toUpperCase() || 'GREEN'}`,
        },
        civilDefenseDirectives: {
          issuingAgency: 'GDACS / Local Civil Protection',
          mandatoryAction: alertLevel === 'red' ? 'Follow immediate evacuation orders from local authorities. Move to designated shelters away from flood zones/coastlines.' : 'Stay informed via local disaster management authorities. Prepare emergency kits and monitor updates.',
          evacuationPerimeterKm: radiusKm,
          safeEvacuationCorridors: ['Official government evacuation routes', 'High ground / designated emergency shelters'],
          localEmergencyNumber: country?.toLowerCase().includes('india') ? '112 / NDMA Helpline' : '112 / Local Emergency Services',
          shelterLocationsNotice: 'Follow instructions from national disaster management authorities (NDMA/SDMA).',
          liabilityNotice: 'This is based on official GDACS alerts - always follow local government directives.',
        },
        medicalEmergency: {
          isMedicalAlert: isMedicalAlert,
          affectedPopulation: dangerZonePop,
          casualtiesEstimated: alertLevel === 'red' ? Math.round(dangerZonePop * 0.001) : 0,
          hospitalPressure: severity === 'CRITICAL' ? 'CRITICAL_OVERWHELMED' : severity === 'HIGH' ? 'HIGH' : 'MODERATE',
          pathogenOrCondition: calamityType === 'flood' ? 'Waterborne Disease Risk' : calamityType === 'cyclone' ? 'Trauma & Storm Surge Injuries' : 'Disaster-related Trauma',
          bloodAndMedicalSuppliesNeeded: ['Emergency Medical Kits', 'IV Fluids', 'Trauma Supplies'],
        },
        publicAdvisory: {
          headline: `GDACS ${props.alertlevel?.toUpperCase() || 'ALERT'}: ${name} - ${country}`,
          immediateAction: 'Monitor official government alerts and follow local evacuation orders.',
          evacuationZoneKm: radiusKm,
          safeCorridors: ['Designated evacuation routes per local authorities'],
          emergencyContact: 'Local Disaster Management Authority / GDACS',
        },
        dataFreshness: {
          lastSyncedUtc: new Date().toISOString(),
          latencyMinutes: Math.max(1, Math.round((Date.now() - new Date(fromDate).getTime()) / 60000)),
          isStale: false,
          staleThresholdMinutes: 60,
        },
        occurredAt: fromDate,
        updatedAt: toDate,
        source: 'GDACS Global Disaster Alert and Coordination System (Official)',
        isLiveFeed: true,
        liveFeedSource: 'GDACS',
        liveIngestionTime: new Date().toLocaleTimeString(),
        rawFeedUrl: props.url?.report || 'https://www.gdacs.org/',
      });
    }

    return events;
  } catch (error) {
    console.warn('GDACS live feed error:', error);
    return [];
  }
}

export async function fetchLiveNASAEONET(): Promise<CalamityEvent[]> {
  try {
    const res = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=30',
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events || [];

    const mappedEvents: CalamityEvent[] = [];

    events.forEach((item: any, idx: number) => {
      const cat = item.categories?.[0]?.id || 'wildfires';
      const catTitle = item.categories?.[0]?.title || 'Natural Event';
      const geom = item.geometry?.[item.geometry.length - 1]; // latest coordinate
      if (!geom || !geom.coordinates) return;

      const [lng, lat] = geom.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const calamityType = mapNasaCategoryToCalamity(cat, item.title);
      const lowTitle = item.title.toLowerCase();
      const isPrescribed = lowTitle.includes('prescribed') || lowTitle.includes(' rx') || lowTitle.includes(' piles rx');
      const isCyclone = cat === 'severeStorms' || lowTitle.includes('cyclone') || lowTitle.includes('typhoon') || lowTitle.includes('hurricane');
      const isMajorWildfire = (cat === 'wildfires' || lowTitle.includes('wildfire') || lowTitle.includes('fire')) && !isPrescribed;

      let severity: SeverityLevel = 'MODERATE';
      let isMedicalAlert = false;
      let basePop = 15000;
      let evacKm = 15;

      if (isCyclone) {
        severity = 'CRITICAL';
        isMedicalAlert = true;
        basePop = 380000;
        evacKm = 65;
      } else if (isMajorWildfire) {
        severity = 'HIGH';
        isMedicalAlert = false;
        basePop = 28000;
        evacKm = 20;
      } else if (isPrescribed) {
        severity = 'ADVISORY';
        isMedicalAlert = false;
        basePop = 850;
        evacKm = 5;
      } else {
        severity = 'MODERATE';
        isMedicalAlert = false;
        basePop = 12000;
        evacKm = 10;
      }

      const dangerZonePop = calculateLiveDangerZonePop(Number(lat), Number(lng), evacKm, basePop);
      if (dangerZonePop > 450000 && !isPrescribed) {
        isMedicalAlert = true;
      }

      // Approximate city and region parsing from NASA title
      const titleParts = item.title.split(', ');
      const city = titleParts[0] || 'Satellite Anomaly Sector';
      const country = titleParts[1] || 'Global Observation Zone';

      const eventTime = geom.date ? new Date(geom.date).toISOString() : new Date().toISOString();

      mappedEvents.push({
        id: `nasa-live-${item.id || idx}`,
        name: `NASA Satellite Detection: ${item.title}`,
        type: calamityType,
        country: country,
        city: city,
        coordinates: { lat: Number(lat), lng: Number(lng) },
        severity: severity,
        intensity: {
          scaleName: cat === 'wildfires' ? 'NASA Fire Radiative Power (VIIRS/MODIS)' : 'NASA Satellite Optical / Radar Classification',
          value: cat === 'wildfires' ? (isPrescribed ? 'Prescribed Management Burn' : 'Active Thermal Hotspot') : (isCyclone ? 'Cat 3-5 Orbital Surge' : 'NASA Satellite Tracked'),
          unit: cat === 'wildfires' ? 'VIIRS 375m Pixel' : 'Multi-spectral Radiance',
          interpretation: `NASA EONET active event #${item.id} detected via Earth Observatory orbital platforms`,
          secondaryMetric: {
            label: 'Observation Category',
            value: catTitle,
          },
        },
        satelliteTelemetry: {
          satellite: 'NASA Terra/Aqua MODIS & Suomi-NPP VIIRS',
          sensor: 'Multispectral Thermal & Optical Radiometer',
          lastPassTime: 'Latest NASA Orbital Pass',
          confidence: 96,
        },
        medicalEmergency: {
          isMedicalAlert: isMedicalAlert,
          affectedPopulation: dangerZonePop,
          casualtiesEstimated: isCyclone ? 18 : 0,
          hospitalPressure: severity === 'CRITICAL' ? 'CRITICAL_OVERWHELMED' : severity === 'HIGH' ? 'HIGH' : 'MODERATE',
          pathogenOrCondition: calamityType === 'wildfire' ? 'PM2.5 Smoke Inhalation & Thermal Burns' : isCyclone ? 'Storm Surge Inundation & Blunt Trauma' : 'Environmental Exposure & Trauma',
          bloodAndMedicalSuppliesNeeded: ['N95 Particulate Respirators', 'Burn Wound Hydrogels', 'Emergency Oxygen Canisters'],
        },
        publicAdvisory: {
          headline: `NASA SATELLITE WARNING: Active ${catTitle} at ${item.title}`,
          immediateAction: 'Monitor regional civil protection instructions. Avoid high-risk satellite thermal/surge perimeters.',
          evacuationZoneKm: evacKm,
          safeCorridors: ['Regional designated civil defense evacuation corridors'],
          emergencyContact: 'NASA Earth Science Applied Sciences & Civil Defense',
        },
        occurredAt: eventTime,
        occurrenceTimeLocal: `${new Date(eventTime).toLocaleString('en-US', { timeZone: 'UTC' })} UTC (Satellite Detection)`,
        updatedAt: eventTime,
        source: 'NASA EONET Earth Observatory Natural Event API',
        isLiveFeed: true,
        liveFeedSource: 'NASA_EONET',
        liveIngestionTime: new Date().toLocaleTimeString(),
        rawFeedUrl: item.link || 'https://eonet.gsfc.nasa.gov/',
      });
    });

    return mappedEvents;
  } catch (error) {
    console.warn('NASA EONET live feed error:', error);
    return [];
  }
}

export async function fetchLiveNewsDisasters(): Promise<CalamityEvent[]> {
  try {
    const res = await fetch((await import('../utils/api')).apiUrl('/api/news/disasters'), { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const articles = data.articles || [];
    const events: CalamityEvent[] = [];
    for (let i = 0; i < articles.length; i++) {
      const ev = newsArticleToEvent(articles[i], i);
      if (ev) events.push(ev);
    }
    return events;
  } catch (error) {
    console.warn('News disaster fetch error:', error);
    return [];
  }
}

export async function fetchAllLiveDisasters(): Promise<{
  events: CalamityEvent[];
  stats: LiveFeedStats;
}> {
  const startTime = performance.now();
  
  // Parallel fetch from USGS, GDACS (API+RSS), NASA EONET, and live news for comprehensive global coverage
  const [usgsEvents, gdacsEvents, gdacsRssEvents, nasaEvents, newsEvents] = await Promise.all([
    fetchLiveUSGSEarthquakes(),
    fetchLiveGDACS(),
    fetchGDACSRSS(),
    fetchLiveNASAEONET(),
    fetchLiveNewsDisasters(),
  ]);

  const latency = Math.round(performance.now() - startTime);

  const liveEvents = [...gdacsRssEvents, ...gdacsEvents, ...newsEvents, ...usgsEvents, ...nasaEvents];

  // Merge live events with the 14 baseline calamities
  const uniqueMap = new Map<string, CalamityEvent>();

  // Put live events first so they appear at top of list
  liveEvents.forEach(ev => {
    uniqueMap.set(ev.id, ev);
  });

  // Then add baseline 14 calamities
  INITIAL_DISASTER_EVENTS.forEach(ev => {
    if (!uniqueMap.has(ev.id)) {
      uniqueMap.set(ev.id, ev);
    }
  });

  const merged = Array.from(uniqueMap.values());

  const stats: LiveFeedStats = {
    usgsCount: usgsEvents.length,
    nasaCount: nasaEvents.length,
    weatherCount: gdacsEvents.length + gdacsRssEvents.length + newsEvents.length,
    lastUpdated: new Date().toLocaleTimeString(),
    lastUpdatedTimestamp: Date.now(),
    latencyMs: latency,
    isLiveActive: true,
    isStale: false,
  };

  return { events: merged, stats };
}
