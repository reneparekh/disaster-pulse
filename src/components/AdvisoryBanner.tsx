import React, { useState, useMemo } from 'react';
import { CalamityEvent } from '../types/disaster';
import { formatIncidentUTC, formatTimeElapsed } from '../utils/dateUtils';
import { 
  ShieldAlert, 
  HeartPulse, 
  Satellite, 
  Radio, 
  ExternalLink, 
  Clock, 
  Zap, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  AlertTriangle,
  Users,
  MapPin,
  Flame,
  Wind
} from 'lucide-react';

interface AdvisoryBannerProps {
  events: CalamityEvent[];
  filteredEvents?: CalamityEvent[];
  liveOnlyFilter?: boolean;
  onToggleLiveOnly?: (val: boolean) => void;
  totalLiveCount?: number;
  isLoadingLive?: boolean;
  lastUpdated?: string;
  onSelectEvent: (event: CalamityEvent) => void;
}

export const AdvisoryBanner: React.FC<AdvisoryBannerProps> = ({
  events,
  filteredEvents,
  liveOnlyFilter = false,
  onToggleLiveOnly,
  totalLiveCount,
  isLoadingLive = false,
  lastUpdated,
  onSelectEvent,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Separate live stream events from baseline catalog
  const liveEvents = useMemo(() => {
    return events.filter((e) => e.isLiveFeed);
  }, [events]);

  const baselineEvents = useMemo(() => {
    return events.filter((e) => !e.isLiveFeed);
  }, [events]);

  // When liveOnlyFilter is true, the primary metrics represent strictly the LIVE stream.
  // Otherwise, activeEvents represents all monitored events, but with dedicated live metrics calculated.
  const activeEvents = useMemo(() => {
    if (liveOnlyFilter) {
      return liveEvents.length > 0 ? liveEvents : events;
    }
    return events;
  }, [events, liveEvents, liveOnlyFilter]);

  // Live-specific calculations
  const liveCriticals = useMemo(() => {
    return liveEvents.filter((e) => e.severity === 'CRITICAL');
  }, [liveEvents]);

  const liveMedicalAlerts = useMemo(() => {
    return liveEvents.filter((e) => e.medicalEmergency.isMedicalAlert);
  }, [liveEvents]);

  const liveDangerZonePop = useMemo(() => {
    return liveEvents.reduce((sum, e) => sum + (e.medicalEmergency.affectedPopulation || 0), 0);
  }, [liveEvents]);

  // Combined calculations
  const allCriticals = useMemo(() => {
    return events.filter((e) => e.severity === 'CRITICAL');
  }, [events]);

  const allMedicalAlerts = useMemo(() => {
    return events.filter((e) => e.medicalEmergency.isMedicalAlert);
  }, [events]);

  const allDangerZonePop = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.medicalEmergency.affectedPopulation || 0), 0);
  }, [events]);

  // Active metrics depending on view mode
  const displayedCriticalCount = liveOnlyFilter ? liveCriticals.length : allCriticals.length;
  const displayedMedicalCount = liveOnlyFilter ? liveMedicalAlerts.length : allMedicalAlerts.length;
  const displayedPopCount = liveOnlyFilter ? liveDangerZonePop : allDangerZonePop;

  // Priority Threat: prioritize the highest magnitude live critical event
  const topCritical = useMemo(() => {
    if (liveOnlyFilter && liveCriticals.length > 0) {
      return liveCriticals[0];
    }
    if (liveCriticals.length > 0) {
      return liveCriticals[0];
    }
    if (allCriticals.length > 0) {
      return allCriticals[0];
    }
    return events[0] || null;
  }, [liveOnlyFilter, liveCriticals, allCriticals, events]);

  return (
    <div className="w-full bg-slate-900/95 border border-slate-800 rounded-xl shadow-xl backdrop-blur-sm transition-all overflow-hidden">
      {/* Main Status Bar */}
      <div className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Global Emergency Counters according to Live Data */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
          {/* Live Mode Scope Indicator / Quick Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => onToggleLiveOnly?.(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                liveOnlyFilter
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-950'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Filter to live USGS & NASA telemetry feed only"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span>LIVE DATA STREAM</span>
              <span className="font-mono text-[10px] bg-slate-950/80 px-1 py-0.2 rounded text-rose-300 border border-rose-500/30">
                {liveEvents.length}
              </span>
            </button>

            <button
              onClick={() => onToggleLiveOnly?.(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                !liveOnlyFilter
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title="Show all monitored incidents (Live stream + baseline catalog)"
            >
              <span>ALL HAZARDS</span>
              <span className="font-mono text-[10px] text-slate-400">
                {events.length}
              </span>
            </button>
          </div>

          {/* 1. CRITICAL THREATS Counter */}
          <div 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1.5 cursor-pointer group"
            title="Click to view contributing live critical hazards"
          >
            <span className="font-bold text-rose-400 group-hover:text-rose-300 transition-colors flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>CRITICAL THREATS:</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono font-black text-rose-200 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/50 shadow-inner">
                {displayedCriticalCount} Active
              </span>
              {!liveOnlyFilter && liveCriticals.length > 0 && (
                <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/30" title="Live stream portion">
                  {liveCriticals.length} Live
                </span>
              )}
            </div>
          </div>

          {/* 2. Medical Emergencies Counter */}
          <div 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1.5 cursor-pointer group"
            title="Click to view live medical emergencies and hospital alerts"
          >
            <HeartPulse className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="text-slate-300 font-semibold group-hover:text-white transition-colors">Medical Emergencies:</span>
            <div className="flex items-center gap-1">
              <span className="font-mono font-bold text-rose-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {displayedMedicalCount} Cities
              </span>
              {!liveOnlyFilter && liveMedicalAlerts.length > 0 && (
                <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/30" title="Live stream portion">
                  {liveMedicalAlerts.length} Live
                </span>
              )}
            </div>
          </div>

          {/* 3. Global Population in Danger Zone Counter */}
          <div 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="hidden sm:flex items-center gap-1.5 cursor-pointer group"
            title="Calculated from active hazard perimeter radii and demographic density hubs"
          >
            <Users className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-slate-400 font-semibold group-hover:text-slate-200 transition-colors">
              {liveOnlyFilter ? 'Live Stream Population in Danger Zone:' : 'Global Population in Danger Zone:'}
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono font-black text-amber-400 bg-slate-950 px-2 py-0.5 rounded border border-amber-500/30">
                {displayedPopCount.toLocaleString()} Citizens
              </span>
              {!liveOnlyFilter && liveDangerZonePop > 0 && (
                <span className="hidden xl:inline-flex font-mono text-[10px] text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30">
                  {(liveDangerZonePop / 1000000).toFixed(1)}M Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Telemetry Toggle & Priority Live Threat Action */}
        <div className="flex items-center gap-2">
          {/* Telemetry Breakdown Toggle Button */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Expand live data telemetry breakdown"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span className="hidden md:inline">Telemetry Breakdown</span>
            {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Priority Threat with Occurrence Timestamp */}
          {topCritical && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
                {topCritical.isLiveFeed ? 'Priority Live Threat:' : 'Priority Threat:'}
              </span>
              <button
                onClick={() => onSelectEvent(topCritical)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/40 transition-colors cursor-pointer group shadow-sm"
                title={`Occurred: ${topCritical.occurredAt ? formatIncidentUTC(topCritical.occurredAt) : 'Recorded'} • Click to view full report`}
              >
                <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400 shrink-0" />
                <span className="truncate max-w-[160px] sm:max-w-[220px]">
                  {topCritical.city}: {topCritical.name}
                </span>
                {topCritical.occurredAt && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-amber-300/90 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                    {formatTimeElapsed(topCritical.occurredAt) || formatIncidentUTC(topCritical.occurredAt).substring(5, 16)}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Live Telemetry Breakdown Drawer */}
      {showBreakdown && (
        <div className="p-4 bg-slate-950/95 border-t border-slate-800/80 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Satellite className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wide text-xs">
                Live Data Telemetry & Sensor Synthesis
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE SENSORS: USGS & NASA EONET
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Live Ingested: <strong className="text-cyan-300">{liveEvents.length} Events</strong></span>
              <span>•</span>
              <span>Critical Threats: <strong className="text-rose-400">{liveCriticals.length}</strong></span>
              <span>•</span>
              <span>Medical Emergencies: <strong className="text-rose-300">{liveMedicalAlerts.length}</strong></span>
              <span>•</span>
              <span>Danger Zone Exposure: <strong className="text-amber-400">{liveDangerZonePop.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Contributing Live Critical Incidents Grid */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
              <span>Contributing Real-Time Live Threats:</span>
              <span className="text-[10px] text-slate-500">Click any incident to open full diagnostics & evacuation telemetry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {(liveCriticals.length > 0 ? liveCriticals : liveEvents.slice(0, 6)).map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="font-semibold text-slate-100 group-hover:text-rose-300 transition-colors text-xs truncate">
                      {ev.name}
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold shrink-0 ${
                      ev.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {ev.severity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-800/60 font-mono">
                    <span className="flex items-center gap-1 text-slate-300 truncate">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      {ev.city}, {ev.country}
                    </span>
                    <span className="text-amber-300 font-bold shrink-0">
                      {ev.medicalEmergency.affectedPopulation?.toLocaleString()} in Zone
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                    <span>{ev.intensity.value}</span>
                    <span className="text-rose-400 font-medium">
                      {ev.medicalEmergency.isMedicalAlert ? '🚨 Medical Alert' : 'Monitored'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
