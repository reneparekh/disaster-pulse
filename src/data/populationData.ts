export interface PopulationDensityHub {
  id: string;
  name: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  metroPopulation: number;
  densityPerKm2: number;
  category: 'MEGACITY' | 'MAJOR_METRO' | 'URBAN_CORRIDOR' | 'REGIONAL_DENSE';
}

export interface CatastropheHumanitarianImpact {
  eventId: string;
  eventName: string;
  eventType: string;
  severity: string;
  coordinates: { lat: number; lng: number };
  impactRadiusKm: number;
  totalExposedPopulation: number;
  vulnerableMetros: Array<{
    name: string;
    population: number;
    distanceKm: number;
  }>;
  humanitarianRiskLevel: 'EXTREME_CRITICAL' | 'HIGH_ALERT' | 'MODERATE' | 'MONITORED';
  hospitalTriageUrgency: 'IMMEDIATE_COLLAPSE_RISK' | 'HIGH_SURGE' | 'ELEVATED' | 'STABLE';
}

// 80+ Major global population hubs & demographic density nodes worldwide
export const GLOBAL_POPULATION_HUBS: PopulationDensityHub[] = [
  // East Asia & Pacific
  { id: 'pop-tokyo', name: 'Tokyo-Yokohama Metro', country: 'Japan', coordinates: { lat: 35.6762, lng: 139.6503 }, metroPopulation: 37400000, densityPerKm2: 6150, category: 'MEGACITY' },
  { id: 'pop-osaka', name: 'Osaka-Kobe-Kyoto (Keihanshin)', country: 'Japan', coordinates: { lat: 34.6937, lng: 135.5023 }, metroPopulation: 19200000, densityPerKm2: 4800, category: 'MEGACITY' },
  { id: 'pop-seoul', name: 'Seoul Capital Area', country: 'South Korea', coordinates: { lat: 37.5665, lng: 126.9780 }, metroPopulation: 25600000, densityPerKm2: 8900, category: 'MEGACITY' },
  { id: 'pop-shanghai', name: 'Shanghai Metropolitan', country: 'China', coordinates: { lat: 31.2304, lng: 121.4737 }, metroPopulation: 29800000, densityPerKm2: 7300, category: 'MEGACITY' },
  { id: 'pop-beijing', name: 'Beijing Capital Region', country: 'China', coordinates: { lat: 39.9042, lng: 116.4074 }, metroPopulation: 21500000, densityPerKm2: 5200, category: 'MEGACITY' },
  { id: 'pop-guangzhou', name: 'Guangzhou-Shenzhen-Pearl River', country: 'China', coordinates: { lat: 23.1291, lng: 113.2644 }, metroPopulation: 65000000, densityPerKm2: 8200, category: 'MEGACITY' },
  { id: 'pop-taipei', name: 'Taipei-Keelung Basin', country: 'Taiwan', coordinates: { lat: 25.0330, lng: 121.5654 }, metroPopulation: 7000000, densityPerKm2: 9600, category: 'MAJOR_METRO' },
  { id: 'pop-manila', name: 'Metro Manila (NCR)', country: 'Philippines', coordinates: { lat: 14.5995, lng: 120.9842 }, metroPopulation: 14700000, densityPerKm2: 21500, category: 'MEGACITY' },
  { id: 'pop-tuguegarao', name: 'Cagayan Valley Corridor', country: 'Philippines', coordinates: { lat: 17.6132, lng: 121.7270 }, metroPopulation: 1450000, densityPerKm2: 1200, category: 'REGIONAL_DENSE' },
  { id: 'pop-jakarta', name: 'Jakarta (Jabodetabek)', country: 'Indonesia', coordinates: { lat: -6.2088, lng: 106.8456 }, metroPopulation: 34000000, densityPerKm2: 14400, category: 'MEGACITY' },
  { id: 'pop-surabaya', name: 'Surabaya East Java', country: 'Indonesia', coordinates: { lat: -7.2575, lng: 112.7521 }, metroPopulation: 9500000, densityPerKm2: 7800, category: 'MAJOR_METRO' },
  { id: 'pop-bandung', name: 'Bandung Highlands', country: 'Indonesia', coordinates: { lat: -6.9175, lng: 107.6191 }, metroPopulation: 8800000, densityPerKm2: 8500, category: 'MAJOR_METRO' },
  { id: 'pop-padang', name: 'Padang-Bukittinggi Sumatra', country: 'Indonesia', coordinates: { lat: -0.9471, lng: 100.4172 }, metroPopulation: 1650000, densityPerKm2: 1850, category: 'REGIONAL_DENSE' },
  { id: 'pop-bangkok', name: 'Bangkok Metropolitan', country: 'Thailand', coordinates: { lat: 13.7563, lng: 100.5018 }, metroPopulation: 11200000, densityPerKm2: 5300, category: 'MEGACITY' },
  { id: 'pop-hochiminh', name: 'Ho Chi Minh City', country: 'Vietnam', coordinates: { lat: 10.8231, lng: 106.6297 }, metroPopulation: 9300000, densityPerKm2: 4400, category: 'MAJOR_METRO' },
  { id: 'pop-hanoi', name: 'Hanoi Red River Delta', country: 'Vietnam', coordinates: { lat: 21.0285, lng: 105.8542 }, metroPopulation: 8500000, densityPerKm2: 4900, category: 'MAJOR_METRO' },
  { id: 'pop-sydney', name: 'Sydney Greater Region', country: 'Australia', coordinates: { lat: -33.8688, lng: 151.2093 }, metroPopulation: 5300000, densityPerKm2: 1200, category: 'MAJOR_METRO' },
  { id: 'pop-auckland', name: 'Auckland Urban Area', country: 'New Zealand', coordinates: { lat: -36.8485, lng: 174.7633 }, metroPopulation: 1700000, densityPerKm2: 1300, category: 'REGIONAL_DENSE' },
  { id: 'pop-nukualofa', name: 'Nukuʻalofa Tongatapu', country: 'Tonga', coordinates: { lat: -21.1393, lng: -175.2018 }, metroPopulation: 75000, densityPerKm2: 720, category: 'REGIONAL_DENSE' },
  { id: 'pop-png-highland', name: 'Enga-Western Highlands', country: 'Papua New Guinea', coordinates: { lat: -5.4500, lng: 143.5000 }, metroPopulation: 450000, densityPerKm2: 280, category: 'REGIONAL_DENSE' },

  // South Asia
  { id: 'pop-delhi', name: 'National Capital Region (Delhi)', country: 'India', coordinates: { lat: 28.6139, lng: 77.2090 }, metroPopulation: 33000000, densityPerKm2: 11300, category: 'MEGACITY' },
  { id: 'pop-mumbai', name: 'Mumbai Metropolitan Region', country: 'India', coordinates: { lat: 19.0760, lng: 72.8777 }, metroPopulation: 21300000, densityPerKm2: 25000, category: 'MEGACITY' },
  { id: 'pop-kolkata', name: 'Kolkata Urban Agglomeration', country: 'India', coordinates: { lat: 22.5726, lng: 88.3639 }, metroPopulation: 15300000, densityPerKm2: 12000, category: 'MEGACITY' },
  { id: 'pop-bangalore', name: 'Bengaluru Tech Corridor', country: 'India', coordinates: { lat: 12.9716, lng: 77.5946 }, metroPopulation: 13600000, densityPerKm2: 4900, category: 'MEGACITY' },
  { id: 'pop-chennai', name: 'Chennai Coastal Metro', country: 'India', coordinates: { lat: 13.0827, lng: 80.2707 }, metroPopulation: 11900000, densityPerKm2: 9500, category: 'MEGACITY' },
  { id: 'pop-dhaka', name: 'Greater Dhaka', country: 'Bangladesh', coordinates: { lat: 23.8103, lng: 90.4125 }, metroPopulation: 23200000, densityPerKm2: 30000, category: 'MEGACITY' },
  { id: 'pop-chittagong', name: 'Chittagong Coastal Belt', country: 'Bangladesh', coordinates: { lat: 22.3569, lng: 91.7832 }, metroPopulation: 5300000, densityPerKm2: 8900, category: 'MAJOR_METRO' },
  { id: 'pop-karachi', name: 'Karachi Coastal Megacity', country: 'Pakistan', coordinates: { lat: 24.8607, lng: 67.0011 }, metroPopulation: 17200000, densityPerKm2: 10200, category: 'MEGACITY' },
  { id: 'pop-lahore', name: 'Lahore Urban Area', country: 'Pakistan', coordinates: { lat: 31.5204, lng: 74.3587 }, metroPopulation: 13900000, densityPerKm2: 6800, category: 'MEGACITY' },
  { id: 'pop-jacobabad', name: 'Indus Basin / Jacobabad-Sukkur', country: 'Pakistan', coordinates: { lat: 28.2818, lng: 68.4385 }, metroPopulation: 1200000, densityPerKm2: 950, category: 'REGIONAL_DENSE' },
  { id: 'pop-kathmandu', name: 'Kathmandu Valley', country: 'Nepal', coordinates: { lat: 27.7172, lng: 85.3240 }, metroPopulation: 3100000, densityPerKm2: 6200, category: 'MAJOR_METRO' },

  // Middle East & Mediterranean & Europe
  { id: 'pop-cairo', name: 'Greater Cairo & Nile Delta', country: 'Egypt', coordinates: { lat: 30.0444, lng: 31.2357 }, metroPopulation: 22100000, densityPerKm2: 19500, category: 'MEGACITY' },
  { id: 'pop-alexandria', name: 'Alexandria Mediterranean Port', country: 'Egypt', coordinates: { lat: 31.2001, lng: 29.9187 }, metroPopulation: 5400000, densityPerKm2: 6100, category: 'MAJOR_METRO' },
  { id: 'pop-istanbul', name: 'Istanbul Bosphorus Agglomeration', country: 'Turkey', coordinates: { lat: 41.0082, lng: 28.9784 }, metroPopulation: 16000000, densityPerKm2: 6500, category: 'MEGACITY' },
  { id: 'pop-kahramanmaras', name: 'Kahramanmaraş-Gaziantep Seismic Zone', country: 'Turkey', coordinates: { lat: 37.5858, lng: 36.9371 }, metroPopulation: 3100000, densityPerKm2: 1400, category: 'REGIONAL_DENSE' },
  { id: 'pop-tehran', name: 'Tehran Metropolitan Area', country: 'Iran', coordinates: { lat: 35.6892, lng: 51.3890 }, metroPopulation: 9400000, densityPerKm2: 4800, category: 'MAJOR_METRO' },
  { id: 'pop-baghdad', name: 'Baghdad Tigris Basin', country: 'Iraq', coordinates: { lat: 33.3152, lng: 44.3661 }, metroPopulation: 7700000, densityPerKm2: 5200, category: 'MAJOR_METRO' },
  { id: 'pop-valencia', name: 'Valencia-L’Horta Metropolitan', country: 'Spain', coordinates: { lat: 39.4699, lng: -0.3763 }, metroPopulation: 1600000, densityPerKm2: 3200, category: 'MAJOR_METRO' },
  { id: 'pop-madrid', name: 'Community of Madrid', country: 'Spain', coordinates: { lat: 40.4168, lng: -3.7038 }, metroPopulation: 6700000, densityPerKm2: 2400, category: 'MAJOR_METRO' },
  { id: 'pop-paris', name: 'Île-de-France (Paris)', country: 'France', coordinates: { lat: 48.8566, lng: 2.3522 }, metroPopulation: 11100000, densityPerKm2: 8500, category: 'MEGACITY' },
  { id: 'pop-chamonix', name: 'Arve Valley Alpine Hub (Chamonix)', country: 'France', coordinates: { lat: 45.9237, lng: 6.8694 }, metroPopulation: 120000, densityPerKm2: 350, category: 'REGIONAL_DENSE' },
  { id: 'pop-london', name: 'Greater London Metropolitan', country: 'United Kingdom', coordinates: { lat: 51.5074, lng: -0.1278 }, metroPopulation: 9600000, densityPerKm2: 5700, category: 'MAJOR_METRO' },
  { id: 'pop-rome', name: 'Metropolitan City of Rome', country: 'Italy', coordinates: { lat: 41.9028, lng: 12.4964 }, metroPopulation: 4300000, densityPerKm2: 2200, category: 'MAJOR_METRO' },
  { id: 'pop-naples', name: 'Naples-Vesuvius Volcanic Basin', country: 'Italy', coordinates: { lat: 40.8518, lng: 14.2681 }, metroPopulation: 3100000, densityPerKm2: 8100, category: 'REGIONAL_DENSE' },
  { id: 'pop-rhine', name: 'Rhine-Ruhr Polycentric Region', country: 'Germany', coordinates: { lat: 51.4556, lng: 7.0116 }, metroPopulation: 10600000, densityPerKm2: 3100, category: 'MAJOR_METRO' },

  // Africa
  { id: 'pop-lagos', name: 'Lagos Megacity', country: 'Nigeria', coordinates: { lat: 6.5244, lng: 3.3792 }, metroPopulation: 16500000, densityPerKm2: 18000, category: 'MEGACITY' },
  { id: 'pop-kinshasa', name: 'Kinshasa Metropolitan', country: 'DR Congo', coordinates: { lat: -4.4419, lng: 15.2663 }, metroPopulation: 17100000, densityPerKm2: 9800, category: 'MEGACITY' },
  { id: 'pop-mubende', name: 'Mubende-Central Uganda Zone', country: 'Uganda', coordinates: { lat: 0.5585, lng: 31.3949 }, metroPopulation: 750000, densityPerKm2: 650, category: 'REGIONAL_DENSE' },
  { id: 'pop-kampala', name: 'Greater Kampala Metropolitan', country: 'Uganda', coordinates: { lat: 0.3476, lng: 32.5825 }, metroPopulation: 3700000, densityPerKm2: 4500, category: 'MAJOR_METRO' },
  { id: 'pop-nairobi', name: 'Nairobi Urban Area', country: 'Kenya', coordinates: { lat: -1.2921, lng: 36.8219 }, metroPopulation: 5100000, densityPerKm2: 3800, category: 'MAJOR_METRO' },
  { id: 'pop-addis', name: 'Addis Ababa Metropolitan', country: 'Ethiopia', coordinates: { lat: 9.0300, lng: 38.7400 }, metroPopulation: 5400000, densityPerKm2: 5200, category: 'MAJOR_METRO' },
  { id: 'pop-baidoa', name: 'Baidoa-Bay Drought Corridor', country: 'Somalia', coordinates: { lat: 3.1138, lng: 43.6502 }, metroPopulation: 850000, densityPerKm2: 420, category: 'REGIONAL_DENSE' },
  { id: 'pop-johannesburg', name: 'Gauteng (Johannesburg-Pretoria)', country: 'South Africa', coordinates: { lat: -26.2041, lng: 28.0473 }, metroPopulation: 10500000, densityPerKm2: 3400, category: 'MAJOR_METRO' },

  // North America
  { id: 'pop-nyc', name: 'New York Tri-State Area', country: 'United States', coordinates: { lat: 40.7128, lng: -74.0060 }, metroPopulation: 19800000, densityPerKm2: 5400, category: 'MEGACITY' },
  { id: 'pop-la', name: 'Greater Los Angeles Basin', country: 'United States', coordinates: { lat: 34.0522, lng: -118.2437 }, metroPopulation: 13200000, densityPerKm2: 3200, category: 'MEGACITY' },
  { id: 'pop-sf-bay', name: 'San Francisco Bay Area', country: 'United States', coordinates: { lat: 37.7749, lng: -122.4194 }, metroPopulation: 7800000, densityPerKm2: 2400, category: 'MAJOR_METRO' },
  { id: 'pop-redding', name: 'Redding / Shasta Fire Basin', country: 'United States', coordinates: { lat: 40.5865, lng: -122.3917 }, metroPopulation: 185000, densityPerKm2: 310, category: 'REGIONAL_DENSE' },
  { id: 'pop-okc', name: 'Oklahoma City - Norman Tornado Alley', country: 'United States', coordinates: { lat: 35.3395, lng: -97.4867 }, metroPopulation: 1450000, densityPerKm2: 1100, category: 'REGIONAL_DENSE' },
  { id: 'pop-buffalo', name: 'Buffalo-Niagara Metropolitan', country: 'United States', coordinates: { lat: 42.8864, lng: -78.8784 }, metroPopulation: 1130000, densityPerKm2: 1250, category: 'REGIONAL_DENSE' },
  { id: 'pop-chicago', name: 'Chicagoland Area', country: 'United States', coordinates: { lat: 41.8781, lng: -87.6298 }, metroPopulation: 9500000, densityPerKm2: 2200, category: 'MAJOR_METRO' },
  { id: 'pop-houston', name: 'Greater Houston Gulf Coast', country: 'United States', coordinates: { lat: 29.7604, lng: -95.3698 }, metroPopulation: 7300000, densityPerKm2: 1600, category: 'MAJOR_METRO' },
  { id: 'pop-miami', name: 'South Florida (Miami-Fort Lauderdale)', country: 'United States', coordinates: { lat: 25.7617, lng: -80.1918 }, metroPopulation: 6100000, densityPerKm2: 1900, category: 'MAJOR_METRO' },
  { id: 'pop-mexico-city', name: 'Valley of Mexico (Greater CDMX)', country: 'Mexico', coordinates: { lat: 19.4326, lng: -99.1332 }, metroPopulation: 22300000, densityPerKm2: 9800, category: 'MEGACITY' },
  { id: 'pop-toronto', name: 'Greater Toronto Area (GTA)', country: 'Canada', coordinates: { lat: 43.6532, lng: -79.3832 }, metroPopulation: 6400000, densityPerKm2: 4400, category: 'MAJOR_METRO' },

  // South America
  { id: 'pop-saopaulo', name: 'Greater São Paulo Megacity', country: 'Brazil', coordinates: { lat: -23.5505, lng: -46.6333 }, metroPopulation: 22600000, densityPerKm2: 8100, category: 'MEGACITY' },
  { id: 'pop-rio', name: 'Rio de Janeiro Metropolitan', country: 'Brazil', coordinates: { lat: -22.9068, lng: -43.1729 }, metroPopulation: 13400000, densityPerKm2: 5200, category: 'MEGACITY' },
  { id: 'pop-buenosaires', name: 'Greater Buenos Aires (Gran BA)', country: 'Argentina', coordinates: { lat: -34.6037, lng: -58.3816 }, metroPopulation: 15600000, densityPerKm2: 4100, category: 'MEGACITY' },
  { id: 'pop-bogota', name: 'Bogotá Savanna Metropolitan', country: 'Colombia', coordinates: { lat: 4.7110, lng: -74.0721 }, metroPopulation: 11400000, densityPerKm2: 13500, category: 'MEGACITY' },
  { id: 'pop-lima', name: 'Lima Coastal Agglomeration', country: 'Peru', coordinates: { lat: -12.0464, lng: -77.0428 }, metroPopulation: 11100000, densityPerKm2: 3800, category: 'MEGACITY' },
  { id: 'pop-santiago', name: 'Santiago Central Valley', country: 'Chile', coordinates: { lat: -33.4489, lng: -70.6693 }, metroPopulation: 7100000, densityPerKm2: 2900, category: 'MAJOR_METRO' },
];

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes humanitarian exposure analytics by calculating intersection
 * of catastrophe impact buffer zones with global population nodes
 */
export function analyzeCatastropheHumanitarianImpact(
  events: Array<{
    id: string;
    name: string;
    type: string;
    severity: string;
    coordinates: { lat: number; lng: number };
    publicAdvisory: { evacuationZoneKm: number };
    medicalEmergency: { affectedPopulation: number; hospitalPressure: string };
  }>,
  hubs: PopulationDensityHub[] = GLOBAL_POPULATION_HUBS
): CatastropheHumanitarianImpact[] {
  return events.map((ev) => {
    // Dynamic impact buffer based on catastrophe type and severity
    const baseBuffer = Math.max(ev.publicAdvisory?.evacuationZoneKm || 20, 25);
    const impactRadiusKm = ev.severity === 'CRITICAL' ? baseBuffer * 3.5 : baseBuffer * 2;

    const nearbyHubs: Array<{ name: string; population: number; distanceKm: number }> = [];
    let estimatedExposure = ev.medicalEmergency?.affectedPopulation || 0;

    hubs.forEach((hub) => {
      const dist = calculateDistanceKm(
        ev.coordinates.lat,
        ev.coordinates.lng,
        hub.coordinates.lat,
        hub.coordinates.lng
      );

      if (dist <= impactRadiusKm) {
        nearbyHubs.push({
          name: hub.name,
          population: hub.metroPopulation,
          distanceKm: Math.round(dist),
        });

        // Add proportional exposure factor based on proximity
        const proximityWeight = Math.max(0.1, 1 - dist / impactRadiusKm);
        estimatedExposure += Math.round(hub.metroPopulation * proximityWeight * 0.15);
      }
    });

    nearbyHubs.sort((a, b) => a.distanceKm - b.distanceKm);

    // Determine risk level
    let riskLevel: 'EXTREME_CRITICAL' | 'HIGH_ALERT' | 'MODERATE' | 'MONITORED' = 'MODERATE';
    if (ev.severity === 'CRITICAL' || estimatedExposure > 1000000) {
      riskLevel = 'EXTREME_CRITICAL';
    } else if (ev.severity === 'HIGH' || estimatedExposure > 200000) {
      riskLevel = 'HIGH_ALERT';
    } else if (estimatedExposure > 50000) {
      riskLevel = 'MODERATE';
    } else {
      riskLevel = 'MONITORED';
    }

    let urgency: 'IMMEDIATE_COLLAPSE_RISK' | 'HIGH_SURGE' | 'ELEVATED' | 'STABLE' = 'ELEVATED';
    if (ev.medicalEmergency?.hospitalPressure === 'CRITICAL_OVERWHELMED') {
      urgency = 'IMMEDIATE_COLLAPSE_RISK';
    } else if (ev.medicalEmergency?.hospitalPressure === 'HIGH') {
      urgency = 'HIGH_SURGE';
    }

    return {
      eventId: ev.id,
      eventName: ev.name,
      eventType: ev.type,
      severity: ev.severity,
      coordinates: ev.coordinates,
      impactRadiusKm: Math.round(impactRadiusKm),
      totalExposedPopulation: estimatedExposure,
      vulnerableMetros: nearbyHubs,
      humanitarianRiskLevel: riskLevel,
      hospitalTriageUrgency: urgency,
    };
  });
}
