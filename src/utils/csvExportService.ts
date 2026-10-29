/**
 * Disaster Frequency Trends CSV Export Utility
 * Exports 30-day temporal analytics, moving averages, projections, and YoY comparisons to CSV
 */

export interface ExportDataPoint {
  dateISO: string;
  dateLabel: string;
  fullDate?: string;
  daysAgo: number;
  isProjection?: boolean;
  total?: number;
  projectedTotal?: number;
  previousYearTotal?: number;
  movingAvgTotal?: number;
  cumulativeTotal?: number;
  earthquake?: number;
  wildfire?: number;
  flood?: number;
  cyclone?: number;
  volcano?: number;
  pandemic?: number;
  severe_storms?: number;
  tsunami?: number;
  matchedEvents?: Array<{ name: string; city: string; country: string; severity: string }>;
}

export interface CSVExportOptions {
  includeProjection?: boolean;
  includeYoY?: boolean;
  timeRangeDays?: number;
}

export function exportDisasterTrendsCSV(
  data: ExportDataPoint[],
  options: CSVExportOptions = {}
): void {
  const headers = [
    'Date_ISO',
    'Date_Label',
    'Full_Date',
    'Record_Type',
    'Days_Offset',
    'Total_Incidents_2026',
    '7Day_Moving_Average',
    'Cumulative_Total',
    'Previous_Year_Same_Period_2025',
    'YoY_Delta',
    'Earthquakes',
    'Wildfires',
    'Floods',
    'Tropical_Cyclones',
    'Volcanoes',
    'Epidemics_Viruses',
    'Severe_Storms',
    'Tsunamis',
    'Active_Catalog_Events_Count',
    'Incident_Names',
  ];

  const escapeCSV = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = data.map(item => {
    const isProj = !!item.isProjection;
    const recordType = isProj ? '7-Day Future Projection (SMA)' : 'Historical Observation';
    const totalCount = isProj ? item.projectedTotal ?? item.total ?? 0 : item.total ?? 0;
    const prevYearCount = item.previousYearTotal ?? 0;
    const yoyDelta = !isProj && prevYearCount > 0 ? (totalCount - prevYearCount) : '';
    
    const matchedNames = item.matchedEvents && item.matchedEvents.length > 0
      ? item.matchedEvents.map(e => `${e.name} (${e.city}, ${e.country})`).join('; ')
      : '';

    return [
      escapeCSV(item.dateISO),
      escapeCSV(item.dateLabel),
      escapeCSV(item.fullDate || item.dateLabel),
      escapeCSV(recordType),
      escapeCSV(item.daysAgo),
      escapeCSV(totalCount),
      escapeCSV(item.movingAvgTotal ?? ''),
      escapeCSV(item.cumulativeTotal ?? ''),
      escapeCSV(prevYearCount || ''),
      escapeCSV(yoyDelta),
      escapeCSV(item.earthquake ?? 0),
      escapeCSV(item.wildfire ?? 0),
      escapeCSV(item.flood ?? 0),
      escapeCSV(item.cyclone ?? 0),
      escapeCSV(item.volcano ?? 0),
      escapeCSV(item.pandemic ?? 0),
      escapeCSV(item.severe_storms ?? 0),
      escapeCSV(item.tsunami ?? 0),
      escapeCSV(item.matchedEvents?.length ?? 0),
      escapeCSV(matchedNames),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const nowStr = new Date().toISOString().split('T')[0];
  const filename = `disaster_frequency_trends_30days_${nowStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
