import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine
} from 'recharts';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import {
  GitCompare,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Flame,
  Droplets,
  Wind,
  Zap,
  Waves,
  Biohazard,
  ShieldAlert,
  Users,
  AlertTriangle,
  HeartPulse,
  Clock,
  Info,
  CheckCircle2,
  X
} from 'lucide-react';

export interface PeriodComparisonViewProps {
  events: CalamityEvent[];
  filteredEvents?: CalamityEvent[];
  onClose?: () => void;
  onSelectEvent?: (event: CalamityEvent) => void;
}

export type TimeWindowDays = 7 | 14 | 30 | 60;

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  CRITICAL: '#f43f5e', // rose-500
  HIGH: '#f59e0b',     // amber-500
  MODERATE: '#3b82f6', // blue-500
  ADVISORY: '#10b981', // emerald-500
};

const HAZARD_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  earthquake: Activity,
  wildfire: Flame,
  flood: Droplets,
  cyclone: Wind,
  tornado: Wind,
  volcano: Zap,
  tsunami: Waves,
  pandemic: Biohazard,
  virus: Biohazard,
};

/**
 * Format large population numbers with readable abbreviations
 */
function formatPopulation(num: number): { formatted: string; unit: string } {
  if (num >= 1_000_000_000) {
    return { formatted: (num / 1_000_000_000).toFixed(2), unit: 'B' };
  }
  if (num >= 1_000_000) {
    return { formatted: (num / 1_000_000).toFixed(1), unit: 'M' };
  }
  if (num >= 1_000) {
    return { formatted: (num / 1_000).toFixed(1), unit: 'K' };
  }
  return { formatted: String(num), unit: '' };
}

export const PeriodComparisonView: React.FC<PeriodComparisonViewProps> = ({
  events,
  filteredEvents,
  onClose,
  onSelectEvent,
}) => {
  const [windowDays, setWindowDays] = useState<TimeWindowDays>(30);
  const [metricFocus, setMetricFocus] = useState<'events' | 'population' | 'severity'>('events');

  // The base dataset for comparative analysis: prefer filtered dataset if provided
  const baseEvents = filteredEvents && filteredEvents.length > 0 ? filteredEvents : events;

  // 1. Determine anchor date (latest event date in catalog, default Oct 8, 2026)
  const anchorDate = useMemo(() => {
    let maxTimestamp = 0;
    events.forEach(e => {
      const t = new Date(e.occurredAt || e.updatedAt).getTime();
      if (!isNaN(t) && t > maxTimestamp) {
        maxTimestamp = t;
      }
    });
    return maxTimestamp > 0 ? new Date(maxTimestamp) : new Date('2026-10-08T12:00:00Z');
  }, [events]);

  // 2. Compute date boundaries for Current Period (Period A) and Previous Period (Period B)
  const { currentPeriodDates, previousPeriodDates } = useMemo(() => {
    const msInDay = 24 * 60 * 60 * 1000;
    
    // Period A (Current): [anchor - (windowDays - 1) days] to anchor
    const currentEnd = new Date(anchorDate.getTime());
    const currentStart = new Date(anchorDate.getTime() - (windowDays - 1) * msInDay);

    // Period B (Previous): [anchor - (2 * windowDays - 1) days] to [anchor - windowDays days]
    const prevEnd = new Date(currentStart.getTime() - msInDay);
    const prevStart = new Date(prevEnd.getTime() - (windowDays - 1) * msInDay);

    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      currentPeriodDates: {
        start: currentStart,
        end: currentEnd,
        label: `${fmt(currentStart)} – ${fmt(currentEnd)}`,
      },
      previousPeriodDates: {
        start: prevStart,
        end: prevEnd,
        label: `${fmt(prevStart)} – ${fmt(prevEnd)}`,
      },
    };
  }, [anchorDate, windowDays]);

  // 3. Generate daily time-series data for both periods
  const { currentDailyData, previousDailyData, maxDailyCount, maxDailyPopulation } = useMemo(() => {
    const msInDay = 24 * 60 * 60 * 1000;

    // Deterministic pseudo-random seed generator for past baseline
    const getHistoricalDailyMetrics = (dayIndex: number, windowLen: number) => {
      let hash = 0;
      const str = `compare-period-${dayIndex}-${windowLen}`;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const norm = Math.abs(hash % 1000) / 1000;
      const baseCount = 3 + Math.floor(norm * 6); // 3 to 8 events
      const basePopulation = Math.round((250_000 + norm * 850_000));
      const criticalCount = norm > 0.65 ? 2 : (norm > 0.35 ? 1 : 0);
      return { baseCount, basePopulation, criticalCount };
    };

    const curDays: any[] = [];
    const prevDays: any[] = [];
    let localMaxCount = 5;
    let localMaxPop = 1_000_000;

    // Build Current Period Days (1 to windowDays)
    for (let i = 0; i < windowDays; i++) {
      const d = windowDays - 1 - i;
      const dayDate = new Date(anchorDate.getTime() - d * msInDay);
      const iso = dayDate.toISOString().split('T')[0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const shortLabel = `${monthNames[dayDate.getUTCMonth()]} ${String(dayDate.getUTCDate()).padStart(2, '0')}`;

      // Matched events from catalog on this calendar day
      const dayEvents = baseEvents.filter(e => {
        const eIso = (e.occurredAt || e.updatedAt || '').split('T')[0];
        return eIso === iso;
      });

      const synth = getHistoricalDailyMetrics(d, windowDays);
      const count = dayEvents.length > 0 ? dayEvents.length + Math.round(synth.baseCount * 0.4) : synth.baseCount;
      const population = dayEvents.reduce((s, e) => s + (e.medicalEmergency?.affectedPopulation || 0), 0) || synth.basePopulation;
      const critical = dayEvents.filter(e => e.severity === 'CRITICAL').length + synth.criticalCount;

      if (count > localMaxCount) localMaxCount = count;
      if (population > localMaxPop) localMaxPop = population;

      curDays.push({
        dayIndex: i + 1,
        dateISO: iso,
        dateLabel: shortLabel,
        count,
        population,
        populationM: Number((population / 1_000_000).toFixed(2)),
        critical,
        events: dayEvents,
        period: 'Current',
      });
    }

    // Build Previous Period Days (1 to windowDays)
    for (let i = 0; i < windowDays; i++) {
      const d = (windowDays * 2) - 1 - i;
      const dayDate = new Date(anchorDate.getTime() - d * msInDay);
      const iso = dayDate.toISOString().split('T')[0];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const shortLabel = `${monthNames[dayDate.getUTCMonth()]} ${String(dayDate.getUTCDate()).padStart(2, '0')}`;

      const synth = getHistoricalDailyMetrics(d, windowDays);
      // Slight cyclical difference in previous period
      const count = Math.max(1, synth.baseCount + (i % 3 === 0 ? 1 : (i % 4 === 0 ? -1 : 0)));
      const population = Math.max(100_000, Math.round(synth.basePopulation * (0.85 + (i % 5) * 0.06)));
      const critical = synth.criticalCount;

      if (count > localMaxCount) localMaxCount = count;
      if (population > localMaxPop) localMaxPop = population;

      prevDays.push({
        dayIndex: i + 1,
        dateISO: iso,
        dateLabel: shortLabel,
        count,
        population,
        populationM: Number((population / 1_000_000).toFixed(2)),
        critical,
        period: 'Previous',
      });
    }

    return {
      currentDailyData: curDays,
      previousDailyData: prevDays,
      maxDailyCount: Math.ceil(localMaxCount * 1.15),
      maxDailyPopulation: Math.ceil(localMaxPop * 1.15),
    };
  }, [anchorDate, windowDays, baseEvents]);

  // 4. Compute Aggregate Comparative KPIs
  const comparisonKPIs = useMemo(() => {
    const curTotalEvents = currentDailyData.reduce((s, d) => s + d.count, 0);
    const prevTotalEvents = previousDailyData.reduce((s, d) => s + d.count, 0);
    const eventsDelta = curTotalEvents - prevTotalEvents;
    const eventsDeltaPct = prevTotalEvents > 0 ? Number(((eventsDelta / prevTotalEvents) * 100).toFixed(1)) : 0;

    const curTotalPop = currentDailyData.reduce((s, d) => s + d.population, 0);
    const prevTotalPop = previousDailyData.reduce((s, d) => s + d.population, 0);
    const popDelta = curTotalPop - prevTotalPop;
    const popDeltaPct = prevTotalPop > 0 ? Number(((popDelta / prevTotalPop) * 100).toFixed(1)) : 0;

    const curCritical = currentDailyData.reduce((s, d) => s + d.critical, 0);
    const prevCritical = previousDailyData.reduce((s, d) => s + d.critical, 0);
    const criticalDelta = curCritical - prevCritical;
    const criticalDeltaPct = prevCritical > 0 ? Number(((criticalDelta / prevCritical) * 100).toFixed(1)) : 0;

    // Severity score baseline: 2.85 vs 2.68
    const curAvgSeverity = Number((2.4 + (curCritical / (curTotalEvents || 1)) * 1.6).toFixed(2));
    const prevAvgSeverity = Number((2.3 + (prevCritical / (prevTotalEvents || 1)) * 1.5).toFixed(2));
    const severityDelta = Number((curAvgSeverity - prevAvgSeverity).toFixed(2));

    return {
      curTotalEvents,
      prevTotalEvents,
      eventsDelta,
      eventsDeltaPct,
      curTotalPop,
      prevTotalPop,
      popDelta,
      popDeltaPct,
      curCritical,
      prevCritical,
      criticalDelta,
      criticalDeltaPct,
      curAvgSeverity,
      prevAvgSeverity,
      severityDelta,
    };
  }, [currentDailyData, previousDailyData]);

  // 5. Compute Hazard Type Breakdown Comparison (Current vs Previous)
  const hazardComparisonData = useMemo(() => {
    const types: CalamityType[] = [
      'earthquake',
      'wildfire',
      'flood',
      'cyclone',
      'volcano',
      'tsunami',
      'pandemic',
      'tornado',
    ];

    let maxCount = 0;

    const list = types.map(t => {
      const meta = CALAMITY_METADATA_LIST.find(m => m.id === t);
      
      // Deterministic calculation for current & previous
      let hash = 0;
      const str = `hazard-comp-${t}-${windowDays}`;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const norm = Math.abs(hash % 100) / 100;

      // Actual events in catalog matching this type
      const catalogCount = baseEvents.filter(e => e.type === t).length;
      const baseCur = Math.max(1, Math.round(catalogCount * (windowDays / 30) + norm * 8));
      const basePrev = Math.max(1, Math.round(baseCur * (0.75 + norm * 0.45)));

      const curPop = Math.round(baseCur * (320_000 + norm * 450_000));
      const prevPop = Math.round(basePrev * (310_000 + norm * 400_000));

      const delta = baseCur - basePrev;
      const deltaPct = basePrev > 0 ? Number(((delta / basePrev) * 100).toFixed(1)) : 0;

      if (baseCur > maxCount) maxCount = baseCur;
      if (basePrev > maxCount) maxCount = basePrev;

      return {
        type: t,
        name: meta?.title.split(' ')[0] || t,
        fullName: meta?.title || t,
        color: meta?.color || '#38bdf8',
        currentCount: baseCur,
        previousCount: basePrev,
        delta,
        deltaPct,
        currentPop: curPop,
        previousPop: prevPop,
        currentPopM: Number((curPop / 1_000_000).toFixed(2)),
        previousPopM: Number((prevPop / 1_000_000).toFixed(2)),
      };
    }).sort((a, b) => b.currentCount - a.currentCount);

    return {
      list,
      maxHazardCount: Math.ceil(maxCount * 1.2),
    };
  }, [baseEvents, windowDays]);

  // 6. Compute Severity Tier Breakdown Comparison (Current vs Previous)
  const severityComparisonData = useMemo(() => {
    const severities: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MODERATE', 'ADVISORY'];
    const curTotal = comparisonKPIs.curTotalEvents || 1;
    const prevTotal = comparisonKPIs.prevTotalEvents || 1;

    return severities.map(sev => {
      let weight = 0.25;
      if (sev === 'CRITICAL') weight = 0.28;
      else if (sev === 'HIGH') weight = 0.35;
      else if (sev === 'MODERATE') weight = 0.24;
      else if (sev === 'ADVISORY') weight = 0.13;

      const currentCount = Math.round(curTotal * weight);
      const previousCount = Math.round(prevTotal * (weight + (sev === 'CRITICAL' ? -0.05 : 0.02)));

      const currentPct = Number(((currentCount / curTotal) * 100).toFixed(1));
      const previousPct = Number(((previousCount / prevTotal) * 100).toFixed(1));
      const delta = currentCount - previousCount;

      return {
        severity: sev,
        label: `${sev.charAt(0) + sev.slice(1).toLowerCase()}`,
        color: SEVERITY_COLORS[sev],
        currentCount,
        previousCount,
        currentPct,
        previousPct,
        delta,
      };
    });
  }, [comparisonKPIs]);

  const formattedCurPop = formatPopulation(comparisonKPIs.curTotalPop);
  const formattedPrevPop = formatPopulation(comparisonKPIs.prevTotalPop);
  const formattedPopDelta = formatPopulation(Math.abs(comparisonKPIs.popDelta));

  // Determine greatest surge hazard
  const greatestSurge = useMemo(() => {
    return [...hazardComparisonData.list].sort((a, b) => b.delta - a.delta)[0];
  }, [hazardComparisonData.list]);

  return (
    <section 
      aria-label="Compare with previous period"
      className="p-5 sm:p-7 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-925 to-slate-950 border border-purple-500/30 shadow-2xl space-y-6 relative overflow-hidden"
    >
      {/* Ambient background glow for comparative mode */}
      <div className="absolute top-0 right-1/3 w-[500px] h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* --------------------------------------------------------------------- */}
      {/* HEADER & TIME WINDOW CONTROLS                                         */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
              <GitCompare className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                  <span>Compare with Previous Period</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-500/40">
                    Dual Charts Mode
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                Side-by-side dual chart analysis comparing the current operational window against the preceding comparative cycle of identical duration to instantly detect threat surges, relief trajectories, and impact variations.
              </p>
            </div>
          </div>
        </div>

        {/* Time Window Selector & Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Window Duration Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>Window:</span>
            </span>
            {([7, 14, 30, 60] as TimeWindowDays[]).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`px-3 py-1 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                  windowDays === days
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={`Compare past ${days} days with preceding ${days} days`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Metric Focus Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            <span className="text-[11px] font-bold text-slate-400 uppercase font-mono px-2 hidden sm:inline">Focus:</span>
            <button
              type="button"
              onClick={() => setMetricFocus('events')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                metricFocus === 'events'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Incidents
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('population')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                metricFocus === 'population'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Impacted Lives
            </button>
            <button
              type="button"
              onClick={() => setMetricFocus('severity')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                metricFocus === 'severity'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Severity
            </button>
          </div>

          {/* Close / Return Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Close period comparison view and return to standard dashboard view"
            >
              <X className="w-4 h-4 text-slate-400" />
              <span>Close Comparison</span>
            </button>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* PERIOD DATE RANGE BANNERS                                             */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Period: Current Window */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                PERIOD A (CURRENT {windowDays}-DAY OPERATIONAL WINDOW)
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-100 font-mono mt-0.5">
                {currentPeriodDates.label}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Current
          </span>
        </div>

        {/* Right Period: Previous Window */}
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-indigo-400 shrink-0" />
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-bold">
                PERIOD B (PRECEDING {windowDays}-DAY BASELINE WINDOW)
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-100 font-mono mt-0.5">
                {previousPeriodDates.label}
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            Previous
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4 HIGH-LEVEL PERIOD COMPARATIVE KPI DELTA CARDS                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Lives Impacted Delta */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Total Lives Impacted</span>
            </span>
            <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-100 font-mono">
                {formattedCurPop.formatted}{formattedCurPop.unit}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                vs {formattedPrevPop.formatted}{formattedPrevPop.unit}
              </span>
            </div>

            {/* Visual Trend Indicator (Red = increased impact / threat; Green = decreased impact) */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                comparisonKPIs.popDelta > 0
                  ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                  : comparisonKPIs.popDelta < 0
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800 border-slate-700'
              }`}>
                {comparisonKPIs.popDelta > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                ) : comparisonKPIs.popDelta < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {comparisonKPIs.popDelta > 0 ? '+' : ''}{comparisonKPIs.popDeltaPct}%
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({comparisonKPIs.popDelta > 0 ? '+' : ''}{formattedPopDelta.formatted}{formattedPopDelta.unit} lives)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Disasters Count Delta */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Disaster Incidents</span>
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-100 font-mono">
                {comparisonKPIs.curTotalEvents}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                vs {comparisonKPIs.prevTotalEvents}
              </span>
            </div>

            {/* Visual Trend Indicator */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                comparisonKPIs.eventsDelta > 0
                  ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                  : comparisonKPIs.eventsDelta < 0
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800 border-slate-700'
              }`}>
                {comparisonKPIs.eventsDelta > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                ) : comparisonKPIs.eventsDelta < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {comparisonKPIs.eventsDelta > 0 ? '+' : ''}{comparisonKPIs.eventsDeltaPct}%
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({comparisonKPIs.eventsDelta > 0 ? '+' : ''}{comparisonKPIs.eventsDelta} events)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Critical Severity Events Delta */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Critical Incidents</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
              Tier 4
            </span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-400 font-mono">
                {comparisonKPIs.curCritical}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                vs {comparisonKPIs.prevCritical}
              </span>
            </div>

            {/* Visual Trend Indicator */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                comparisonKPIs.criticalDelta > 0
                  ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                  : comparisonKPIs.criticalDelta < 0
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800 border-slate-700'
              }`}>
                {comparisonKPIs.criticalDelta > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                ) : comparisonKPIs.criticalDelta < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {comparisonKPIs.criticalDelta > 0 ? '+' : ''}{comparisonKPIs.criticalDeltaPct}%
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ({comparisonKPIs.criticalDelta > 0 ? '+' : ''}{comparisonKPIs.criticalDelta} critical)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Average Severity Score Delta */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Avg Severity Score</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">Scale 1-4</span>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-100 font-mono">
                {comparisonKPIs.curAvgSeverity.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                vs {comparisonKPIs.prevAvgSeverity.toFixed(2)}
              </span>
            </div>

            {/* Visual Trend Indicator */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold border ${
                comparisonKPIs.severityDelta > 0
                  ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                  : comparisonKPIs.severityDelta < 0
                  ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                  : 'text-slate-400 bg-slate-800 border-slate-700'
              }`}>
                {comparisonKPIs.severityDelta > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                ) : comparisonKPIs.severityDelta < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                ) : (
                  <Minus className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {comparisonKPIs.severityDelta > 0 ? '+' : ''}{comparisonKPIs.severityDelta.toFixed(2)} pts
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {comparisonKPIs.severityDelta > 0 ? 'Threat escalated' : comparisonKPIs.severityDelta < 0 ? 'Risk alleviated' : 'Stable'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* --------------------------------------------------------------------- */}
      {/* DUAL CHARTS SECTION 1: SIDE-BY-SIDE DAILY INCIDENT TIMELINE           */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Dual Timeline Chart: Daily Incident & Impact Dynamics
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Synchronized Y-Axis Scale (0 to {metricFocus === 'population' ? `${(maxDailyPopulation / 1_000_000).toFixed(1)}M` : maxDailyCount})
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* LEFT CHART: Current Period Timeline */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-amber-500/30 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                  Current Period ({currentPeriodDates.label})
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {comparisonKPIs.curTotalEvents} total · {formattedCurPop.formatted}{formattedCurPop.unit} exposed
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={currentDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="currentAmberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="currentRoseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                    interval={windowDays <= 14 ? 1 : 4}
                  />
                  <YAxis 
                    domain={[0, metricFocus === 'population' ? maxDailyPopulation / 1_000_000 : maxDailyCount]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="font-bold text-amber-300 pb-1 border-b border-slate-800">
                            {d.dateLabel} (Current)
                          </div>
                          <div className="text-slate-200">
                            Incidents: <strong className="text-amber-400">{d.count}</strong>
                          </div>
                          <div className="text-slate-200">
                            Population: <strong className="text-slate-100">{d.populationM}M</strong>
                          </div>
                          <div className="text-slate-200">
                            Critical Alerts: <strong className="text-rose-400">{d.critical}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {metricFocus === 'population' ? (
                    <Area
                      type="monotone"
                      dataKey="populationM"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#currentAmberGrad)"
                      name="Exposed Population (M)"
                    />
                  ) : metricFocus === 'severity' ? (
                    <Area
                      type="monotone"
                      dataKey="critical"
                      stroke="#f43f5e"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#currentRoseGrad)"
                      name="Critical Incidents"
                    />
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#currentAmberGrad)"
                      name="Daily Incidents"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT CHART: Previous Period Timeline */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-indigo-500/30 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                  Previous Period ({previousPeriodDates.label})
                </h4>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {comparisonKPIs.prevTotalEvents} total · {formattedPrevPop.formatted}{formattedPrevPop.unit} exposed
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={previousDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prevIndigoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                    interval={windowDays <= 14 ? 1 : 4}
                  />
                  <YAxis 
                    domain={[0, metricFocus === 'population' ? maxDailyPopulation / 1_000_000 : maxDailyCount]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 border border-indigo-500/40 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="font-bold text-indigo-300 pb-1 border-b border-slate-800">
                            {d.dateLabel} (Previous)
                          </div>
                          <div className="text-slate-200">
                            Incidents: <strong className="text-indigo-400">{d.count}</strong>
                          </div>
                          <div className="text-slate-200">
                            Population: <strong className="text-slate-100">{d.populationM}M</strong>
                          </div>
                          <div className="text-slate-200">
                            Critical Alerts: <strong className="text-rose-400">{d.critical}</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {metricFocus === 'population' ? (
                    <Area
                      type="monotone"
                      dataKey="populationM"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#prevIndigoGrad)"
                      name="Exposed Population (M)"
                    />
                  ) : metricFocus === 'severity' ? (
                    <Area
                      type="monotone"
                      dataKey="critical"
                      stroke="#818cf8"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#prevIndigoGrad)"
                      name="Critical Incidents"
                    />
                  ) : (
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#prevIndigoGrad)"
                      name="Daily Incidents"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* DUAL CHARTS SECTION 2: HAZARD TYPE VOLUME COMPARISON (DUAL BARS)      */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
              Dual Hazard Distribution: Current vs Previous Impact by Disaster Taxonomy
            </h3>
          </div>
          {greatestSurge && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/30">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              <span>Surge Alert: {greatestSurge.fullName} (+{greatestSurge.delta} incidents, +{greatestSurge.deltaPct}%)</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* LEFT BAR CHART: Current Period Hazard Distribution */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-amber-500/30 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                  Current Period Hazard Breakdown
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Sorted by Incident Volume
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hazardComparisonData.list} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#cbd5e1', fontSize: 10 }}
                    stroke="#334155"
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis 
                    domain={[0, hazardComparisonData.maxHazardCount]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 border border-amber-500/40 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="font-bold text-amber-300 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span>{d.fullName}</span>
                          </div>
                          <div>Current Incidents: <strong className="text-slate-100">{d.currentCount}</strong></div>
                          <div>Exposed Population: <strong className="text-amber-400">{d.currentPopM}M</strong></div>
                          <div className="pt-1 text-[11px] border-t border-slate-800">
                            Delta vs Prev: <strong className={d.delta > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                              {d.delta > 0 ? '+' : ''}{d.delta} ({d.delta > 0 ? '+' : ''}{d.deltaPct}%)
                            </strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="currentCount" radius={[4, 4, 0, 0]}>
                    {hazardComparisonData.list.map((entry, idx) => (
                      <Cell key={`cur-bar-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT BAR CHART: Previous Period Hazard Distribution */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/85 border border-indigo-500/30 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
                  Previous Period Hazard Baseline
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Synchronized Scale
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hazardComparisonData.list} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#cbd5e1', fontSize: 10 }}
                    stroke="#334155"
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis 
                    domain={[0, hazardComparisonData.maxHazardCount]}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    stroke="#334155"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 border border-indigo-500/40 rounded-xl shadow-2xl text-xs font-mono space-y-1">
                          <div className="font-bold text-indigo-300 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span>{d.fullName}</span>
                          </div>
                          <div>Previous Incidents: <strong className="text-slate-100">{d.previousCount}</strong></div>
                          <div>Exposed Population: <strong className="text-indigo-300">{d.previousPopM}M</strong></div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="previousCount" fill="#6366f1" radius={[4, 4, 0, 0]}>
                    {hazardComparisonData.list.map((entry, idx) => (
                      <Cell key={`prev-bar-${idx}`} fill={`${entry.color}90`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* IMPACT CHANGES BREAKDOWN MATRIX / TABLE                               */}
      {/* --------------------------------------------------------------------- */}
      <div className="p-4 sm:p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-200">
              Taxonomy Impact Change Matrix ({windowDays}-Day Window vs Preceding {windowDays}-Day)
            </h4>
          </div>
          <div className="text-[11px] font-mono flex items-center gap-3">
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Red = Threat Surge</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Green = Threat Relief</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <th className="pb-2 font-semibold">Hazard Class</th>
                <th className="pb-2 font-semibold text-center">Current Period</th>
                <th className="pb-2 font-semibold text-center">Previous Period</th>
                <th className="pb-2 font-semibold text-center">Net Delta</th>
                <th className="pb-2 font-semibold text-center">Change %</th>
                <th className="pb-2 font-semibold text-right">Population Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {hazardComparisonData.list.map((row) => {
                const Icon = HAZARD_TYPE_ICONS[row.type] || Activity;
                const isIncreased = row.delta > 0;
                const isDecreased = row.delta < 0;

                return (
                  <tr key={row.type} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 flex items-center gap-2 font-medium text-slate-200 font-sans">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: row.color }} />
                      <span className="truncate max-w-[140px] sm:max-w-none">{row.fullName}</span>
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-100">
                      {row.currentCount}
                    </td>
                    <td className="py-2.5 text-center text-slate-400">
                      {row.previousCount}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`font-bold inline-flex items-center gap-0.5 ${
                        isIncreased ? 'text-rose-400' : isDecreased ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {isIncreased ? '+' : ''}{row.delta}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                        isIncreased
                          ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                          : isDecreased
                          ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                          : 'text-slate-400 bg-slate-800 border-slate-700'
                      }`}>
                        {isIncreased ? (
                          <ArrowUpRight className="w-3 h-3 text-rose-400 stroke-[3]" />
                        ) : isDecreased ? (
                          <ArrowDownRight className="w-3 h-3 text-emerald-400 stroke-[3]" />
                        ) : (
                          <Minus className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{isIncreased ? '+' : ''}{row.deltaPct}%</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-200">
                      <span>{row.currentPopM}M</span>
                      <span className="text-[10px] text-slate-500 font-normal ml-1">
                        (prev {row.previousPopM}M)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </section>
  );
};
