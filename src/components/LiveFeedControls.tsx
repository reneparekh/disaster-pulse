import React from 'react';
import { LiveFeedStats } from '../services/liveFeedService';
import { 
  Radio, 
  Satellite, 
  RefreshCw, 
  ExternalLink, 
  Zap, 
  Clock, 
  ShieldCheck, 
  Activity,
  Layers,
  BatteryLow,
  ZapOff
} from 'lucide-react';

interface LiveFeedControlsProps {
  stats: LiveFeedStats;
  isLoading: boolean;
  onRefresh: () => void;
  autoRefreshInterval: number; // in seconds, 0 = off
  onChangeAutoRefresh: (val: number) => void;
  countdown: number;
  liveOnlyFilter: boolean;
  onToggleLiveOnly: (val: boolean) => void;
  totalLiveCount: number;
  isPowerSaverMode?: boolean;
}

export const LiveFeedControls: React.FC<LiveFeedControlsProps> = ({
  stats,
  isLoading,
  onRefresh,
  autoRefreshInterval,
  onChangeAutoRefresh,
  countdown,
  liveOnlyFilter,
  onToggleLiveOnly,
  totalLiveCount,
  isPowerSaverMode = false,
}) => {
  return (
    <div className={`w-full bg-slate-900/95 border ${isPowerSaverMode ? 'border-amber-500/30 bg-slate-950/90' : 'border-slate-800'} rounded-xl p-3.5 shadow-xl`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Section: Live Connection Status & Telemetry Counts */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Pulsing Status Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-semibold shadow-inner">
            <span className="relative flex h-2.5 w-2.5">
              {!isPowerSaverMode && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>}
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="tracking-wide uppercase font-bold text-[11px]">
              LIVE SATELLITE & SENSORS: CONNECTED
            </span>
          </div>

          {isPowerSaverMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 font-semibold text-[11px]">
              <BatteryLow className="w-3.5 h-3.5 text-amber-400" />
              <span>Power Saver Active (Eco Polling)</span>
            </div>
          )}

          {/* NASA Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <Satellite className="w-3.5 h-3.5 text-cyan-400" />
            <span>NASA EONET:</span>
            <span className="font-mono font-bold text-cyan-400">{stats.nasaCount} Live Events</span>
          </div>

          {/* USGS Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>USGS Seismics:</span>
            <span className="font-mono font-bold text-amber-400">{stats.usgsCount} Live Events</span>
          </div>

          {/* Latency Pill */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded text-slate-400 font-mono text-[11px]">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span>Latency: {stats.latencyMs}ms</span>
          </div>
        </div>

        {/* Right Section: Auto-Sync Timer, Live-Only Filter, & Manual Refresh */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Live Only Filter Toggle */}
          <button
            onClick={() => onToggleLiveOnly(!liveOnlyFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all border ${
              liveOnlyFilter
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Data Only ({totalLiveCount})</span>
          </button>

          {/* Auto-Refresh Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">Auto-sync:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => onChangeAutoRefresh(Number(e.target.value))}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value={30} className="bg-slate-900">Every 30s</option>
              <option value={60} className="bg-slate-900">Every 60s</option>
              <option value={180} className="bg-slate-900">Every 3m (Eco)</option>
              <option value={300} className="bg-slate-900">Every 5m (Power Saver)</option>
              <option value={0} className="bg-slate-900">Manual Only</option>
            </select>
            {autoRefreshInterval > 0 && (
              <span className="font-mono text-amber-400 text-[11px] ml-1">
                ({countdown}s)
              </span>
            )}
          </div>

          {/* Refresh Action Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Streaming...' : 'Sync Live Telemetry'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
