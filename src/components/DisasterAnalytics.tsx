import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine
} from 'recharts';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { resolveDisasterLocalClock, formatIncidentUTC } from '../utils/dateUtils';
import { exportDisasterTrendsCSV } from '../utils/csvExportService';
import { exportAnalyticsSummaryReportPDF } from '../utils/pdfExportService';
import { QuickInsights } from './QuickInsights';
import { PeriodComparisonView } from './PeriodComparisonView';
import { 
  BarChart3, 
  PieChart as PieIcon, 
  AlertTriangle, 
  Activity, 
  Users, 
  HeartPulse, 
  Radio, 
  Clock, 
  Timer, 
  Compass, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert, 
  ChevronRight,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Eye,
  EyeOff,
  Flame,
  Wind,
  Droplets,
  Biohazard,
  Sparkles,
  Zap,
  Info,
  FileSpreadsheet,
  FileText,
  Download,
  GitCompare,
  Check
} from 'lucide-react';

interface DisasterAnalyticsProps {
  events: CalamityEvent[];
  filteredEvents?: CalamityEvent[];
  liveOnlyFilter?: boolean;
  onToggleLiveOnly?: (val: boolean) => void;
  onSelectEvent: (event: CalamityEvent) => void;
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  CRITICAL: '#f43f5e', // rose-500
  HIGH: '#f59e0b',     // amber-500
  MODERATE: '#3b82f6', // blue-500
  ADVISORY: '#10b981', // emerald-500
};

// Major Disaster Type configurations for the 30-day temporal line chart
export interface MajorDisasterLineConfig {
  key: string;
  label: string;
  color: string;
  matchTypes: CalamityType[];
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description: string;
}

export const MAJOR_DISASTER_LINE_CONFIGS: MajorDisasterLineConfig[] = [
  {
    key: 'earthquake',
    label: 'Earthquakes',
    color: '#f97316', // Orange
    matchTypes: ['earthquake'],
    icon: Activity,
    description: 'Seismic tremors & tectonic ruptures',
  },
  {
    key: 'wildfire',
    label: 'Wildfires',
    color: '#ea580c', // Amber-Orange
    matchTypes: ['wildfire'],
    icon: Flame,
    description: 'Satellite thermal radiative anomalies',
  },
  {
    key: 'flood',
    label: 'Floods',
    color: '#3b82f6', // Blue
    matchTypes: ['flood'],
    icon: Droplets,
    description: 'Hydrographic deluge & basin surges',
  },
  {
    key: 'cyclone',
    label: 'Tropical Cyclones',
    color: '#06b6d4', // Cyan
    matchTypes: ['cyclone'],
    icon: Wind,
    description: 'Tropical storms & hurricane eyewalls',
  },
  {
    key: 'volcano',
    label: 'Volcanic Eruptions',
    color: '#ef4444', // Red
    matchTypes: ['volcano'],
    icon: Zap,
    description: 'Explosive plumes & pyroclastic flows',
  },
  {
    key: 'pandemic',
    label: 'Epidemics & Viruses',
    color: '#a855f7', // Purple
    matchTypes: ['pandemic', 'virus'],
    icon: Biohazard,
    description: 'Biohazard surveillance & pathogen clusters',
  },
  {
    key: 'severe_storms',
    label: 'Severe Storms / Tornadoes',
    color: '#f43f5e', // Rose
    matchTypes: ['tornado', 'blizzard'],
    icon: Wind,
    description: 'Mesocyclones, tornadoes & winter blizzards',
  },
  {
    key: 'tsunami',
    label: 'Tsunamis',
    color: '#14b8a6', // Teal
    matchTypes: ['tsunami'],
    icon: Compass,
    description: 'Oceanic seismic displacement surges',
  },
];

export const DisasterAnalytics: React.FC<DisasterAnalyticsProps> = ({
  events,
  filteredEvents,
  liveOnlyFilter = false,
  onToggleLiveOnly,
  onSelectEvent,
}) => {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [barMetric, setBarMetric] = useState<'count' | 'population'>('count');

  // 30-Day Line Chart State
  const [timeRangeDays, setTimeRangeDays] = useState<30 | 14 | 7>(30);
  const [temporalMetricMode, setTemporalMetricMode] = useState<'daily' | 'movingAvg' | 'cumulative'>('daily');
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);
  
  // Future Projection & YoY Comparative State
  const [showProjection, setShowProjection] = useState<boolean>(true);
  const [showYoYComparison, setShowYoYComparison] = useState<boolean>(false);
  const [showPeriodComparison, setShowPeriodComparison] = useState<boolean>(false);
  const [csvExported, setCsvExported] = useState<boolean>(false);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [pdfGenerated, setPdfGenerated] = useState<boolean>(false);

  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    total: true,
    earthquake: true,
    wildfire: true,
    flood: true,
    cyclone: true,
    volcano: true,
    pandemic: true,
    severe_storms: false,
    tsunami: false,
  });

  // Toggle single line visibility
  const toggleLine = (key: string) => {
    setVisibleLines(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Solo view a line
  const soloLine = (key: string) => {
    setVisibleLines(prev => {
      const next: Record<string, boolean> = { total: false };
      MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
        next[c.key] = c.key === key;
      });
      return next;
    });
  };

  // Show all lines
  const showAllLines = () => {
    const next: Record<string, boolean> = { total: true };
    MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
      next[c.key] = true;
    });
    setVisibleLines(next);
  };

  // Reset lines to primary set
  const resetToPrimaryLines = () => {
    setVisibleLines({
      total: true,
      earthquake: true,
      wildfire: true,
      flood: true,
      cyclone: true,
      volcano: true,
      pandemic: true,
      severe_storms: false,
      tsunami: false,
    });
  };

  // Distribution of Event Types for Pie Chart
  const eventTypeData = useMemo(() => {
    const counts: Record<string, { count: number; events: CalamityEvent[] }> = {};
    
    events.forEach(ev => {
      if (!counts[ev.type]) {
        counts[ev.type] = { count: 0, events: [] };
      }
      counts[ev.type].count += 1;
      counts[ev.type].events.push(ev);
    });

    const total = events.length;

    return Object.entries(counts)
      .map(([typeKey, data]) => {
        const meta = CALAMITY_METADATA_LIST.find(m => m.id === typeKey);
        const percentage = total > 0 ? Number(((data.count / total) * 100).toFixed(1)) : 0;
        return {
          name: meta?.title || typeKey.toUpperCase(),
          type: typeKey as CalamityType,
          count: data.count,
          percentage,
          color: meta?.color || '#a855f7',
          events: data.events,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [events]);

  // Distribution of Severity Levels for Bar Graph
  const severityData = useMemo(() => {
    const severities: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MODERATE', 'ADVISORY'];
    const total = events.length;

    return severities.map(sev => {
      const matchingEvents = events.filter(e => e.severity === sev);
      const totalPop = matchingEvents.reduce((sum, e) => sum + (e.medicalEmergency.affectedPopulation || 0), 0);
      const totalCasualties = matchingEvents.reduce((sum, e) => sum + (e.medicalEmergency.casualtiesEstimated || 0), 0);
      const hospitalAlerts = matchingEvents.filter(e => e.medicalEmergency.isMedicalAlert).length;

      return {
        severity: sev,
        label: `${sev} Alert`,
        count: matchingEvents.length,
        percentage: total > 0 ? Number(((matchingEvents.length / total) * 100).toFixed(1)) : 0,
        populationMillions: Number((totalPop / 1000000).toFixed(2)),
        rawPopulation: totalPop,
        casualties: totalCasualties,
        hospitalAlerts,
        color: SEVERITY_COLORS[sev],
        events: matchingEvents,
      };
    });
  }, [events]);

  // High-level analytics metrics
  const totalExposedPopulation = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.medicalEmergency.affectedPopulation || 0), 0);
  }, [events]);

  const criticalCount = useMemo(() => {
    return events.filter(e => e.severity === 'CRITICAL').length;
  }, [events]);

  const liveFeedsCount = useMemo(() => {
    return events.filter(e => e.isLiveFeed).length;
  }, [events]);

  // --------------------------------------------------------------------------
  // 30-Day Longitudinal Temporal Frequency Computation, Future Projection & YoY
  // --------------------------------------------------------------------------
  const { temporal30DayData, future7DayProjection, todayDateLabel } = useMemo(() => {
    // 1. Determine anchor date (latest occurredAt in dataset, fallback to 2026-10-08)
    let maxTimestamp = 0;
    events.forEach(e => {
      const t = new Date(e.occurredAt || e.updatedAt).getTime();
      if (!isNaN(t) && t > maxTimestamp) {
        maxTimestamp = t;
      }
    });
    const anchor = maxTimestamp > 0 ? new Date(maxTimestamp) : new Date('2026-10-08T12:00:00Z');

    // Deterministic pseudo-random baseline function for civil defense observation record (2026 current year)
    const getBaselineCount = (dayOffset: number, key: string): number => {
      let hash = 0;
      const str = `calamity-temporal-${key}-${dayOffset}`;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const norm = Math.abs(hash % 100) / 100;
      switch (key) {
        case 'earthquake':
          return 2 + Math.floor(norm * 3); // 2 to 4 baseline global seismic triggers
        case 'wildfire':
          return 1 + Math.floor(norm * 3); // 1 to 3 satellite thermal complexes
        case 'flood':
          return 1 + Math.floor(norm * 2); // 1 to 2 hydro deluge alerts
        case 'cyclone':
          return norm > 0.45 ? (norm > 0.85 ? 2 : 1) : 0; // 0 to 2 cyclonic systems
        case 'volcano':
          return norm > 0.55 ? 1 : 0; // 0 to 1 volcanic eruptions
        case 'pandemic':
          return norm > 0.6 ? 1 : 0; // 0 to 1 biohazard surveillance isolations
        case 'severe_storms':
          return norm > 0.65 ? 1 : 0; // 0 to 1 mesocyclone/tornado alerts
        case 'tsunami':
          return norm > 0.9 ? 1 : 0; // 0 to 1 rare tsunami watch
        default:
          return 0;
      }
    };

    // Deterministic baseline for previous year (2025 same period) for long-term comparative trend analysis
    const getPreviousYearBaselineCount = (dayOffset: number, key: string): number => {
      let hash = 0;
      const str = `calamity-yoy-2025-${key}-${dayOffset}`;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const norm = Math.abs(hash % 100) / 100;
      switch (key) {
        case 'earthquake':
          return 1 + Math.floor(norm * 3); // 1 to 3
        case 'wildfire':
          return 1 + Math.floor(norm * 2.2); // 1 to 2
        case 'flood':
          return 1 + Math.floor(norm * 2.5); // 1 to 3
        case 'cyclone':
          return norm > 0.55 ? 1 : 0;
        case 'volcano':
          return norm > 0.65 ? 1 : 0;
        case 'pandemic':
          return norm > 0.75 ? 1 : 0;
        case 'severe_storms':
          return norm > 0.7 ? 1 : 0;
        case 'tsunami':
          return norm > 0.95 ? 1 : 0;
        default:
          return 0;
      }
    };

    // Build raw chronological daily points for past 30 days (d from 29 down to 0)
    const rawDays: any[] = [];
    let detectedTodayLabel = '';

    for (let d = 29; d >= 0; d--) {
      const dayDate = new Date(anchor.getTime() - d * 24 * 60 * 60 * 1000);
      const year = dayDate.getUTCFullYear();
      const month = String(dayDate.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = String(dayDate.getUTCDate()).padStart(2, '0');
      const dateISO = `${year}-${month}-${dayNum}`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateLabel = `${monthNames[dayDate.getUTCMonth()]} ${dayNum}`;
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const fullDate = `${weekdayNames[dayDate.getUTCDay()]}, ${dateLabel}, ${year}`;

      if (d === 0) {
        detectedTodayLabel = dateLabel;
      }

      // Match actual ingested/cataloged events that occurred on this specific calendar date
      const matchedEvents = events.filter(e => {
        const eIso = (e.occurredAt || e.updatedAt || '').split('T')[0];
        return eIso === dateISO;
      });

      const dayObj: any = {
        daysAgo: d,
        dateISO,
        dateLabel,
        fullDate,
        matchedEvents,
        hasActualEvents: matchedEvents.length > 0,
        isProjection: false,
      };

      let dailySum = 0;
      let prevYearDailySum = 0;

      MAJOR_DISASTER_LINE_CONFIGS.forEach(cfg => {
        const actualCount = matchedEvents.filter(e => cfg.matchTypes.includes(e.type)).length;
        const baseline = getBaselineCount(d, cfg.key);
        const count = baseline + actualCount;
        dayObj[cfg.key] = count;
        dailySum += count;

        // Previous year baseline for comparative view
        const pyCount = getPreviousYearBaselineCount(d, cfg.key);
        dayObj[`prevYear_${cfg.key}`] = pyCount;
        prevYearDailySum += pyCount;
      });

      dayObj.total = dailySum;
      dayObj.previousYearTotal = prevYearDailySum;
      dayObj.yoyDelta = dailySum - prevYearDailySum;
      dayObj.yoyDeltaPct = prevYearDailySum > 0 ? Number((((dailySum - prevYearDailySum) / prevYearDailySum) * 100).toFixed(1)) : 0;

      rawDays.push(dayObj);
    }

    // Calculate 7-Day Moving Average and Cumulative Counts
    let cumulativeSum = 0;
    let prevYearCumulativeSum = 0;
    const cumulativeByHazard: Record<string, number> = {};
    MAJOR_DISASTER_LINE_CONFIGS.forEach(c => { cumulativeByHazard[c.key] = 0; });

    const processedDays = rawDays.map((day, idx) => {
      cumulativeSum += day.total;
      prevYearCumulativeSum += day.previousYearTotal;

      MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
        cumulativeByHazard[c.key] += day[c.key];
      });

      // Window for up to 7 previous days
      const windowStart = Math.max(0, idx - 6);
      const windowSlice = rawDays.slice(windowStart, idx + 1);
      const windowLen = windowSlice.length;

      const movingAvgTotal = Number((windowSlice.reduce((s, d) => s + d.total, 0) / windowLen).toFixed(1));
      const movingAvgByHazard: Record<string, number> = {};
      MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
        movingAvgByHazard[c.key] = Number(
          (windowSlice.reduce((s, d) => s + d[c.key], 0) / windowLen).toFixed(1)
        );
      });

      return {
        ...day,
        cumulativeTotal: cumulativeSum,
        prevYearCumulativeTotal: prevYearCumulativeSum,
        cumulative: { ...cumulativeByHazard },
        movingAvgTotal,
        movingAvg: { ...movingAvgByHazard },
        // On Day 0 (today), initialize projectedTotal to seamlessly connect projection curve
        projectedTotal: idx === rawDays.length - 1 ? day.total : null,
      };
    });

    // ------------------------------------------------------------------------
    // 7-Day Future Projection calculation using Simple Moving Average (SMA)
    // ------------------------------------------------------------------------
    const last7DaysSlice = processedDays.slice(processedDays.length - 7);
    const recentSMA7Total = Number((last7DaysSlice.reduce((s, d) => s + d.total, 0) / 7).toFixed(1));
    const recentSMA7ByHazard: Record<string, number> = {};
    MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
      recentSMA7ByHazard[c.key] = Number((last7DaysSlice.reduce((s, d) => s + d[c.key], 0) / 7).toFixed(1));
    });

    const projectionDays: any[] = [];
    for (let f = 1; f <= 7; f++) {
      const futureDate = new Date(anchor.getTime() + f * 24 * 60 * 60 * 1000);
      const year = futureDate.getUTCFullYear();
      const month = String(futureDate.getUTCMonth() + 1).padStart(2, '0');
      const dayNum = String(futureDate.getUTCDate()).padStart(2, '0');
      const dateISO = `${year}-${month}-${dayNum}`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateLabel = `+${f}d ${monthNames[futureDate.getUTCMonth()]} ${dayNum}`;
      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const fullDate = `${weekdayNames[futureDate.getUTCDay()]}, ${monthNames[futureDate.getUTCMonth()]} ${dayNum}, ${year} (7-Day SMA Projection)`;

      // Project expected incident frequency centered on 7-day Simple Moving Average
      // with slight natural temporal damping curve
      const slightVariance = Math.sin(f * 0.8) * 0.3;
      const projectedVal = Number(Math.max(1, recentSMA7Total + slightVariance).toFixed(1));

      const projDay: any = {
        daysAgo: -f,
        dateISO,
        dateLabel,
        fullDate,
        isProjection: true,
        total: null, // No historical total in the future
        projectedTotal: projectedVal,
        movingAvgTotal: projectedVal,
        hasActualEvents: false,
        matchedEvents: [],
        previousYearTotal: null,
      };

      MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
        projDay[c.key] = Number(Math.max(0, recentSMA7ByHazard[c.key] + Math.sin(f + c.key.length) * 0.1).toFixed(1));
      });

      projectionDays.push(projDay);
    }

    return {
      temporal30DayData: processedDays,
      future7DayProjection: projectionDays,
      todayDateLabel: detectedTodayLabel,
    };
  }, [events]);

  // Combined chart data considering time range, metric mode, and 7-day future projection
  const displayedChartData = useMemo(() => {
    const historicalSubset = temporal30DayData.slice(temporal30DayData.length - timeRangeDays);

    const mappedHistorical = historicalSubset.map(day => {
      const item: any = {
        daysAgo: day.daysAgo,
        dateISO: day.dateISO,
        dateLabel: day.dateLabel,
        fullDate: day.fullDate,
        matchedEvents: day.matchedEvents,
        hasActualEvents: day.hasActualEvents,
        isProjection: false,
        projectedTotal: day.projectedTotal, // null except on Day 0 anchor
        previousYearTotal: day.previousYearTotal,
        yoyDelta: day.yoyDelta,
        yoyDeltaPct: day.yoyDeltaPct,
      };

      if (temporalMetricMode === 'daily') {
        item.total = day.total;
        MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
          item[c.key] = day[c.key];
        });
      } else if (temporalMetricMode === 'movingAvg') {
        item.total = day.movingAvgTotal;
        MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
          item[c.key] = day.movingAvg[c.key];
        });
      } else {
        // cumulative
        item.total = day.cumulativeTotal;
        item.previousYearTotal = day.prevYearCumulativeTotal;
        MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
          item[c.key] = day.cumulative[c.key];
        });
      }

      return item;
    });

    if (!showProjection) {
      return mappedHistorical;
    }

    // Append 7-Day Future Projection
    return [...mappedHistorical, ...future7DayProjection];
  }, [temporal30DayData, future7DayProjection, timeRangeDays, temporalMetricMode, showProjection]);

  // 30-Day Temporal KPI Highlights & Comparative Year-over-Year Analysis
  const temporalKPIs = useMemo(() => {
    const fullMonthData = temporal30DayData;
    const total30Day = fullMonthData.reduce((sum, d) => sum + d.total, 0);
    const avgPerDay = (total30Day / fullMonthData.length).toFixed(1);

    // Peak Frequency Day
    let peakDay = fullMonthData[0];
    fullMonthData.forEach(d => {
      if (d.total > peakDay.total) peakDay = d;
    });

    // Primary Hazard Type by 30-day cumulative volume
    const hazardTotals: Record<string, number> = {};
    const prevYearHazardTotals: Record<string, number> = {};
    MAJOR_DISASTER_LINE_CONFIGS.forEach(c => { 
      hazardTotals[c.key] = 0; 
      prevYearHazardTotals[c.key] = 0;
    });

    fullMonthData.forEach(d => {
      MAJOR_DISASTER_LINE_CONFIGS.forEach(c => {
        hazardTotals[c.key] += (d[c.key] || 0);
        prevYearHazardTotals[c.key] += (d[`prevYear_${c.key}`] || 0);
      });
    });

    let primaryKey = MAJOR_DISASTER_LINE_CONFIGS[0].key;
    let maxHazardCount = 0;
    Object.entries(hazardTotals).forEach(([k, count]) => {
      if (count > maxHazardCount) {
        maxHazardCount = count;
        primaryKey = k;
      }
    });
    const primaryConfig = MAJOR_DISASTER_LINE_CONFIGS.find(c => c.key === primaryKey);
    const primaryShare = total30Day > 0 ? ((maxHazardCount / total30Day) * 100).toFixed(1) : '0';

    // Velocity / Trend comparison: first 15 days vs last 15 days
    const firstHalf = fullMonthData.slice(0, 15).reduce((s, d) => s + d.total, 0);
    const secondHalf = fullMonthData.slice(15).reduce((s, d) => s + d.total, 0);
    const velocityChangePct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;

    // Year-over-Year Comparative Metrics (2026 vs 2025 Baseline)
    const totalPreviousYear = fullMonthData.reduce((sum, d) => sum + d.previousYearTotal, 0);
    const yoyNetDelta = total30Day - totalPreviousYear;
    const yoyNetDeltaPct = totalPreviousYear > 0 ? Number(((yoyNetDelta / totalPreviousYear) * 100).toFixed(1)) : 0;
    const isYoYSurging = yoyNetDeltaPct > 0;

    // 7-Day SMA Projection Summary
    const recent7Days = fullMonthData.slice(fullMonthData.length - 7);
    const projectionSMA7Rate = Number((recent7Days.reduce((s, d) => s + d.total, 0) / 7).toFixed(1));
    const projected7DayTotal = Math.round(projectionSMA7Rate * 7);

    return {
      total30Day,
      avgPerDay,
      peakDay,
      primaryConfig,
      primaryCount: maxHazardCount,
      primaryShare,
      velocityChangePct,
      isAccelerating: velocityChangePct > 0,
      firstHalf,
      secondHalf,
      hazardTotals,
      prevYearHazardTotals,
      // YoY Comparative Metrics
      totalPreviousYear,
      yoyNetDelta,
      yoyNetDeltaPct,
      isYoYSurging,
      // 7-Day Projection Metrics
      projectionSMA7Rate,
      projected7DayTotal,
    };
  }, [temporal30DayData]);

  // Selected Day Drill-down details
  const selectedDayData = useMemo(() => {
    if (!selectedDayISO) return null;
    return temporal30DayData.find(d => d.dateISO === selectedDayISO) || null;
  }, [temporal30DayData, selectedDayISO]);

  // Dataset scope toggle: 'filtered' (default when parent filters exist) vs 'all'
  const [scopeSelection, setScopeSelection] = useState<'filtered' | 'all'>('filtered');
  const hasParentFilter = Boolean(filteredEvents && filteredEvents.length > 0 && filteredEvents.length < events.length);

  // Filtered event list based on interactive chart selection and parent filters
  const highlightedEvents = useMemo(() => {
    const baseList = (scopeSelection === 'filtered' && hasParentFilter && filteredEvents) 
      ? filteredEvents 
      : events;
    let result = baseList;
    if (selectedTypeFilter) {
      result = result.filter(e => {
        const meta = CALAMITY_METADATA_LIST.find(m => m.id === e.type);
        return (meta?.title || e.type.toUpperCase()) === selectedTypeFilter;
      });
    }
    if (selectedSeverityFilter) {
      result = result.filter(e => e.severity === selectedSeverityFilter);
    }
    if (selectedDayISO) {
      result = result.filter(e => {
        const eIso = (e.occurredAt || e.updatedAt || '').split('T')[0];
        return eIso === selectedDayISO;
      });
    }
    return result;
  }, [events, filteredEvents, hasParentFilter, scopeSelection, selectedTypeFilter, selectedSeverityFilter, selectedDayISO]);

  const activeFiltersInfo = useMemo(() => {
    let customLabel: string | null = null;
    if (scopeSelection === 'filtered' && hasParentFilter && filteredEvents) {
      customLabel = `Dashboard Filtered (${filteredEvents.length} events)`;
    } else if (liveOnlyFilter) {
      customLabel = 'Live Feeds Only';
    }
    return {
      type: selectedTypeFilter,
      severity: selectedSeverityFilter,
      date: selectedDayISO,
      customLabel,
    };
  }, [scopeSelection, hasParentFilter, filteredEvents, liveOnlyFilter, selectedTypeFilter, selectedSeverityFilter, selectedDayISO]);

  // Handler for CSV Export
  const handleExportCSV = () => {
    try {
      const exportable = showProjection
        ? [...temporal30DayData, ...future7DayProjection]
        : temporal30DayData;

      exportDisasterTrendsCSV(exportable, {
        includeProjection: showProjection,
        includeYoY: showYoYComparison,
        timeRangeDays,
      });

      setCsvExported(true);
      setTimeout(() => setCsvExported(false), 3000);
    } catch (e) {
      console.error('Failed to export disaster trends CSV:', e);
    }
  };

  // Handler for Generating Comprehensive PDF Summary Report
  const handleGenerateSummaryPDF = () => {
    try {
      setPdfGenerating(true);
      // Small timeout to allow UI feedback state to paint before PDF computation
      setTimeout(() => {
        try {
          exportAnalyticsSummaryReportPDF({
            events,
            liveOnlyFilter,
            timeRangeDays,
            temporal30DayData,
            future7DayProjection,
            movingAverageWindow: 7,
            showYoYComparison,
            showProjection,
          });
          setPdfGenerated(true);
          setTimeout(() => setPdfGenerated(false), 3500);
        } catch (err) {
          console.error('Failed to generate summary PDF report:', err);
        } finally {
          setPdfGenerating(false);
        }
      }, 80);
    } catch (e) {
      console.error('Error initiating PDF summary report generation:', e);
      setPdfGenerating(false);
    }
  };

  // Custom Tooltip for Event Types Pie Chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center gap-2 font-bold text-slate-100 pb-1.5 border-b border-slate-800">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.name}</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>Incident Count:</span>
              <strong className="text-amber-400 font-bold">{data.count} event{data.count > 1 ? 's' : ''}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Catalog Proportion:</span>
              <strong className="text-cyan-400">{data.percentage}%</strong>
            </div>
            <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-800">
              Locations: {data.events.slice(0, 3).map((e: CalamityEvent) => e.city).join(', ')}
              {data.events.length > 3 ? ` +${data.events.length - 3} more` : ''}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Severity Bar Graph
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl text-xs backdrop-blur-md max-w-xs z-50">
          <div className="flex items-center gap-2 font-bold text-slate-100 pb-1.5 border-b border-slate-800">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.severity} Severity Calamities</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>Total Calamities:</span>
              <strong className="text-amber-400 font-bold">{data.count}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Share of Calamities:</span>
              <strong className="text-cyan-400">{data.percentage}%</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Population Impacted:</span>
              <strong className="text-rose-400">{data.populationMillions} Million</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Medical Emergency Alerts:</span>
              <strong className="text-emerald-400">{data.hospitalAlerts}</strong>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for 30-Day Line Chart with Projections and YoY comparison
  const CustomLineTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isProj = !!data.isProjection;

      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs backdrop-blur-md max-w-sm z-50">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="font-bold text-slate-100 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>{data.fullDate || data.dateLabel}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {isProj
                  ? '7-Day Future Projection (SMA Forecast Horizon)'
                  : temporalMetricMode === 'daily'
                  ? 'Daily Frequency Record'
                  : temporalMetricMode === 'movingAvg'
                  ? '7-Day Moving Average'
                  : 'Cumulative Recorded Volume'}
              </div>
            </div>
            
            {isProj ? (
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold text-[11px] border border-sky-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" />
                ~{data.projectedTotal} Proj
              </span>
            ) : data.total !== undefined && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[11px] border border-amber-500/30">
                {data.total} {temporalMetricMode === 'cumulative' ? 'Cumulative' : 'Incidents'}
              </span>
            )}
          </div>

          {/* YoY comparison info on tooltip */}
          {showYoYComparison && !isProj && data.previousYearTotal !== undefined && (
            <div className="my-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 flex items-center gap-1">
                <GitCompare className="w-3 h-3 text-slate-400" />
                2025 Same Period Baseline:
              </span>
              <div className="flex items-center gap-2">
                <strong className="text-slate-300">{data.previousYearTotal} events</strong>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  data.yoyDelta > 0
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {data.yoyDelta > 0 ? `+${data.yoyDelta}` : data.yoyDelta} ({data.yoyDeltaPct}%)
                </span>
              </div>
            </div>
          )}

          {/* Lines breakdown */}
          <div className="mt-2.5 space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {payload.map((entry: any) => {
              if (entry.dataKey === 'total' && !visibleLines.total) return null;
              if (entry.dataKey === 'projectedTotal' && !showProjection) return null;
              if (entry.dataKey === 'previousYearTotal' && !showYoYComparison) return null;

              return (
                <div key={entry.dataKey} className="flex items-center justify-between font-mono text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate max-w-[140px]">{entry.name}:</span>
                  </span>
                  <strong className="text-slate-100 font-bold ml-2">{entry.value}</strong>
                </div>
              );
            })}
          </div>

          {/* Matched active incidents on this date */}
          {!isProj && data.matchedEvents && data.matchedEvents.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px]">
              <div className="text-amber-400 font-semibold mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>{data.matchedEvents.length} Active Catalog Calamity Incident{data.matchedEvents.length > 1 ? 's' : ''}:</span>
              </div>
              <div className="space-y-0.5 text-slate-300">
                {data.matchedEvents.slice(0, 3).map((e: CalamityEvent) => (
                  <div key={e.id} className="truncate text-slate-300">
                    • <strong className="text-slate-100">{e.name}</strong> ({e.city}, {e.country})
                  </div>
                ))}
                {data.matchedEvents.length > 3 && (
                  <div className="text-slate-400 text-[9px]">+{data.matchedEvents.length - 3} more incidents</div>
                )}
              </div>
            </div>
          )}

          {isProj ? (
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-sky-400 font-mono">
              7-Day SMA Projection: Anticipates incident frequency based on 7-day rolling momentum.
            </div>
          ) : (
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 text-center font-sans">
              Click data point to isolate date in incident inspector
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* QUICK INSIGHTS COMPONENT (TOP OF ANALYTICS PANEL)                        */}
      {/* Displays Total Lives Impacted, Most Frequent Hazard, Average Severity    */}
      {/* Score strictly based on the active filtered dataset                     */}
      {/* ========================================================================= */}
      <QuickInsights
        filteredEvents={highlightedEvents}
        totalEvents={events}
        activeFilters={activeFiltersInfo}
        onClearFilters={() => {
          setSelectedTypeFilter(null);
          setSelectedSeverityFilter(null);
          setSelectedDayISO(null);
          setScopeSelection('all');
        }}
        onSelectHazardType={(type) => {
          setSelectedTypeFilter(prev => prev === type ? null : type);
        }}
        onSelectSeverity={(sev) => {
          setSelectedSeverityFilter(prev => prev === sev ? null : sev);
        }}
        onToggleComparePeriod={() => {
          setShowPeriodComparison(prev => !prev);
        }}
        isComparePeriodOpen={showPeriodComparison}
      />

      {/* ========================================================================= */}
      {/* PERIOD COMPARISON VIEW (DUAL CHARTS FOR SELECTED TIME WINDOWS)             */}
      {/* Allows users to toggle and visualize impact changes side-by-side          */}
      {/* ========================================================================= */}
      {showPeriodComparison && (
        <PeriodComparisonView
          events={events}
          filteredEvents={highlightedEvents}
          onClose={() => setShowPeriodComparison(false)}
          onSelectEvent={onSelectEvent}
        />
      )}

      {/* Top Banner & Analytical Overview Cards */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>CIVIL DEFENSE EPIDEMIOLOGICAL & GEOPHYSICAL METRICS</span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 mt-1 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-amber-400" />
              Disaster Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Real-time statistical synthesis of active natural disasters and epidemic outbreaks. Visualizing categorical frequency distributions, 7-day Simple Moving Average future projections, Year-over-Year baseline comparative overlays, and CSV export.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Scope Selection: Filtered vs All Catalog (if parent filter is active) */}
            {hasParentFilter && (
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-xs shadow-inner">
                <button
                  type="button"
                  onClick={() => setScopeSelection('filtered')}
                  className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    scopeSelection === 'filtered'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Analyze active filtered dataset from search and quick buttons"
                >
                  Filtered Scope ({filteredEvents?.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScopeSelection('all')}
                  className={`px-2.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                    scopeSelection === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Analyze entire global catalog"
                >
                  All Catalog ({events.length})
                </button>
              </div>
            )}

            {/* Live Data Only Toggle */}
            {onToggleLiveOnly && (
              <button
                onClick={() => onToggleLiveOnly(!liveOnlyFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  liveOnlyFilter
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title="Toggle between real-time live sensor data and full baseline catalog"
              >
                <Radio className={`w-3.5 h-3.5 ${liveOnlyFilter ? 'animate-pulse text-white' : 'text-slate-400'}`} />
                <span>{liveOnlyFilter ? 'Live Stream Only' : 'All Hazards Catalog'}</span>
              </button>
            )}

            {/* Toggle 'Compare with previous period' Dual Charts View */}
            <button
              onClick={() => setShowPeriodComparison(prev => !prev)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                showPeriodComparison
                  ? 'bg-purple-600 text-white border-purple-400 shadow-purple-950/60 ring-2 ring-purple-400/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border-purple-500/40 hover:border-purple-400'
              }`}
              title="Toggle 'Compare with previous period' dual charts view showing side-by-side time window analytics"
            >
              <GitCompare className={`w-3.5 h-3.5 ${showPeriodComparison ? 'text-white' : 'text-purple-400'}`} />
              <span>{showPeriodComparison ? 'Hide Period Comparison' : 'Compare with previous period'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-200 border border-purple-500/40">
                Dual Charts
              </span>
            </button>

            {/* Generate Summary Report Button */}
            <button
              onClick={handleGenerateSummaryPDF}
              disabled={pdfGenerating}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                pdfGenerated
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/40'
                  : pdfGenerating
                  ? 'bg-rose-900/60 text-rose-200 border-rose-700/80 cursor-wait'
                  : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border-rose-500/80 shadow-rose-950/40'
              }`}
              title="Export formatted diagnostic summary of current global calamity trends and critical stats as a PDF report"
            >
              {pdfGenerating ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : pdfGenerated ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-white" />
              )}
              <span>
                {pdfGenerating
                  ? 'Generating PDF...'
                  : pdfGenerated
                  ? 'Report Generated!'
                  : 'Generate Summary Report'}
              </span>
            </button>

            {/* Export Trends CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 hover:border-emerald-500/60 flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Export 30-day frequency trends and forecasts as CSV"
            >
              {csvExported ? <Check className="w-3.5 h-3.5 text-white" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>{csvExported ? 'CSV Exported!' : 'Export Trends CSV'}</span>
            </button>

            {(selectedTypeFilter || selectedSeverityFilter || selectedDayISO || (hasParentFilter && scopeSelection === 'filtered')) && (
              <button
                onClick={() => {
                  setSelectedTypeFilter(null);
                  setSelectedSeverityFilter(null);
                  setSelectedDayISO(null);
                  setScopeSelection('all');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset active analytical filters"
              >
                <Filter className="w-3.5 h-3.5" />
                Reset Active Filters
              </button>
            )}
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Active Calamities</div>
            <div className="text-2xl font-black text-slate-100 mt-1 font-mono">{highlightedEvents.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              {highlightedEvents.length < events.length ? `Filtered (${highlightedEvents.length} of ${events.length})` : 'Across 14 hazard classes'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30">
            <div className="text-[11px] text-rose-300 uppercase tracking-wider font-semibold">Critical Calamities</div>
            <div className="text-2xl font-black text-rose-400 mt-1 font-mono">
              {highlightedEvents.filter(e => e.severity === 'CRITICAL').length}
            </div>
            <div className="text-[10px] text-rose-300/80 mt-0.5">
              {highlightedEvents.length > 0 ? ((highlightedEvents.filter(e => e.severity === 'CRITICAL').length / highlightedEvents.length) * 100).toFixed(0) : 0}% of active selection
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30">
            <div className="text-[11px] text-amber-300 uppercase tracking-wider font-semibold">Exposed Population</div>
            <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
              {(highlightedEvents.reduce((sum, e) => sum + (e.medicalEmergency?.affectedPopulation || 0), 0) / 1000000).toFixed(1)}M
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Citizens in active impact radii
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 uppercase tracking-wider font-semibold">Live Ingestion Feeds</div>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
              {highlightedEvents.filter(e => e.isLiveFeed).length}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              USGS & NASA satellite streams
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Event Types Distribution (Pie Chart) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    Distribution of Event Types
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Proportion of active hazards grouped by disaster taxonomy
                  </p>
                </div>
              </div>

              {selectedTypeFilter && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Filtering: {selectedTypeFilter}
                </span>
              )}
            </div>

            {/* Recharts Pie Chart */}
            <div className="h-80 w-full mt-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={eventTypeData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={3}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const entryName = entry?.name as string | undefined;
                      if (!entryName || selectedTypeFilter === entryName) {
                        setSelectedTypeFilter(null);
                      } else {
                        setSelectedTypeFilter(entryName);
                      }
                    }}
                  >
                    {eventTypeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={selectedTypeFilter === entry.name ? '#ffffff' : '#0f172a'}
                        strokeWidth={selectedTypeFilter === entry.name ? 3 : 1.5}
                        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black font-mono text-slate-100">
                  {eventTypeData.length}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Categories
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Legend / Pill Grid */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="text-[11px] text-slate-400 font-semibold mb-2 flex items-center justify-between">
              <span>Click a category to isolate incidents:</span>
              <span className="text-[10px] text-slate-500 font-mono">Total {events.length} Events</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {eventTypeData.map((item) => {
                const isSelected = selectedTypeFilter === item.name;
                return (
                  <button
                    key={item.type}
                    onClick={() => setSelectedTypeFilter(isSelected ? null : item.name)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400 shadow-sm'
                        : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate max-w-[120px]">{item.name}</span>
                    <span className="font-mono text-[10px] opacity-75 font-bold">({item.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CHART 2: Severity Levels Distribution (Bar Graph) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-rose-400" />
                <div>
                  <h2 className="text-base font-bold text-slate-100">
                    Distribution of Severity Levels
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Disaster classification across Critical, High, Moderate, and Advisory tiers
                  </p>
                </div>
              </div>

              {/* Bar Metric View Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
                <button
                  onClick={() => setBarMetric('count')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    barMetric === 'count'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Event Count
                </button>
                <button
                  onClick={() => setBarMetric('population')}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    barMetric === 'population'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Exposed Pop (M)
                </button>
              </div>
            </div>

            {/* Recharts Bar Graph */}
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={severityData}
                  margin={{ top: 20, right: 15, left: -10, bottom: 10 }}
                  onClick={(state: any) => {
                    const payload = state?.activePayload;
                    if (payload && payload.length) {
                      const sev = payload[0]?.payload?.severity;
                      if (sev && selectedSeverityFilter === sev) {
                        setSelectedSeverityFilter(null);
                      } else if (sev) {
                        setSelectedSeverityFilter(sev);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="severity" 
                    stroke="#64748b" 
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar
                    dataKey={barMetric === 'count' ? 'count' : 'populationMillions'}
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                  >
                    {severityData.map((entry, index) => (
                      <Cell
                        key={`bar-${index}`}
                        fill={entry.color}
                        stroke={selectedSeverityFilter === entry.severity ? '#ffffff' : 'transparent'}
                        strokeWidth={selectedSeverityFilter === entry.severity ? 2 : 0}
                        className="transition-all duration-300 hover:opacity-85"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Severity Breakdown Legend & Cards */}
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {severityData.map((sev) => {
                const isSelected = selectedSeverityFilter === sev.severity;
                return (
                  <button
                    key={sev.severity}
                    onClick={() => setSelectedSeverityFilter(isSelected ? null : sev.severity)}
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-white shadow-md'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: sev.color }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sev.color }} />
                      <span>{sev.severity}</span>
                    </div>
                    <div className="mt-1 font-mono text-base font-black text-slate-100">
                      {sev.count} <span className="text-[10px] font-normal text-slate-400">({sev.percentage}%)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {sev.populationMillions}M citizens
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CHART 3: 30-Day Temporal Frequency, 7-Day SMA Projection & YoY Comparison */}
      {/* ---------------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 flex-wrap">
                  <span>Major Disaster Frequency Over Last 30 Days</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Temporal Context
                  </span>
                  {showProjection && (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-sky-400" />
                      7-Day SMA Projection
                    </span>
                  )}
                  {showYoYComparison && (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                      <GitCompare className="w-3 h-3 text-purple-400" />
                      YoY 2025 vs 2026
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Longitudinal line chart tracking daily incident frequencies across major calamity categories, 7-day future projections via Simple Moving Average (SMA), and Year-over-Year comparative overlays.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Controls Toolbar: Window, Modes, Projection, YoY, CSV */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 7-Day Future Projection Toggle */}
            <button
              onClick={() => setShowProjection(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                showProjection
                  ? 'bg-sky-500/20 text-sky-200 border-sky-400 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title="Toggle 7-day Simple Moving Average future projection line"
            >
              <Sparkles className={`w-3.5 h-3.5 ${showProjection ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
              <span>7-Day SMA Projection</span>
            </button>

            {/* YoY Comparative Analysis Toggle */}
            <button
              onClick={() => setShowYoYComparison(prev => !prev)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                showYoYComparison
                  ? 'bg-purple-500/20 text-purple-200 border-purple-400 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title="Overlay previous year baseline data (2025 same period) for long-term trend analysis"
            >
              <GitCompare className={`w-3.5 h-3.5 ${showYoYComparison ? 'text-purple-400' : 'text-slate-500'}`} />
              <span>YoY Overlay (2025 vs 2026)</span>
            </button>

            {/* Compare with Previous Period Dual Charts Toggle */}
            <button
              onClick={() => {
                setShowPeriodComparison(prev => !prev);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                showPeriodComparison
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-slate-950 text-purple-300 border-purple-500/40 hover:text-white hover:border-purple-400'
              }`}
              title="Toggle dual charts view comparing current operational period with previous cycle"
            >
              <GitCompare className={`w-3.5 h-3.5 ${showPeriodComparison ? 'text-white' : 'text-purple-400'}`} />
              <span>{showPeriodComparison ? 'Hide Dual Charts' : 'Dual Charts Compare'}</span>
            </button>

            {/* Generate Summary PDF Button in Chart Toolbar */}
            <button
              onClick={handleGenerateSummaryPDF}
              disabled={pdfGenerating}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-950 hover:bg-slate-850 text-rose-400 border border-slate-800 hover:border-rose-500/50 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Generate and download formatted diagnostic summary PDF report"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              <span>{pdfGenerated ? 'PDF Exported!' : 'Summary PDF'}</span>
            </button>

            {/* Export Trends CSV Button */}
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-950 hover:bg-slate-850 text-emerald-400 border border-slate-800 hover:border-emerald-500/50 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Download 30-day temporal trends and projections as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{csvExported ? 'CSV Exported!' : 'Export CSV'}</span>
            </button>

            {/* Timeframe Selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <span className="text-[10px] text-slate-500 uppercase font-mono px-2 font-semibold">Window:</span>
              <button
                onClick={() => setTimeRangeDays(7)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  timeRangeDays === 7
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setTimeRangeDays(14)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  timeRangeDays === 14
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                14d
              </button>
              <button
                onClick={() => setTimeRangeDays(30)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  timeRangeDays === 30
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                30d
              </button>
            </div>

            {/* Metric Mode Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setTemporalMetricMode('daily')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  temporalMetricMode === 'daily'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setTemporalMetricMode('movingAvg')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  temporalMetricMode === 'movingAvg'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7d SMA
              </button>
              <button
                onClick={() => setTemporalMetricMode('cumulative')}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  temporalMetricMode === 'cumulative'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cumulative
              </button>
            </div>
          </div>
        </div>

        {/* 4 Mini Temporal KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>30-Day Incident Volume</span>
              <Activity className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-100 mt-1 font-mono">
              {temporalKPIs.total30Day} <span className="text-xs text-slate-400 font-normal">events</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Avg <strong className="text-amber-400 font-mono">{temporalKPIs.avgPerDay}</strong> incidents / day
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30">
            <div className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Peak Hazard Surge</span>
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-400 mt-1 font-mono">
              {temporalKPIs.peakDay.dateLabel}
            </div>
            <div className="text-[10px] text-amber-300/80 mt-0.5">
              <strong className="text-white font-mono">{temporalKPIs.peakDay.total}</strong> incidents recorded
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>Dominant Hazard Vector</span>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: temporalKPIs.primaryConfig?.color }} />
            </div>
            <div className="text-xl font-black text-slate-100 mt-1 truncate">
              {temporalKPIs.primaryConfig?.label || 'Earthquakes'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              <strong className="text-cyan-400 font-mono">{temporalKPIs.primaryShare}%</strong> of 30-day frequency ({temporalKPIs.primaryCount} events)
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center justify-between">
              <span>7-Day SMA Projection Rate</span>
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-black text-sky-400 mt-1 font-mono">
              ~{temporalKPIs.projectionSMA7Rate} <span className="text-xs text-slate-400 font-normal">/ day</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              Expected <strong className="text-sky-300 font-mono">~{temporalKPIs.projected7DayTotal}</strong> incidents in next 7d
            </div>
          </div>
        </div>

        {/* YEAR-OVER-YEAR COMPARATIVE ANALYSIS PANEL (Shown when YoY comparison is active) */}
        {showYoYComparison && (
          <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/40 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Comparative Analysis View: 2026 Crisis Frequency vs. 2025 Historical Baseline
                </h3>
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                  temporalKPIs.isYoYSurging
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {temporalKPIs.isYoYSurging ? `+${temporalKPIs.yoyNetDeltaPct}% YoY Surge` : `${temporalKPIs.yoyNetDeltaPct}% YoY Variance`}
                </span>
              </div>

              <div className="text-xs font-mono text-slate-400">
                2026: <strong className="text-white font-bold">{temporalKPIs.total30Day}</strong> vs 2025: <strong className="text-slate-300">{temporalKPIs.totalPreviousYear}</strong> total incidents
              </div>
            </div>

            {/* Comparative Breakdown Table across Hazard Classes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {MAJOR_DISASTER_LINE_CONFIGS.map(cfg => {
                const count2026 = temporalKPIs.hazardTotals[cfg.key] || 0;
                const count2025 = temporalKPIs.prevYearHazardTotals[cfg.key] || 0;
                const delta = count2026 - count2025;
                const deltaPct = count2025 > 0 ? Math.round((delta / count2025) * 100) : 0;

                return (
                  <div
                    key={cfg.key}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between"
                  >
                    <span className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                    <div className="mt-1 flex items-baseline justify-between font-mono">
                      <span className="font-bold text-slate-100 text-sm">{count2026}</span>
                      <span className="text-[10px] text-slate-500">v {count2025}</span>
                    </div>
                    <div className={`text-[10px] font-bold font-mono mt-0.5 ${
                      delta > 0 ? 'text-rose-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {delta > 0 ? `+${deltaPct}%` : delta < 0 ? `${deltaPct}%` : '0%'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hazard Line Visibility Toggles */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-850">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Visible Disaster Type Traces (Click to Toggle / Double-click to Solo):</span>
            </div>

            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={showAllLines}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Enable All
              </button>
              <button
                onClick={resetToPrimaryLines}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Reset Primary (6)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {/* Total Aggregate Trace */}
            <button
              onClick={() => toggleLine('total')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                visibleLines.total
                  ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                  : 'bg-slate-950/80 text-slate-500 border-slate-900 opacity-60'
              }`}
            >
              <span className="w-3 h-0.5 bg-slate-200 border-b border-dashed border-slate-400" />
              <span>Total All Hazards</span>
              {visibleLines.total ? (
                <Eye className="w-3 h-3 text-slate-300 ml-0.5" />
              ) : (
                <EyeOff className="w-3 h-3 text-slate-600 ml-0.5" />
              )}
            </button>

            {/* 7-Day SMA Projection Trace pill indicator */}
            {showProjection && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-sky-950/50 text-sky-300 border border-sky-500/50">
                <span className="w-3 h-0.5 bg-sky-400 border-b border-dashed border-sky-300" />
                <span>7-Day SMA Projection</span>
                <Sparkles className="w-3 h-3 text-sky-400" />
              </span>
            )}

            {/* Previous Year Baseline pill indicator */}
            {showYoYComparison && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-950/50 text-purple-300 border border-purple-500/50">
                <span className="w-3 h-0.5 bg-purple-400 border-b border-dashed border-purple-300" />
                <span>2025 Baseline Overlay</span>
                <GitCompare className="w-3 h-3 text-purple-400" />
              </span>
            )}

            {/* Individual Hazard Traces */}
            {MAJOR_DISASTER_LINE_CONFIGS.map(cfg => {
              const isVisible = !!visibleLines[cfg.key];
              const total30d = temporalKPIs.hazardTotals[cfg.key] || 0;
              return (
                <button
                  key={cfg.key}
                  onClick={() => toggleLine(cfg.key)}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    soloLine(cfg.key);
                  }}
                  title={`Double click to isolate ${cfg.label}`}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                    isVisible
                      ? 'bg-slate-900 text-slate-100 shadow-sm'
                      : 'bg-slate-950/80 text-slate-500 border-slate-900 opacity-50'
                  }`}
                  style={{
                    borderColor: isVisible ? `${cfg.color}70` : undefined,
                    backgroundColor: isVisible ? `${cfg.color}15` : undefined,
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                  <span>{cfg.label}</span>
                  <span className="font-mono text-[10px] opacity-75 font-bold">({total30d})</span>
                  {isVisible ? (
                    <Eye className="w-3 h-3 ml-0.5" style={{ color: cfg.color }} />
                  ) : (
                    <EyeOff className="w-3 h-3 text-slate-600 ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recharts Line Chart */}
        <div className="h-96 w-full pt-2 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={displayedChartData}
              margin={{ top: 15, right: 25, left: -10, bottom: 15 }}
              onClick={(state: any) => {
                const activePayload = state?.activePayload;
                if (activePayload && activePayload.length) {
                  const clickedISO = activePayload[0]?.payload?.dateISO;
                  if (clickedISO) {
                    setSelectedDayISO(prev => prev === clickedISO ? null : clickedISO);
                  }
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              
              <XAxis
                dataKey="dateLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                interval={timeRangeDays === 30 ? (showProjection ? 3 : 2) : timeRangeDays === 14 ? 1 : 0}
              />
              
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                allowDecimals={temporalMetricMode === 'movingAvg' || showProjection}
              />
              
              <Tooltip content={<CustomLineTooltip />} />
              
              <Legend
                wrapperStyle={{ paddingTop: '14px', fontSize: '11px' }}
                iconType="circle"
              />

              {/* Reference indicator for selected day if any */}
              {selectedDayISO && (
                <ReferenceLine
                  x={selectedDayData?.dateLabel}
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{
                    value: `Selected: ${selectedDayData?.dateLabel}`,
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
              )}

              {/* Demarcation marker between historical observations and 7-Day Future Projection */}
              {showProjection && todayDateLabel && (
                <ReferenceLine
                  x={todayDateLabel}
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{
                    value: 'TODAY • FORECAST HORIZON',
                    fill: '#38bdf8',
                    fontSize: 9,
                    position: 'top',
                  }}
                />
              )}

              {/* Total Calamity Volume Aggregate Line */}
              {visibleLines.total && (
                <Line
                  type="monotone"
                  dataKey="total"
                  name="All Hazards Total (2026)"
                  stroke="#cbd5e1"
                  strokeWidth={2.5}
                  strokeDasharray="4 3"
                  dot={{ r: 2.5, fill: '#cbd5e1' }}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls={false}
                />
              )}

              {/* 7-DAY FUTURE PROJECTION LINE (SMA) */}
              {showProjection && (
                <Line
                  type="monotone"
                  dataKey="projectedTotal"
                  name="7-Day Future Projection (SMA)"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3, fill: '#38bdf8' }}
                  activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
                  connectNulls={false}
                />
              )}

              {/* PREVIOUS YEAR (2025) COMPARATIVE BASELINE OVERLAY */}
              {showYoYComparison && (
                <Line
                  type="monotone"
                  dataKey="previousYearTotal"
                  name="Previous Year Baseline (2025 Same Period)"
                  stroke="#c084fc"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 2, fill: '#c084fc' }}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                />
              )}

              {/* Individual Major Disaster Category Lines */}
              {MAJOR_DISASTER_LINE_CONFIGS.map(cfg => {
                if (!visibleLines[cfg.key]) return null;
                return (
                  <Line
                    key={cfg.key}
                    type="monotone"
                    dataKey={cfg.key}
                    name={cfg.label}
                    stroke={cfg.color}
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: cfg.color }}
                    activeDot={{ r: 5.5, stroke: '#ffffff', strokeWidth: 2 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Selected Date Drill-down Inspector Banner */}
        {selectedDayData && (
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-slate-100 text-sm">
                  Temporal Drill-down: {selectedDayData.fullDate}
                </h4>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  {selectedDayData.total} Incidents
                </span>
                {showYoYComparison && selectedDayData.previousYearTotal !== undefined && (
                  <span className="text-xs font-mono text-slate-400">
                    (2025: {selectedDayData.previousYearTotal} events)
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedDayISO(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 cursor-pointer self-start sm:self-auto"
              >
                Clear Date Filter
              </button>
            </div>

            {/* Daily counts breakdown by hazard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs">
              {MAJOR_DISASTER_LINE_CONFIGS.map(cfg => {
                const count = selectedDayData[cfg.key] || 0;
                return (
                  <div
                    key={cfg.key}
                    className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between"
                  >
                    <span className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                      {cfg.label}
                    </span>
                    <span className="font-mono font-bold text-base mt-1" style={{ color: count > 0 ? cfg.color : '#64748b' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* List of active catalog events recorded on this date */}
            {selectedDayData.matchedEvents && selectedDayData.matchedEvents.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedDayData.matchedEvents.length} Active Catalog Calamities recorded on {selectedDayData.dateLabel}:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedDayData.matchedEvents.map((ev: CalamityEvent) => {
                    const meta = CALAMITY_METADATA_LIST.find(m => m.id === ev.type);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onSelectEvent(ev)}
                        className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-400/50 transition-all cursor-pointer group flex items-center justify-between"
                      >
                        <div className="truncate mr-2">
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider"
                              style={{ backgroundColor: `${meta?.color || '#f59e0b'}20`, color: meta?.color || '#f59e0b' }}
                            >
                              {meta?.title || ev.type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{ev.city}</span>
                          </div>
                          <div className="font-bold text-xs text-slate-200 group-hover:text-amber-400 truncate mt-1">
                            {ev.name}
                          </div>
                        </div>

                        <span className="text-[10px] text-sky-400 font-bold shrink-0 flex items-center gap-0.5">
                          Inspect <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 font-mono py-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Background temporal observation records (baseline sensor telemetry and global warning stations).</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Executive Summary PDF Report Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-rose-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400 shadow-md">
            <FileText className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                EXECUTIVE INTELLIGENCE BRIEFING
              </span>
              <span className="text-xs text-slate-400 font-mono">
                A4 Diagnostic Summary (2-Page Multi-Hazard Dossier)
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mt-1">
              Global Calamity Diagnostic & Analytics Summary Report
            </h4>
            <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
              Export an official formatted PDF summary featuring executive KPIs, 14-hazard category distribution, 30-day moving average incident projections, healthcare hospital surge diagnostics, and active critical threat dossiers.
            </p>
          </div>
        </div>

        <button
          onClick={handleGenerateSummaryPDF}
          disabled={pdfGenerating}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all shadow-lg shrink-0 cursor-pointer ${
            pdfGenerated
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/40'
              : pdfGenerating
              ? 'bg-rose-900/60 text-rose-200 border-rose-700/80 cursor-wait'
              : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border-rose-500/80 shadow-rose-950/40'
          }`}
          title="Export formatted diagnostic summary report as a PDF"
        >
          {pdfGenerating ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : pdfGenerated ? (
            <Check className="w-4 h-4 text-white" />
          ) : (
            <FileText className="w-4 h-4 text-white" />
          )}
          <span>
            {pdfGenerating
              ? 'Generating PDF...'
              : pdfGenerated
              ? 'Report Generated!'
              : 'Generate Summary Report'}
          </span>
        </button>
      </div>

      {/* Interactive Incident Inspector with Disaster Occurrence Wall Clocks */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Incident Chronometer & Occurrence Clock Inspector</span>
            </h3>
            <p className="text-xs text-slate-400">
              Showing {highlightedEvents.length} calamity occurrences {selectedTypeFilter ? `filtered by ${selectedTypeFilter}` : ''} {selectedSeverityFilter ? `[${selectedSeverityFilter} severity]` : ''} {selectedDayISO ? `[Date: ${selectedDayISO}]` : ''}. Each event tracks its local municipal wall clock, UTC Zulu timestamp, and mission elapsed time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400">
              {highlightedEvents.length} Active Records
            </span>
          </div>
        </div>

        {/* List of Incidents matching current analytical filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {highlightedEvents.slice(0, 9).map((ev) => {
            const meta = CALAMITY_METADATA_LIST.find(m => m.id === ev.type);
            const clockInfo = resolveDisasterLocalClock(
              ev.occurredAt || ev.updatedAt,
              ev.coordinates.lat,
              ev.coordinates.lng,
              ev.country,
              ev.city,
              ev.occurrenceTimeLocal
            );

            return (
              <div
                key={ev.id}
                onClick={() => onSelectEvent(ev)}
                className="p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider"
                      style={{ 
                        backgroundColor: `${meta?.color || '#f59e0b'}20`, 
                        color: meta?.color || '#f59e0b',
                        border: `1px solid ${meta?.color || '#f59e0b'}40`
                      }}
                    >
                      {meta?.title || ev.type}
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      ev.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {ev.severity}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-100 text-sm mt-2 leading-snug group-hover:text-amber-400 transition-colors">
                    {ev.name}
                  </h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {ev.city}, <strong>{ev.country}</strong>
                  </div>
                </div>

                {/* Occurrence Clock Box */}
                <div className="mt-3 p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Wall Clock:
                    </span>
                    <strong className="text-white bg-slate-950 px-1.5 py-0.2 rounded border border-slate-700">
                      {clockInfo.localTime12h}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/80">
                    <span>{clockInfo.localDateFormatted} ({clockInfo.timezoneName})</span>
                    <span className="text-rose-400 font-bold flex items-center gap-0.5">
                      <Timer className="w-2.5 h-2.5 text-rose-500 animate-pulse" />
                      {clockInfo.missionClockTPlus}
                    </span>
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="mt-2.5 pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Intensity: <strong className="text-amber-400">{ev.intensity.value}</strong>
                  </span>
                  <span className="text-[11px] text-sky-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Inspect <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {highlightedEvents.length > 9 && (
          <div className="text-center pt-2">
            <span className="text-xs text-slate-400 font-mono">
              + {highlightedEvents.length - 9} more events matching current analytics criteria.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
