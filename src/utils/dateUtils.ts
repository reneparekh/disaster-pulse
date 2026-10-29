/**
 * High-precision Date, Time, and Disaster Epicenter Clock Utilities
 */

export interface DisasterLocalClockInfo {
  utcFormatted: string;
  localDateFormatted: string;
  localTimeFormatted: string;
  localTime12h: string;
  localDayOfWeek: string;
  timezoneName: string;
  utcOffsetHours: number;
  utcOffsetStr: string;
  solarPhase: 'NIGHT' | 'DAYLIGHT' | 'DAWN' | 'DUSK';
  solarPhaseDescription: string;
  elapsedDurationStr: string;
  missionClockTPlus: string;
}

// Known country/regional timezone offsets (Standard & Daylight approximations)
const REGION_TZ_MAP: Record<string, { offset: number; tzName: string }> = {
  indonesia: { offset: 7, tzName: 'WIB (West Indonesia Time)' },
  tonga: { offset: 13, tzName: 'TOT (Tonga Time)' },
  turkey: { offset: 3, tzName: 'TRT (Turkey Time)' },
  türkiye: { offset: 3, tzName: 'TRT (Turkey Time)' },
  uganda: { offset: 3, tzName: 'EAT (East Africa Time)' },
  papua: { offset: 10, tzName: 'PGT (Papua New Guinea Time)' },
  france: { offset: 2, tzName: 'CEST (Central European Summer Time)' },
  philippines: { offset: 8, tzName: 'PHT (Philippine Standard Time)' },
  spain: { offset: 2, tzName: 'CEST (Central European Summer Time)' },
  somalia: { offset: 3, tzName: 'EAT (East Africa Time)' },
  pakistan: { offset: 5, tzName: 'PKT (Pakistan Standard Time)' },
  egypt: { offset: 3, tzName: 'EEST (Eastern European Summer Time)' },
  japan: { offset: 9, tzName: 'JST (Japan Standard Time)' },
  china: { offset: 8, tzName: 'CST (China Standard Time)' },
  taiwan: { offset: 8, tzName: 'CST (Taipei Standard Time)' },
  korea: { offset: 9, tzName: 'KST (Korea Standard Time)' },
  india: { offset: 5.5, tzName: 'IST (India Standard Time)' },
  bangladesh: { offset: 6, tzName: 'BST (Bangladesh Standard Time)' },
  australia: { offset: 10, tzName: 'AEST (Australian Eastern Standard Time)' },
  newzealand: { offset: 13, tzName: 'NZDT (New Zealand Daylight Time)' },
  kenya: { offset: 3, tzName: 'EAT (East Africa Time)' },
  nigeria: { offset: 1, tzName: 'WAT (West Africa Time)' },
  congo: { offset: 1, tzName: 'WAT (West Africa Time)' },
  brazil: { offset: -3, tzName: 'BRT (Brasília Time)' },
  argentina: { offset: -3, tzName: 'ART (Argentina Time)' },
  chile: { offset: -3, tzName: 'CLT (Chile Standard Time)' },
  peru: { offset: -5, tzName: 'PET (Peru Time)' },
  colombia: { offset: -5, tzName: 'COT (Colombia Time)' },
  mexico: { offset: -6, tzName: 'CST (Central Standard Time)' },
  canada: { offset: -4, tzName: 'EDT (Eastern Daylight Time)' },
  uk: { offset: 1, tzName: 'BST (British Summer Time)' },
  italy: { offset: 2, tzName: 'CEST (Central European Summer Time)' },
  germany: { offset: 2, tzName: 'CEST (Central European Summer Time)' },
};

/**
 * Resolves the exact local clock time and date at the disaster site at the moment of occurrence
 */
export function resolveDisasterLocalClock(
  occurredAtStr: string,
  lat: number,
  lng: number,
  country?: string,
  city?: string,
  customLocalStr?: string
): DisasterLocalClockInfo {
  const d = new Date(occurredAtStr);
  const isValid = !isNaN(d.getTime());
  const dateObj = isValid ? d : new Date();

  // Determine timezone offset
  let offsetHours = Math.round(lng / 15);
  let tzName = `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`;

  const cLow = (country || '').toLowerCase();
  const cityLow = (city || '').toLowerCase();

  // Special US Timezone handling by coordinates/states
  if (cLow.includes('united states') || cLow.includes('usa') || cLow.includes('us')) {
    if (cityLow.includes('california') || lng < -115) {
      offsetHours = -7;
      tzName = 'PDT (Pacific Daylight Time)';
    } else if (cityLow.includes('oklahoma') || (lng >= -105 && lng < -85)) {
      offsetHours = -5;
      tzName = 'CDT (Central Daylight Time)';
    } else if (cityLow.includes('new york') || cityLow.includes('buffalo') || lng >= -85) {
      offsetHours = -4;
      tzName = 'EDT (Eastern Daylight Time)';
    } else {
      offsetHours = -5;
      tzName = 'US Local Time';
    }
  } else {
    // Check known countries
    for (const [key, val] of Object.entries(REGION_TZ_MAP)) {
      if (cLow.includes(key)) {
        offsetHours = val.offset;
        tzName = val.tzName;
        break;
      }
    }
  }

  // Calculate local time at disaster epicenter
  const utcMs = dateObj.getTime();
  const localMs = utcMs + offsetHours * 3600 * 1000;
  const localDate = new Date(localMs);

  const localHours = localDate.getUTCHours();
  const localMins = localDate.getUTCMinutes();
  const localSecs = localDate.getUTCSeconds();

  const pad = (n: number) => n.toString().padStart(2, '0');

  const localTimeFormatted = `${pad(localHours)}:${pad(localMins)}:${pad(localSecs)}`;
  const hours12 = localHours % 12 || 12;
  const ampm = localHours >= 12 ? 'PM' : 'AM';
  const localTime12h = `${pad(hours12)}:${pad(localMins)}:${pad(localSecs)} ${ampm}`;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const localDateFormatted = `${months[localDate.getUTCMonth()]} ${pad(localDate.getUTCDate())}, ${localDate.getUTCFullYear()}`;
  const localDayOfWeek = daysOfWeek[localDate.getUTCDay()];

  // UTC offset string
  const absOffset = Math.abs(offsetHours);
  const offsetH = Math.floor(absOffset);
  const offsetM = Math.round((absOffset - offsetH) * 60);
  const sign = offsetHours >= 0 ? '+' : '-';
  const utcOffsetStr = `UTC${sign}${pad(offsetH)}:${pad(offsetM)}`;

  // Solar day/night status at the occurrence time
  let solarPhase: 'NIGHT' | 'DAYLIGHT' | 'DAWN' | 'DUSK' = 'DAYLIGHT';
  let solarPhaseDescription = 'Daylight Impact (Active Public Mobility)';

  if (localHours >= 22 || localHours < 5) {
    solarPhase = 'NIGHT';
    solarPhaseDescription = 'Nighttime Impact (High Trapping Hazard & Disrupted Response)';
  } else if (localHours >= 5 && localHours < 7) {
    solarPhase = 'DAWN';
    solarPhaseDescription = 'Dawn Twilight (Early Morning Commute Period)';
  } else if (localHours >= 18 && localHours < 22) {
    solarPhase = 'DUSK';
    solarPhaseDescription = 'Dusk / Evening Impact (Rush Hour Transit Vulnerability)';
  }

  // Elapsed calculations
  const diffMs = Math.max(0, Date.now() - utcMs);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let elapsedDurationStr = 'Just now';
  if (diffMin >= 1 && diffMin < 60) {
    elapsedDurationStr = `${diffMin}m ago`;
  } else if (diffHours >= 1 && diffHours < 24) {
    elapsedDurationStr = `${diffHours}h ${diffMin % 60}m ago`;
  } else if (diffDays >= 1) {
    elapsedDurationStr = `${diffDays}d ${diffHours % 24}h ago`;
  }

  // Mission Clock T+ representation
  const missionTPlusHours = pad(diffHours);
  const missionTPlusMins = pad(diffMin % 60);
  const missionTPlusSecs = pad(diffSec % 60);
  const missionClockTPlus = `T+ ${missionTPlusHours}:${missionTPlusMins}:${missionTPlusSecs}`;

  const utcFormatted = dateObj.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  return {
    utcFormatted,
    localDateFormatted,
    localTimeFormatted,
    localTime12h,
    localDayOfWeek,
    timezoneName: tzName,
    utcOffsetHours: offsetHours,
    utcOffsetStr,
    solarPhase,
    solarPhaseDescription,
    elapsedDurationStr,
    missionClockTPlus,
  };
}

export function formatIncidentDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return dateStr;
  }
}

export function formatIncidentUTC(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    return d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return dateStr;
  }
}

export function formatTimeElapsed(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ${diffMin % 60}m ago`;
    return `${diffDays}d ${diffHours % 24}h ago`;
  } catch {
    return '';
  }
}
