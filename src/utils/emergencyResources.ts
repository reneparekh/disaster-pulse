import { CalamityEvent } from '../types/disaster';
import { calculateDistanceKm, GLOBAL_POPULATION_HUBS } from '../data/populationData';

export type EmergencyResourceType = 'shelter' | 'water' | 'medical';

export type ResourceStatus = 'OPERATIONAL' | 'LIMITED_CAPACITY' | 'CRITICAL_SHORTAGE' | 'FULL';

export interface EmergencyResource {
  id: string;
  name: string;
  type: EmergencyResourceType;
  coordinates: {
    lat: number;
    lng: number;
  };
  status: ResourceStatus;
  statusLabel: string;
  capacityTotal: number;
  capacityCurrent: number;
  capacityUnit: string;
  percentageUsed: number;
  address: string;
  phone: string;
  radioFrequency: string;
  supplies: string[];
  notes: string;
  organization: string;
  staffCount: number;
  waitTimeMinutes?: number;
  distanceToUserKm?: number;
}

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ViewportResourceSummary {
  totalFacilities: number;
  sheltersCount: number;
  waterStationsCount: number;
  medicalCount: number;
  totalShelterBeds: number;
  availableShelterBeds: number;
  dailyWaterOutputLiters: number;
  totalMedicalBeds: number;
  availableMedicalBeds: number;
  operationalRate: number; // percentage
}

// Pseudo-random deterministic number generator seeded by string/coordinates
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const SHELTER_PREFIXES = [
  'Red Cross Regional Relief Haven',
  'Civil Defense Emergency Refuge',
  'Civic Sports Arena Evacuation Center',
  'Municipal High School Emergency Shelter',
  'UNHCR Humanitarian Safe Haven',
  'Community Center Safe Compound',
  'Cathedral Emergency Assembly Camp',
  'National Guard Staging Refuge'
];

const WATER_PREFIXES = [
  'UNICEF Potable Water Distribution Depot',
  'WHO Clean Water Hydration Hub',
  'Oxfam Mobile Desalination Plant',
  'Civil Protection Bulk Tanker Station',
  'Emergency Reverse Osmosis Filtration Site',
  'Disaster Relief Purified Water Point',
  'Community Bulk Water Dispatch Tank',
  'Red Crescent Hydro-Supply Outpost'
];

const MEDICAL_PREFIXES = [
  'Field Trauma Surgical Hospital',
  'Doctors Without Borders Rapid Medical Station',
  'Red Cross Mobile Triage Clinic',
  'Regional Urgent Care Casualty Base',
  'Emergency Field Decontamination & Trauma Ward',
  'Military Field Hospital Battalion 4',
  'Pediatric & Acute Respiratory Field Clinic',
  'Disaster Medical Assistance Team (DMAT) Hub'
];

const ORGANIZATIONS: Record<EmergencyResourceType, string[]> = {
  shelter: [
    'International Red Cross / Red Crescent',
    'UNHCR Global Refugee & Relief Agency',
    'National Emergency Management Agency',
    'Municipal Civil Defense Directorate',
    'Salvation Army Disaster Services',
  ],
  water: [
    'UNICEF WASH (Water & Sanitation) Cluster',
    'Oxfam International Emergency Response',
    'World Health Organization Sanitation Team',
    'Civil Defense Logistics Battalion',
    'WaterAid Rapid Disaster Relief Unit',
  ],
  medical: [
    'Doctors Without Borders / MSF',
    'World Health Organization Emergency Medical Teams',
    'Red Cross Emergency Trauma Corps',
    'International Medical Corps (IMC)',
    'National Emergency Medical Services Command',
  ],
};

const SHELTER_AMENITIES = [
  'Auxiliary Diesel Power Generators (24/7)',
  'Heated Tents & Thermal Emergency Blankets',
  'Hot Nutritional Rations & Infant Milk Depot',
  'Potable Water Sanitation & Clean Showers',
  'Pet Accommodations & Child Safe Area',
  'Satellite VHF Telecommunications Node',
  'Mental Health & Psychological First Aid',
  'Wheelchair & Special Needs Barrier-Free Ramps',
];

const WATER_AMENITIES = [
  'High-Volume Reverse Osmosis Filtration (2,500 L/hr)',
  '20,000 Liter Food-Grade Storage Bladders',
  'Collapsible Jerry Cans & Water Purification Tablets',
  'Solar-Powered Submersible Pumping Arrays',
  'Residual Chlorine & Turbidity Testing On-Site',
  'Dedicated Rapid Bulk Tanker Fill Line (150 L/min)',
  'Handwashing & Hygiene Sanitation Stations',
  'Pedestrian Express Dispensing Taps (12 Spigots)',
];

const MEDICAL_AMENITIES = [
  'Level 1 Resuscitation & Trauma Triage Bays',
  'Universal O- Blood Units & Whole Blood Reserves',
  'Mobile Sterile Surgical Operating Containers',
  'Negative Pressure Isolation Tents for Airborne Risks',
  'Continuous Oxygen Generators & Portable Ventilators',
  'Digital Ultrasound & Portable X-Ray Diagnostics',
  'Pediatric Emergency Pharmacy & Antivenom / Antidotes',
  'Helicopter Emergency Medical Landing Pad (HEMS)',
];

/**
 * Generates deterministic, realistic emergency resources within the visible viewport bounds
 */
export function generateViewportEmergencyResources(
  bounds: ViewportBounds,
  zoom: number,
  referenceEvents: CalamityEvent[] = []
): EmergencyResource[] {
  // Normalize bounds
  const north = Math.min(85, Math.max(-85, bounds.north));
  const south = Math.min(85, Math.max(-85, bounds.south));
  let west = bounds.west;
  let east = bounds.east;

  // Clamp longitude wrap if too wide
  if (east - west > 360) {
    west = -180;
    east = 180;
  }

  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);

  // Target count depends on zoom
  let targetCount = 14;
  if (zoom <= 3) targetCount = 10;
  else if (zoom <= 6) targetCount = 16;
  else if (zoom <= 10) targetCount = 22;
  else targetCount = 26;

  const resources: EmergencyResource[] = [];
  const usedCoords = new Set<string>();

  // 1. First, prioritize facilities near disasters or population hubs that are INSIDE the viewport
  const hubsInViewport = GLOBAL_POPULATION_HUBS.filter(hub => 
    hub.coordinates.lat >= south &&
    hub.coordinates.lat <= north &&
    hub.coordinates.lng >= west &&
    hub.coordinates.lng <= east
  );

  const disastersInViewport = referenceEvents.filter(ev =>
    ev.coordinates.lat >= south &&
    ev.coordinates.lat <= north &&
    ev.coordinates.lng >= west &&
    ev.coordinates.lng <= east
  );

  let seedIndex = 1;

  // Add realistic facilities around prominent disasters in viewport
  disastersInViewport.slice(0, 4).forEach((disaster, dIdx) => {
    const types: EmergencyResourceType[] = ['medical', 'shelter', 'water'];
    types.forEach((t, tIdx) => {
      seedIndex++;
      const offsetLat = (pseudoRandom(seedIndex * 13 + dIdx) - 0.5) * Math.min(0.8, latSpan * 0.12);
      const offsetLng = (pseudoRandom(seedIndex * 17 + dIdx) - 0.5) * Math.min(0.8, lngSpan * 0.12);
      const lat = disaster.coordinates.lat + offsetLat;
      const lng = disaster.coordinates.lng + offsetLng;

      const coordKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (!usedCoords.has(coordKey)) {
        usedCoords.add(coordKey);
        resources.push(createResourceItem({
          id: `res-disaster-${disaster.id}-${t}-${tIdx}`,
          type: t,
          lat,
          lng,
          nearName: disaster.city,
          country: disaster.country,
          seed: seedIndex,
        }));
      }
    });
  });

  // Add facilities around population hubs in viewport
  hubsInViewport.slice(0, 4).forEach((hub, hIdx) => {
    const types: EmergencyResourceType[] = ['shelter', 'water', 'medical'];
    types.forEach((t, tIdx) => {
      seedIndex++;
      const offsetLat = (pseudoRandom(seedIndex * 23 + hIdx) - 0.5) * Math.min(0.6, latSpan * 0.1);
      const offsetLng = (pseudoRandom(seedIndex * 31 + hIdx) - 0.5) * Math.min(0.6, lngSpan * 0.1);
      const lat = hub.coordinates.lat + offsetLat;
      const lng = hub.coordinates.lng + offsetLng;

      const coordKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
      if (!usedCoords.has(coordKey) && resources.length < targetCount) {
        usedCoords.add(coordKey);
        resources.push(createResourceItem({
          id: `res-hub-${hub.id}-${t}-${tIdx}`,
          type: t,
          lat,
          lng,
          nearName: hub.name,
          country: hub.country,
          seed: seedIndex,
        }));
      }
    });
  });

  // 2. Fill the rest of the target count using a spatial grid distribution across the visible viewport
  const remainingNeeded = targetCount - resources.length;
  if (remainingNeeded > 0) {
    const gridRows = Math.ceil(Math.sqrt(remainingNeeded));
    const gridCols = Math.ceil(remainingNeeded / gridRows);

    const latStep = latSpan / (gridRows + 1);
    const lngStep = lngSpan / (gridCols + 1);

    const typeCycle: EmergencyResourceType[] = ['shelter', 'water', 'medical'];

    for (let r = 0; r < gridRows && resources.length < targetCount; r++) {
      for (let c = 0; c < gridCols && resources.length < targetCount; c++) {
        seedIndex++;
        const baseLat = south + (r + 1) * latStep;
        const baseLng = west + (c + 1) * lngStep;

        const jitterLat = (pseudoRandom(seedIndex * 41 + r) - 0.5) * (latStep * 0.6);
        const jitterLng = (pseudoRandom(seedIndex * 47 + c) - 0.5) * (lngStep * 0.6);

        const lat = Math.max(-85, Math.min(85, baseLat + jitterLat));
        const lng = baseLng + jitterLng;

        const type = typeCycle[(r + c) % typeCycle.length];
        const coordKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

        if (!usedCoords.has(coordKey)) {
          usedCoords.add(coordKey);
          resources.push(createResourceItem({
            id: `res-grid-${r}-${c}-${seedIndex}`,
            type,
            lat,
            lng,
            nearName: `Sector ${String.fromCharCode(65 + (r % 26))}-${c + 1}`,
            country: 'Humanitarian Zone',
            seed: seedIndex,
          }));
        }
      }
    }
  }

  return resources;
}

interface ResourceItemParams {
  id: string;
  type: EmergencyResourceType;
  lat: number;
  lng: number;
  nearName: string;
  country: string;
  seed: number;
}

function createResourceItem(params: ResourceItemParams): EmergencyResource {
  const { id, type, lat, lng, nearName, country, seed } = params;

  const randVal1 = pseudoRandom(seed * 7);
  const randVal2 = pseudoRandom(seed * 11);
  const randVal3 = pseudoRandom(seed * 19);

  // Status distribution: ~60% Operational, ~25% Limited, ~10% Shortage, ~5% Full
  let status: ResourceStatus = 'OPERATIONAL';
  let statusLabel = 'Fully Operational';
  let percentageUsed = Math.round(35 + randVal2 * 45); // 35% - 80%

  if (randVal1 > 0.88) {
    status = 'CRITICAL_SHORTAGE';
    statusLabel = 'Critical Shortage';
    percentageUsed = Math.round(90 + randVal2 * 9);
  } else if (randVal1 > 0.68) {
    status = 'LIMITED_CAPACITY';
    statusLabel = 'Limited Capacity';
    percentageUsed = Math.round(75 + randVal2 * 18);
  } else if (randVal1 < 0.05) {
    status = 'FULL';
    statusLabel = 'At Maximum Capacity';
    percentageUsed = 100;
  }

  const orgList = ORGANIZATIONS[type];
  const org = orgList[Math.floor(randVal3 * orgList.length)] || orgList[0];

  let name = '';
  let capacityTotal = 0;
  let capacityUnit = '';
  let supplies: string[] = [];
  let notes = '';
  let waitTimeMinutes = Math.round(5 + randVal2 * 25);

  if (type === 'shelter') {
    const prefix = SHELTER_PREFIXES[Math.floor(randVal1 * SHELTER_PREFIXES.length)];
    name = `${prefix} (${nearName})`;
    capacityTotal = Math.round((250 + randVal2 * 950) / 50) * 50; // 250 - 1200 people
    capacityUnit = 'Persons / Beds';
    supplies = [
      SHELTER_AMENITIES[Math.floor(randVal1 * SHELTER_AMENITIES.length)],
      SHELTER_AMENITIES[Math.floor(randVal2 * SHELTER_AMENITIES.length)],
      SHELTER_AMENITIES[Math.floor(randVal3 * SHELTER_AMENITIES.length)],
    ];
    notes = 'Security checkpoints established. Identification recommended but not mandatory for immediate sheltering.';
  } else if (type === 'water') {
    const prefix = WATER_PREFIXES[Math.floor(randVal1 * WATER_PREFIXES.length)];
    name = `${prefix} (${nearName})`;
    capacityTotal = Math.round((8000 + randVal2 * 45000) / 1000) * 1000; // 8,000 - 53,000 Liters/day
    capacityUnit = 'Liters / Day Potable Water';
    supplies = [
      WATER_AMENITIES[Math.floor(randVal1 * WATER_AMENITIES.length)],
      WATER_AMENITIES[Math.floor(randVal2 * WATER_AMENITIES.length)],
      WATER_AMENITIES[Math.floor(randVal3 * WATER_AMENITIES.length)],
    ];
    notes = 'Distribution limit: 15 Liters per individual daily ration. Container sanitizing provided free of charge.';
  } else {
    // Medical
    const prefix = MEDICAL_PREFIXES[Math.floor(randVal1 * MEDICAL_PREFIXES.length)];
    name = `${prefix} (${nearName})`;
    capacityTotal = Math.round((40 + randVal2 * 180) / 10) * 10; // 40 - 220 acute beds
    capacityUnit = 'Emergency & Trauma Beds';
    supplies = [
      MEDICAL_AMENITIES[Math.floor(randVal1 * MEDICAL_AMENITIES.length)],
      MEDICAL_AMENITIES[Math.floor(randVal2 * MEDICAL_AMENITIES.length)],
      MEDICAL_AMENITIES[Math.floor(randVal3 * MEDICAL_AMENITIES.length)],
    ];
    notes = 'Triaging strictly based on START protocol. Continuous ambulance and air evacuation intake operational.';
  }

  // Deduplicate supplies
  supplies = Array.from(new Set(supplies));
  if (supplies.length < 3) {
    const fallbackList = type === 'shelter' ? SHELTER_AMENITIES : type === 'water' ? WATER_AMENITIES : MEDICAL_AMENITIES;
    supplies.push(fallbackList[0]);
  }

  const capacityCurrent = Math.round((capacityTotal * percentageUsed) / 100);
  const staffCount = Math.round(8 + randVal1 * 35);
  const radioMhz = (145 + Math.round(randVal2 * 300) / 10).toFixed(1);

  return {
    id,
    name,
    type,
    coordinates: {
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
    },
    status,
    statusLabel,
    capacityTotal,
    capacityCurrent,
    capacityUnit,
    percentageUsed,
    address: `${nearName} Humanitarian Access Point, ${country}`,
    phone: `+1-800-RELIEF-${Math.round(100 + randVal1 * 899)}`,
    radioFrequency: `VHF ${radioMhz} MHz (Channel ${(Math.floor(randVal3 * 16) + 1)})`,
    supplies,
    notes,
    organization: org,
    staffCount,
    waitTimeMinutes,
  };
}

/**
 * Calculates aggregate logistical metrics for all currently visible viewport resources
 */
export function calculateViewportResourceSummary(resources: EmergencyResource[]): ViewportResourceSummary {
  const shelters = resources.filter(r => r.type === 'shelter');
  const waterStations = resources.filter(r => r.type === 'water');
  const medical = resources.filter(r => r.type === 'medical');

  let totalShelterBeds = 0;
  let usedShelterBeds = 0;
  shelters.forEach(s => {
    totalShelterBeds += s.capacityTotal;
    usedShelterBeds += s.capacityCurrent;
  });

  let dailyWaterOutputLiters = 0;
  waterStations.forEach(w => {
    dailyWaterOutputLiters += w.capacityTotal;
  });

  let totalMedicalBeds = 0;
  let usedMedicalBeds = 0;
  medical.forEach(m => {
    totalMedicalBeds += m.capacityTotal;
    usedMedicalBeds += m.capacityCurrent;
  });

  const operationalCount = resources.filter(r => r.status === 'OPERATIONAL').length;
  const operationalRate = resources.length > 0 ? Math.round((operationalCount / resources.length) * 100) : 100;

  return {
    totalFacilities: resources.length,
    sheltersCount: shelters.length,
    waterStationsCount: waterStations.length,
    medicalCount: medical.length,
    totalShelterBeds,
    availableShelterBeds: Math.max(0, totalShelterBeds - usedShelterBeds),
    dailyWaterOutputLiters,
    totalMedicalBeds,
    availableMedicalBeds: Math.max(0, totalMedicalBeds - usedMedicalBeds),
    operationalRate,
  };
}
