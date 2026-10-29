import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  ExternalLink, 
  ShieldAlert, 
  Radio, 
  Satellite, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  WifiOff, 
  SlidersHorizontal,
  Info,
  CheckCircle2,
  AlertOctagon,
  Flame,
  Waves
} from 'lucide-react';
import { LiveFeedStats } from '../services/liveFeedService';
import { triggerActionHaptic } from '../utils/hapticsService';

export interface StaleDataBannerProps {
  feedStats?: LiveFeedStats;
  lastUpdatedTimestamp?: number;
  isLoadingLive?: boolean;
  onRefreshFeeds?: () => Promise<void> | void;
  staleThresholdMinutes?: number; // default 60
  onResizeMap?: () => void;
}

export type LatencySimulationMode = 'auto' | 'stale_75m' | 'stale_3h' | 'outage' | 'fresh';

export const StaleDataBanner: React.FC<StaleDataBannerProps> = ({
  feedStats,
  lastUpdatedTimestamp,
  isLoadingLive = false,
  onRefreshFeeds,
  staleThresholdMinutes = 60,
  onResizeMap,
}) => {
  const [simulationMode, setSimulationMode] = useState<LatencySimulationMode>('auto');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [isTestDropdownOpen, setIsTestDropdownOpen] = useState<boolean>(false);

  // Keep a periodic ticker every 10 seconds to recalculate latency
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Notify parent to invalidate map size when banner expands/collapses
  useEffect(() => {
    if (onResizeMap) {
      onResizeMap();
    }
  }, [isCollapsed, simulationMode, onResizeMap]);

  // Determine effective last update timestamp based on simulation or real data
  const effectiveData = useMemo(() => {
    const baseTimestamp = lastUpdatedTimestamp || (feedStats?.lastUpdatedTimestamp) || (currentTime - 5 * 60 * 1000);

    let effectiveTs = baseTimestamp;
    let isForcedOutage = false;

    if (simulationMode === 'stale_75m') {
      effectiveTs = currentTime - 75 * 60 * 1000; // 75 mins ago (> 60m threshold)
    } else if (simulationMode === 'stale_3h') {
      effectiveTs = currentTime - 210 * 60 * 1000; // 3.5 hrs ago
    } else if (simulationMode === 'outage') {
      effectiveTs = currentTime - 120 * 60 * 1000;
      isForcedOutage = true;
    } else if (simulationMode === 'fresh') {
      effectiveTs = currentTime - 2 * 60 * 1000; // 2 mins ago
    }

    const elapsedMs = Math.max(0, currentTime - effectiveTs);
    const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const remainderMinutes = elapsedMinutes % 60;

    const isStale = isForcedOutage || elapsedMinutes >= staleThresholdMinutes || feedStats?.isStale === true;
    const isCriticalStale = elapsedMinutes >= 180 || isForcedOutage;

    return {
      timestamp: effectiveTs,
      elapsedMinutes,
      elapsedHours,
      remainderMinutes,
      isStale,
      isCriticalStale,
      isForcedOutage,
      formattedSyncTime: new Date(effectiveTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formattedSyncDate: new Date(effectiveTs).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }, [currentTime, lastUpdatedTimestamp, feedStats, simulationMode, staleThresholdMinutes]);

  // Format human-friendly latency text
  const formatLatencyDuration = (minutes: number) => {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} hour${h === 1 ? '' : 's'}`;
    return `${h}h ${m}m`;
  };

  // If data is fresh and NOT in forced stale mode, we render a slim status ribbon with test switcher
  if (!effectiveData.isStale) {
    return (
      <div className="w-full bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-300 flex items-center justify-between gap-2 z-[1100] backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-semibold text-emerald-400">
            Disaster Feeds Fresh
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-[11px] text-slate-400 font-mono">
            Last sync: {effectiveData.formattedSyncTime} ({formatLatencyDuration(effectiveData.elapsedMinutes)} ago)
          </span>
          <span className="text-slate-600 hidden md:inline">•</span>
          <span className="text-[11px] text-slate-500 hidden md:inline">
            Latency threshold: &gt;{staleThresholdMinutes}m
          </span>
        </div>

        {/* Latency Simulation Selector for Testing */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 hidden sm:inline">Feed Latency Test:</span>
            <select
              value={simulationMode}
              onChange={(e) => setSimulationMode(e.target.value as LatencySimulationMode)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
              title="Test the Stale Data Warning system across various latency scenarios"
            >
              <option value="auto">Auto (Live Clock)</option>
              <option value="stale_75m">⚠️ Simulate 75m Stale (&gt;1h)</option>
              <option value="stale_3h">🚨 Simulate 3.5h Stale</option>
              <option value="outage">📡 Simulate Feed Outage</option>
            </select>
          </div>

          {onRefreshFeeds && (
            <button
              onClick={() => {
                triggerActionHaptic();
                onRefreshFeeds();
              }}
              disabled={isLoadingLive}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
              title="Sync live feeds"
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // STALE DATA WARNING BANNER (> 60 MIN LATENCY)
  // ==========================================
  return (
    <div 
      className={`w-full transition-all duration-300 z-[1100] border-b shadow-2xl backdrop-blur-md ${
        effectiveData.isCriticalStale
          ? 'bg-gradient-to-r from-rose-950/98 via-slate-950/98 to-rose-950/98 border-rose-500/80 text-rose-100 shadow-rose-950/40'
          : 'bg-gradient-to-r from-amber-950/98 via-slate-950/98 to-amber-950/98 border-amber-500/80 text-amber-100 shadow-amber-950/40'
      }`}
    >
      {/* Top Warning Strip */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Icon, Critical Headline, & Latency Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3.5 w-3.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                effectiveData.isCriticalStale ? 'bg-rose-400' : 'bg-amber-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                effectiveData.isCriticalStale ? 'bg-rose-500' : 'bg-amber-500'
              }`}></span>
            </span>

            {effectiveData.isCriticalStale ? (
              <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 shrink-0 animate-pulse" />
            ) : (
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0 animate-pulse" />
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs sm:text-sm tracking-wide uppercase">
                {effectiveData.isForcedOutage
                  ? 'Data Feed Connection Outage'
                  : 'Stale Disaster Telemetry Warning'}
              </span>

              {/* Latency Pill Badge */}
              <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-black border shadow-sm ${
                effectiveData.isCriticalStale
                  ? 'bg-rose-500/30 text-rose-200 border-rose-400/60'
                  : 'bg-amber-500/30 text-amber-200 border-amber-400/60'
              }`}>
                Latency: {formatLatencyDuration(effectiveData.elapsedMinutes)} ({effectiveData.elapsedMinutes}m ago)
              </span>

              {/* Threshold Pill */}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 border border-white/10 text-slate-300">
                Threshold: &gt;{staleThresholdMinutes}m
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Actions & Collapse Toggle */}
        <div className="flex items-center gap-2">
          {/* Simulation Selector */}
          <div className="flex items-center bg-black/40 border border-white/15 rounded-lg px-2 py-1">
            <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">Mode:</span>
            <select
              value={simulationMode}
              onChange={(e) => setSimulationMode(e.target.value as LatencySimulationMode)}
              className="bg-transparent text-[11px] font-medium text-slate-200 focus:outline-none cursor-pointer"
              title="Test different latency configurations"
            >
              <option value="auto" className="bg-slate-900">Auto (Live Clock)</option>
              <option value="stale_75m" className="bg-slate-900">⚠️ 75m Stale (&gt;1h)</option>
              <option value="stale_3h" className="bg-slate-900">🚨 3.5h Stale (High Risk)</option>
              <option value="outage" className="bg-slate-900">📡 Connection Outage</option>
              <option value="fresh" className="bg-slate-900">✅ Reset to Fresh</option>
            </select>
          </div>

          {/* Re-sync Button */}
          {onRefreshFeeds && (
            <button
              onClick={() => {
                triggerActionHaptic();
                onRefreshFeeds();
              }}
              disabled={isLoadingLive}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all shadow-md cursor-pointer ${
                effectiveData.isCriticalStale
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/50'
              } disabled:opacity-50`}
              title="Force re-fetch USGS, NASA, and weather feeds immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin' : ''}`} />
              <span>{isLoadingLive ? 'Syncing...' : 'Re-sync Feeds'}</span>
            </button>
          )}

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/10"
            title={isCollapsed ? 'Expand Detailed Latency Warning' : 'Collapse to Slim Warning Bar'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Warning Details & Official Agency Direct Links */}
      {!isCollapsed && (
        <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-white/10 text-xs space-y-2.5 bg-black/20">
          {/* Explicit Latency Explanation & Operational Risk Statement */}
          <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="leading-relaxed text-slate-200">
                <strong className={effectiveData.isCriticalStale ? 'text-rose-300' : 'text-amber-300'}>
                  Explicit Feed Latency Notice:
                </strong>{' '}
                Disaster data feeds were last updated at{' '}
                <span className="font-mono font-bold text-white">{effectiveData.formattedSyncTime} UTC</span> on{' '}
                <span className="font-mono text-white">{effectiveData.formattedSyncDate}</span> ({formatLatencyDuration(effectiveData.elapsedMinutes)} ago).
                This latency exceeds the <strong>60-minute real-time threshold</strong>.
              </p>
              <p className="text-[11px] text-slate-400 leading-normal">
                ⚠️ <strong>Operational Consequence:</strong> Active wildfire thermal perimeters, seismic aftershock sequences, and storm surge inundation zones may have progressed or evolved. Map markers and polygons depict cached telemetry and <strong>must not be used as the sole basis for live evacuation routes</strong>.
              </p>
            </div>
          </div>

          {/* Per-Feed Latency & Health Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* USGS Seismics Stream */}
            <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>USGS Seismics</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                  STALE ({effectiveData.elapsedMinutes}m)
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Earthquake hypocenters &amp; MMI intensities delayed.
              </p>
              <a
                href="https://earthquake.usgs.gov/earthquakes/map/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 font-semibold underline decoration-amber-500/50"
              >
                <span>USGS Real-time Map</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* NASA EONET / MODIS */}
            <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Satellite className="w-3.5 h-3.5 text-cyan-400" />
                  <span>NASA EONET / FIRMS</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                  STALE ({effectiveData.elapsedMinutes}m)
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Satellite optical &amp; thermal infrared detection lag.
              </p>
              <a
                href="https://firms.modaps.eosdis.nasa.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 font-semibold underline decoration-cyan-500/50"
              >
                <span>NASA FIRMS Active Fire Map</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* GDACS Official Alerts */}
            <div className="p-2 rounded-lg bg-black/30 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>GDACS / UN-OCHA</span>
                </div>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                  CACHED
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Global multi-hazard civil protection emergency bulletins.
              </p>
              <a
                href="https://www.gdacs.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-rose-200 font-semibold underline decoration-rose-500/50"
              >
                <span>Official GDACS Bulletins</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
