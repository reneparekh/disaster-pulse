import { CalamityEvent } from '../types/disaster';
import { calculateDistanceKm } from './geolocationUtils';

export interface GeocodingResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  type: 'live_event' | 'city' | 'country' | 'region';
  event?: CalamityEvent;
  country?: string;
  nearbyEventsCount?: number;
}

// Built-in worldwide major cities and disaster corridors for instant, zero-latency search
export const GLOBAL_CITY_DATABASE: Array<{
  name: string;
  country: string;
  lat: number;
  lng: number;
  aliases?: string[];
}> = [
  // Asia & Pacific
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, aliases: ['kanto', 'edo'] },
  { name: 'Sendai', country: 'Japan', lat: 38.2682, lng: 140.8694, aliases: ['miyagi', 'tohoku'] },
  { name: 'Osaka', country: 'Japan', lat: 34.6937, lng: 135.5023, aliases: ['kansai'] },
  { name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
  { name: 'Fukushima', country: 'Japan', lat: 37.7608, lng: 140.4748 },
  { name: 'Sapporo', country: 'Japan', lat: 43.0618, lng: 141.3545, aliases: ['hokkaido'] },
  { name: 'Manila', country: 'Philippines', lat: 14.5995, lng: 120.9842, aliases: ['luzon'] },
  { name: 'Cebu', country: 'Philippines', lat: 10.3157, lng: 123.8854, aliases: ['visayas'] },
  { name: 'Davao', country: 'Philippines', lat: 7.1907, lng: 125.4553, aliases: ['mindanao'] },
  { name: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, aliases: ['java'] },
  { name: 'Padang', country: 'Indonesia', lat: -0.9492, lng: 100.3543, aliases: ['west sumatra', 'sumatra', 'marapi'] },
  { name: 'Bandung', country: 'Indonesia', lat: -6.9175, lng: 107.6191 },
  { name: 'Surabaya', country: 'Indonesia', lat: -7.2575, lng: 112.7521 },
  { name: 'Bali', country: 'Indonesia', lat: -8.4095, lng: 115.1889, aliases: ['denpasar'] },
  { name: 'Yogyakarta', country: 'Indonesia', lat: -7.7956, lng: 110.3695, aliases: ['merapi'] },
  { name: 'Taipei', country: 'Taiwan', lat: 25.033, lng: 121.5654, aliases: ['hualien'] },
  { name: 'Hualien', country: 'Taiwan', lat: 23.9872, lng: 121.6016 },
  { name: 'Seoul', country: 'South Korea', lat: 37.5665, lng: 126.978 },
  { name: 'Beijing', country: 'China', lat: 39.9042, lng: 116.4074 },
  { name: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737 },
  { name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { name: 'Hanoi', country: 'Vietnam', lat: 21.0285, lng: 105.8542 },
  { name: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8231, lng: 106.6297, aliases: ['saigon'] },
  { name: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869 },
  { name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, aliases: ['nsw'] },
  { name: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631, aliases: ['victoria'] },
  { name: 'Brisbane', country: 'Australia', lat: -27.4698, lng: 153.0251, aliases: ['queensland'] },
  { name: 'Perth', country: 'Australia', lat: -31.9505, lng: 115.8605 },
  { name: 'Auckland', country: 'New Zealand', lat: -36.8485, lng: 174.7633 },
  { name: 'Wellington', country: 'New Zealand', lat: -41.2865, lng: 174.7762 },
  { name: 'Christchurch', country: 'New Zealand', lat: -43.5321, lng: 172.6362, aliases: ['canterbury'] },
  { name: 'Suva', country: 'Fiji', lat: -18.1416, lng: 178.4419 },
  { name: 'Nukuʻalofa', country: 'Tonga', lat: -21.1393, lng: -175.2018, aliases: ['hunga tonga'] },
  { name: 'Port Moresby', country: 'Papua New Guinea', lat: -9.4438, lng: 147.1803 },
  { name: 'Kathmandu', country: 'Nepal', lat: 27.7172, lng: 85.324, aliases: ['himalayas', 'everest'] },
  { name: 'New Delhi', country: 'India', lat: 28.6139, lng: 77.209 },
  { name: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777, aliases: ['bombay'] },
  { name: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639, aliases: ['calcutta', 'bengal'] },
  { name: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125 },
  { name: 'Islamabad', country: 'Pakistan', lat: 33.6844, lng: 73.0479 },
  { name: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011 },
  { name: 'Colombo', country: 'Sri Lanka', lat: 6.9271, lng: 79.8612 },

  // Middle East & Mediterranean
  { name: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784, aliases: ['constantinople', 'marmara'] },
  { name: 'Ankara', country: 'Turkey', lat: 39.9334, lng: 32.8597 },
  { name: 'Izmir', country: 'Turkey', lat: 38.4237, lng: 27.1428, aliases: ['aegean'] },
  { name: 'Gaziantep', country: 'Turkey', lat: 37.0662, lng: 37.3833, aliases: ['antakya', 'kahramanmaras'] },
  { name: 'Antakya', country: 'Turkey', lat: 36.2023, lng: 36.1606, aliases: ['hatay'] },
  { name: 'Athens', country: 'Greece', lat: 37.9838, lng: 23.7275 },
  { name: 'Crete', country: 'Greece', lat: 35.2401, lng: 24.8093, aliases: ['heraklion'] },
  { name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { name: 'Naples', country: 'Italy', lat: 40.8518, lng: 14.2681, aliases: ['vesuvius', 'campania'] },
  { name: 'Catania', country: 'Italy', lat: 37.5079, lng: 15.0873, aliases: ['etna', 'sicily'] },
  { name: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038 },
  { name: 'Barcelona', country: 'Spain', lat: 41.3879, lng: 2.1699, aliases: ['catalonia'] },
  { name: 'Valencia', country: 'Spain', lat: 39.4699, lng: -0.3763, aliases: ['catarroja', 'paiporta', 'dana'] },
  { name: 'Lisbon', country: 'Portugal', lat: 38.7223, lng: -9.1393 },
  { name: 'Beirut', country: 'Lebanon', lat: 33.8938, lng: 35.5018 },
  { name: 'Tehran', country: 'Iran', lat: 35.6892, lng: 51.389 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { name: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },

  // North America
  { name: 'San Francisco', country: 'United States', lat: 37.7749, lng: -122.4194, aliases: ['sf', 'bay area', 'california', 'san andreas'] },
  { name: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437, aliases: ['la', 'socal', 'california'] },
  { name: 'San Diego', country: 'United States', lat: 32.7157, lng: -117.1611 },
  { name: 'Redding', country: 'United States', lat: 40.5865, lng: -122.3917, aliases: ['shasta', 'chaparral', 'california wildfire'] },
  { name: 'Sacramento', country: 'United States', lat: 38.5816, lng: -121.4944 },
  { name: 'Seattle', country: 'United States', lat: 47.6062, lng: -122.3321, aliases: ['cascadia', 'washington', 'puget sound'] },
  { name: 'Portland', country: 'United States', lat: 45.5152, lng: -122.6784, aliases: ['oregon'] },
  { name: 'Honolulu', country: 'United States', lat: 21.3069, lng: -157.8583, aliases: ['hawaii', 'oahu', 'kilauea', 'maui'] },
  { name: 'Anchorage', country: 'United States', lat: 61.2181, lng: -149.9003, aliases: ['alaska'] },
  { name: 'Miami', country: 'United States', lat: 25.7617, lng: -80.1918, aliases: ['florida', 'hurricane', 'south florida'] },
  { name: 'Tampa', country: 'United States', lat: 27.9506, lng: -82.4572, aliases: ['florida'] },
  { name: 'Orlando', country: 'United States', lat: 28.5383, lng: -81.3792 },
  { name: 'New Orleans', country: 'United States', lat: 29.9511, lng: -90.0715, aliases: ['louisiana', 'gulf coast', 'katrina'] },
  { name: 'Houston', country: 'United States', lat: 29.7604, lng: -95.3698, aliases: ['texas', 'gulf'] },
  { name: 'Dallas', country: 'United States', lat: 32.7767, lng: -96.797 },
  { name: 'Austin', country: 'United States', lat: 30.2672, lng: -97.7431 },
  { name: 'Oklahoma City', country: 'United States', lat: 35.4676, lng: -97.5164, aliases: ['oklahoma', 'tornado alley'] },
  { name: 'Denver', country: 'United States', lat: 39.7392, lng: -104.9903, aliases: ['colorado', 'rockies'] },
  { name: 'Salt Lake City', country: 'United States', lat: 40.7608, lng: -111.891, aliases: ['utah'] },
  { name: 'Phoenix', country: 'United States', lat: 33.4484, lng: -112.074, aliases: ['arizona', 'heat wave'] },
  { name: 'Las Vegas', country: 'United States', lat: 36.1699, lng: -115.1398, aliases: ['nevada'] },
  { name: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298, aliases: ['illinois', 'midwest'] },
  { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.006, aliases: ['nyc', 'manhattan', 'brooklyn'] },
  { name: 'Boston', country: 'United States', lat: 42.3601, lng: -71.0589, aliases: ['massachusetts', 'new england'] },
  { name: 'Washington DC', country: 'United States', lat: 38.9072, lng: -77.0369 },
  { name: 'Vancouver', country: 'Canada', lat: 49.2827, lng: -123.1207, aliases: ['british columbia', 'bc'] },
  { name: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, aliases: ['ontario'] },
  { name: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673, aliases: ['quebec'] },
  { name: 'Calgary', country: 'Canada', lat: 51.0447, lng: -114.0719, aliases: ['alberta'] },
  { name: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332, aliases: ['cdmx', 'popocatepetl'] },
  { name: 'Guadalajara', country: 'Mexico', lat: 20.6597, lng: -103.3496 },
  { name: 'Monterrey', country: 'Mexico', lat: 25.6866, lng: -100.3161 },
  { name: 'Cancún', country: 'Mexico', lat: 21.1619, lng: -86.8515, aliases: ['yucatan', 'caribbean'] },

  // South America
  { name: 'Santiago', country: 'Chile', lat: -33.4489, lng: -70.6693, aliases: ['andes', 'valparaiso'] },
  { name: 'Valparaíso', country: 'Chile', lat: -33.0472, lng: -71.6127 },
  { name: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428 },
  { name: 'Cusco', country: 'Peru', lat: -13.5319, lng: -71.9675 },
  { name: 'Quito', country: 'Ecuador', lat: -0.1807, lng: -78.4678, aliases: ['cotopaxi'] },
  { name: 'Bogotá', country: 'Colombia', lat: 4.711, lng: -74.0721 },
  { name: 'Medellín', country: 'Colombia', lat: 6.2442, lng: -75.5812 },
  { name: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816 },
  { name: 'Rio de Janeiro', country: 'Brazil', lat: -22.9068, lng: -43.1729 },
  { name: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },

  // Europe & Iceland
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, aliases: ['england', 'uk'] },
  { name: 'Edinburgh', country: 'United Kingdom', lat: 55.9533, lng: -3.1883, aliases: ['scotland'] },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { name: 'Nice', country: 'France', lat: 43.7102, lng: 7.262 },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
  { name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.582, aliases: ['bavaria'] },
  { name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { name: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517 },
  { name: 'Zurich', country: 'Switzerland', lat: 47.3769, lng: 8.5417, aliases: ['alps'] },
  { name: 'Geneva', country: 'Switzerland', lat: 46.2044, lng: 6.1432 },
  { name: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3738 },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1466, lng: -21.9426, aliases: ['grindavik', 'fagradalsfjall', 'reykjanes'] },
  { name: 'Grindavík', country: 'Iceland', lat: 63.8425, lng: -22.4343, aliases: ['blue lagoon', 'volcano'] },
  { name: 'Oslo', country: 'Norway', lat: 59.9139, lng: 10.7522 },
  { name: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686 },
  { name: 'Helsinki', country: 'Finland', lat: 60.1699, lng: 24.9384 },
  { name: 'Warsaw', country: 'Poland', lat: 52.2297, lng: 21.0122 },
  { name: 'Kyiv', country: 'Ukraine', lat: 50.4501, lng: 30.5234 },

  // Africa
  { name: 'Johannesburg', country: 'South Africa', lat: -26.2041, lng: 28.0473 },
  { name: 'Cape Town', country: 'South Africa', lat: -33.9249, lng: 18.4241 },
  { name: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219 },
  { name: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792 },
  { name: 'Casablanca', country: 'Morocco', lat: 33.5731, lng: -7.5898, aliases: ['marrakech'] },
  { name: 'Marrakech', country: 'Morocco', lat: 31.6295, lng: -7.9811, aliases: ['atlas mountains'] },
];

// Major Countries and Territories Database for Country-Level Geocoding
export const GLOBAL_COUNTRY_DATABASE: Array<{
  name: string;
  lat: number;
  lng: number;
  aliases: string[];
}> = [
  { name: 'Japan', lat: 36.2048, lng: 138.2529, aliases: ['jp', 'nippon', 'nihon'] },
  { name: 'United States', lat: 37.0902, lng: -95.7129, aliases: ['usa', 'us', 'america', 'united states of america'] },
  { name: 'Spain', lat: 40.4637, lng: -3.7492, aliases: ['es', 'espana'] },
  { name: 'Turkey', lat: 38.9637, lng: 35.2433, aliases: ['tr', 'turkiye', 'turkey'] },
  { name: 'Philippines', lat: 12.8797, lng: 121.774, aliases: ['ph', 'pilipinas'] },
  { name: 'Indonesia', lat: -0.7893, lng: 113.9213, aliases: ['id', 'nusantara'] },
  { name: 'Italy', lat: 41.8719, lng: 12.5674, aliases: ['it', 'italia'] },
  { name: 'Greece', lat: 39.0742, lng: 21.8243, aliases: ['gr', 'hellas'] },
  { name: 'Iceland', lat: 64.9631, lng: -19.0208, aliases: ['is', 'island'] },
  { name: 'India', lat: 20.5937, lng: 78.9629, aliases: ['in', 'bharat'] },
  { name: 'Chile', lat: -35.6751, lng: -71.543, aliases: ['cl'] },
  { name: 'Mexico', lat: 23.6345, lng: -102.5528, aliases: ['mx'] },
  { name: 'Australia', lat: -25.2744, lng: 133.7751, aliases: ['au', 'oz'] },
  { name: 'New Zealand', lat: -40.9006, lng: 174.886, aliases: ['nz', 'aotearoa'] },
  { name: 'Canada', lat: 56.1304, lng: -106.3468, aliases: ['ca'] },
  { name: 'United Kingdom', lat: 55.3781, lng: -3.436, aliases: ['uk', 'britain', 'great britain', 'england'] },
  { name: 'France', lat: 46.2276, lng: 2.2137, aliases: ['fr'] },
  { name: 'Germany', lat: 51.1657, lng: 10.4515, aliases: ['de', 'deutschland'] },
  { name: 'Portugal', lat: 39.3999, lng: -8.2245, aliases: ['pt'] },
  { name: 'Brazil', lat: -14.235, lng: -51.9253, aliases: ['br', 'brasil'] },
  { name: 'Argentina', lat: -38.4161, lng: -63.6167, aliases: ['ar'] },
  { name: 'Peru', lat: -9.19, lng: -75.0152, aliases: ['pe'] },
  { name: 'Colombia', lat: 4.5709, lng: -74.2973, aliases: ['co'] },
  { name: 'Ecuador', lat: -1.8312, lng: -78.1834, aliases: ['ec'] },
  { name: 'Taiwan', lat: 23.6978, lng: 120.9605, aliases: ['tw'] },
  { name: 'China', lat: 35.8617, lng: 104.1954, aliases: ['cn'] },
  { name: 'South Korea', lat: 35.9078, lng: 127.7669, aliases: ['kr', 'korea'] },
  { name: 'Thailand', lat: 15.87, lng: 100.9925, aliases: ['th'] },
  { name: 'Vietnam', lat: 14.0583, lng: 108.2772, aliases: ['vn'] },
  { name: 'Malaysia', lat: 4.2105, lng: 101.9758, aliases: ['my'] },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, aliases: ['sg'] },
  { name: 'Pakistan', lat: 30.3753, lng: 69.3451, aliases: ['pk'] },
  { name: 'Bangladesh', lat: 23.685, lng: 90.3563, aliases: ['bd'] },
  { name: 'Nepal', lat: 28.3949, lng: 84.124, aliases: ['np'] },
  { name: 'Fiji', lat: -17.7134, lng: 178.065, aliases: ['fj'] },
  { name: 'Tonga', lat: -21.1789, lng: -175.1982, aliases: ['to'] },
  { name: 'Papua New Guinea', lat: -6.314993, lng: 143.95555, aliases: ['png'] },
  { name: 'Egypt', lat: 26.8206, lng: 30.8025, aliases: ['eg'] },
  { name: 'Morocco', lat: 31.7917, lng: -7.0926, aliases: ['ma'] },
  { name: 'South Africa', lat: -30.5595, lng: 22.9375, aliases: ['za'] },
  { name: 'Kenya', lat: -0.0236, lng: 37.9062, aliases: ['ke'] },
  { name: 'Nigeria', lat: 9.082, lng: 8.6753, aliases: ['ng'] },
  { name: 'Ukraine', lat: 48.3794, lng: 31.1656, aliases: ['ua'] },
  { name: 'Norway', lat: 60.472, lng: 8.4689, aliases: ['no'] },
  { name: 'Sweden', lat: 60.1282, lng: 18.6435, aliases: ['se'] },
  { name: 'Finland', lat: 61.9241, lng: 25.7482, aliases: ['fi'] },
  { name: 'Switzerland', lat: 46.8182, lng: 8.2275, aliases: ['ch'] },
];

/**
 * Finds all live events occurring within `radiusKm` of given coordinates
 */
export function findEventsNearCoordinates(
  lat: number,
  lng: number,
  events: CalamityEvent[],
  radiusKm = 500
): Array<{ event: CalamityEvent; distanceKm: number }> {
  return events
    .map(ev => ({
      event: ev,
      distanceKm: calculateDistanceKm(lat, lng, ev.coordinates.lat, ev.coordinates.lng),
    }))
    .filter(item => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Finds the single closest live event anywhere on earth
 */
export function findNearestEvent(
  lat: number,
  lng: number,
  events: CalamityEvent[]
): { event: CalamityEvent; distanceKm: number } | null {
  if (!events || events.length === 0) return null;
  let nearest: CalamityEvent = events[0];
  let minDistance = calculateDistanceKm(lat, lng, events[0].coordinates.lat, events[0].coordinates.lng);

  for (let i = 1; i < events.length; i++) {
    const dist = calculateDistanceKm(lat, lng, events[i].coordinates.lat, events[i].coordinates.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = events[i];
    }
  }

  return { event: nearest, distanceKm: minDistance };
}

/**
 * Searches for a location by text query:
 * 1. Matches active live disaster event locations (city, country, event name)
 * 2. Matches comprehensive global city/region database
 * 3. Matches global country database
 * 4. Falls back to OpenStreetMap Nominatim geocoding if query is non-empty
 */
export async function searchLocationWithLiveEvents(
  query: string,
  events: CalamityEvent[]
): Promise<GeocodingResult[]> {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const results: GeocodingResult[] = [];
  const seenKeys = new Set<string>();

  // 1. MATCH ACTIVE LIVE DISASTER EVENTS (Direct hit on live disaster occurrences)
  events.forEach(ev => {
    const cityName = ev.city.toLowerCase();
    const countryName = ev.country.toLowerCase();
    const eventName = ev.name.toLowerCase();
    const typeName = ev.type.toLowerCase();

    if (
      cityName.includes(clean) ||
      countryName.includes(clean) ||
      eventName.includes(clean) ||
      typeName.includes(clean)
    ) {
      const key = `event-${ev.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        // Find how many events exist within 300km of this event
        const nearby = findEventsNearCoordinates(ev.coordinates.lat, ev.coordinates.lng, events, 300);

        results.push({
          id: key,
          name: `${ev.city}, ${ev.country}`,
          displayName: `🚨 ${ev.name} (${ev.city}, ${ev.country})`,
          lat: ev.coordinates.lat,
          lng: ev.coordinates.lng,
          type: 'live_event',
          event: ev,
          country: ev.country,
          nearbyEventsCount: nearby.length,
        });
      }
    }
  });

  // 2. MATCH GLOBAL CITIES DATABASE
  GLOBAL_CITY_DATABASE.forEach(city => {
    const cName = city.name.toLowerCase();
    const cCountry = city.country.toLowerCase();
    const matchesAlias = city.aliases?.some(a => a.toLowerCase().includes(clean));

    if (cName.includes(clean) || cCountry.includes(clean) || matchesAlias) {
      const key = `city-${city.name}-${city.country}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        const nearby = findEventsNearCoordinates(city.lat, city.lng, events, 450);

        results.push({
          id: key,
          name: `${city.name}, ${city.country}`,
          displayName: `📍 ${city.name}, ${city.country}`,
          lat: city.lat,
          lng: city.lng,
          type: 'city',
          country: city.country,
          nearbyEventsCount: nearby.length,
        });
      }
    }
  });

  // 3. MATCH GLOBAL COUNTRY DATABASE
  GLOBAL_COUNTRY_DATABASE.forEach(country => {
    const cName = country.name.toLowerCase();
    const matchesAlias = country.aliases.some(a => a.toLowerCase() === clean || a.toLowerCase().includes(clean));

    if (cName.includes(clean) || matchesAlias) {
      const key = `country-${country.name}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        const nearby = findEventsNearCoordinates(country.lat, country.lng, events, 1200);

        results.push({
          id: key,
          name: country.name,
          displayName: `🌍 ${country.name}`,
          lat: country.lat,
          lng: country.lng,
          type: 'country',
          country: country.name,
          nearbyEventsCount: nearby.length,
        });
      }
    }
  });

  // If local results are found, return top matches
  if (results.length > 0) {
    // Sort: Exact matches first, then live events, then places with most live events
    return results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === clean;
      const bExact = b.name.toLowerCase() === clean;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      if (a.type === 'live_event' && b.type !== 'live_event') return -1;
      if (b.type === 'live_event' && a.type !== 'live_event') return 1;
      return (b.nearbyEventsCount || 0) - (a.nearbyEventsCount || 0);
    }).slice(0, 8);
  }

  // 4. FALLBACK TO NOMINATIM OPENSTREETMAP GEOCODING API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=4&addressdetails=1`,
      {
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      data.forEach((item: any, idx: number) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          const nearby = findEventsNearCoordinates(lat, lng, events, 450);
          results.push({
            id: `nominatim-${idx}-${item.place_id || idx}`,
            name: item.display_name.split(',')[0],
            displayName: `📍 ${item.display_name}`,
            lat,
            lng,
            type: 'city',
            nearbyEventsCount: nearby.length,
          });
        }
      });
    }
  } catch (err) {
    // Network or timeout failure - non fatal
    console.debug('External geocode fallback skipped:', err);
  }

  return results.slice(0, 8);
}
