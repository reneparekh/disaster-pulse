import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CalamityEvent, CalamityType } from '../types/disaster';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Calendar, 
  Sparkles, 
  Layers, 
  FastForward, 
  Rewind,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Activity,
  Flame,
  Waves,
  Eye
} from 'lucide-react';

export interface TimeSeriesFilterState {
  timeWindowDays: number; // 7, 14, 21, or 30 days
  currentTimestamp: number; // Current playback / cursor timestamp in epoch ms
  cumulativeMode: boolean; // if true, show all events up to currentTimestamp; if false, show narrow window around cursor
  isPlaying: boolean;
}

interface TimeSeriesSliderProps {
  events: CalamityEvent[];
  timeWindowDays: number; // e.g. 7 to 30
  onChangeTimeWindowDays: (days: number) => void;
  currentTimestamp: number;
  onChangeTimestamp: (timestamp: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  cumulativeMode: boolean;
  onToggleCumulativeMode: () => void;
  playbackSpeed: number; // e.g. 1x, 2x, 5x, 10x
  onChangePlaybackSpeed: (speed: number) => void;
  filteredCount: number;
  totalCount: number;
  onSelectEvent?: (event: CalamityEvent) => void;
  className?: string;
}

const PRESET_WINDOWS = [
  { label: '7 Days', days: 7, desc: 'Past week rapid progression' },
  { label: '14 Days', days: 14, desc: 'Fortnight hazard sequence' },
  { label: '21 Days', days: 21, desc: '3-week multi-phase disaster series' },
  { label: '30 Days', days: 30, desc: 'Full 30-day temporal baseline' },
];

const SPEED_OPTIONS = [
  { label: '1x', val: 1 },
  { label: '2x', val: 2 },
  { label: '5x', val: 5 },
  { label: '10x', val: 10 },
];

export const TimeSeriesSlider: React.FC<TimeSeriesSliderProps> = ({
  events,
  timeWindowDays,
  onChangeTimeWindowDays,
  currentTimestamp,
  onChangeTimestamp,
  isPlaying,
  onTogglePlay,
  cumulativeMode,
  onToggleCumulativeMode,
  playbackSpeed,
  onChangePlaybackSpeed,
  filteredCount,
  totalCount,
  onSelectEvent,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Compute the absolute boundary timestamps for the selected time window
  const { minTimestamp, maxTimestamp, daysRange } = useMemo(() => {
    const now = Date.now();
    const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;
    const minTime = now - windowMs;
    return {
      minTimestamp: minTime,
      maxTimestamp: now,
      daysRange: timeWindowDays,
    };
  }, [timeWindowDays]);

  // Group events into daily bins to render a micro-histogram over the slider track
  const dailyDistribution = useMemo(() => {
    const numBuckets = Math.min(daysRange, 30);
    const bucketDurationMs = (maxTimestamp - minTimestamp) / numBuckets;
    const buckets = Array.from({ length: numBuckets }, (_, i) => ({
      index: i,
      start: minTimestamp + i * bucketDurationMs,
      end: minTimestamp + (i + 1) * bucketDurationMs,
      count: 0,
      criticalCount: 0,
      events: [] as CalamityEvent[],
    }));

    events.forEach(ev => {
      const t = ev.occurredAt ? new Date(ev.occurredAt).getTime() : 0;
      if (t >= minTimestamp && t <= maxTimestamp) {
        const bucketIdx = Math.min(
          numBuckets - 1,
          Math.max(0, Math.floor((t - minTimestamp) / bucketDurationMs))
        );
        buckets[bucketIdx].count += 1;
        if (ev.severity === 'CRITICAL') {
          buckets[bucketIdx].criticalCount += 1;
        }
        buckets[bucketIdx].events.push(ev);
      }
    });

    const maxBucketCount = Math.max(...buckets.map(b => b.count), 1);
    return { buckets, maxBucketCount };
  }, [events, minTimestamp, maxTimestamp, daysRange]);

  // Percentage progress across the slider [0..100]
  const progressPercent = useMemo(() => {
    if (maxTimestamp <= minTimestamp) return 100;
    const clamped = Math.max(minTimestamp, Math.min(maxTimestamp, currentTimestamp));
    return ((clamped - minTimestamp) / (maxTimestamp - minTimestamp)) * 100;
  }, [currentTimestamp, minTimestamp, maxTimestamp]);

  // Format the current cursor timestamp into readable dates
  const currentDateFormatted = useMemo(() => {
    const d = new Date(currentTimestamp);
    return {
      date: d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      relativeDays: Math.abs(Math.round((Date.now() - currentTimestamp) / (1000 * 60 * 60 * 24))),
    };
  }, [currentTimestamp]);

  // Events that occurred nearest to the active slider cursor (within +/- 18 hours or cumulative)
  const activeClusterEvents = useMemo(() => {
    const windowToleranceMs = 18 * 60 * 60 * 1000;
    return events
      .filter(ev => {
        if (!ev.occurredAt) return false;
        const t = new Date(ev.occurredAt).getTime();
        if (cumulativeMode) {
          return t >= minTimestamp && t <= currentTimestamp;
        } else {
          return Math.abs(t - currentTimestamp) <= windowToleranceMs;
        }
      })
      .slice(0, 5);
  }, [events, minTimestamp, currentTimestamp, cumulativeMode]);

  // Jump to start (oldest event date in window)
  const handleJumpToStart = () => {
    onChangeTimestamp(minTimestamp);
  };

  // Jump to live (now)
  const handleJumpToNow = () => {
    onChangeTimestamp(maxTimestamp);
  };

  // Handle direct slider scrub
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    const newTs = minTimestamp + (pct / 100) * (maxTimestamp - minTimestamp);
    onChangeTimestamp(newTs);
  };

  // Step backward by 12 hours
  const handleStepBackward = () => {
    const stepMs = 12 * 60 * 60 * 1000;
    onChangeTimestamp(Math.max(minTimestamp, currentTimestamp - stepMs));
  };

  // Step forward by 12 hours
  const handleStepForward = () => {
    const stepMs = 12 * 60 * 60 * 1000;
    onChangeTimestamp(Math.min(maxTimestamp, currentTimestamp + stepMs));
  };

  return (
    <div className={`w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-3.5 transition-all ${className}`}>
      {/* Header bar: Title, Preset Window Selectors, and Cumulative Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-slate-100 uppercase">
                Temporal Time-Series Animator
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {timeWindowDays}D WINDOW
              </span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  REPLAYING ({playbackSpeed}x)
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Filter & animate progression of earthquakes, fires, storms, and floods over the last 7 to 30 days
            </p>
          </div>
        </div>

        {/* Right Header Controls: Day Preset Buttons & Cumulative Mode Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 7 - 30 Day Preset Range Selectors */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
            {PRESET_WINDOWS.map((preset) => (
              <button
                key={preset.days}
                onClick={() => onChangeTimeWindowDays(preset.days)}
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  timeWindowDays === preset.days
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={preset.desc}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Mode Switch: Cumulative (All events up to time) vs Focal Window (Slice) */}
          <button
            onClick={onToggleCumulativeMode}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
              cumulativeMode
                ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900/60'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title={
              cumulativeMode
                ? 'Cumulative Mode: Shows all events that occurred from start date up to the slider cursor'
                : 'Focal Window Mode: Highlights only hazards occurring in a narrow 36h slice around the slider cursor'
            }
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px]">
              {cumulativeMode ? 'Cumulative Build' : 'Focal Slice'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Slider Track with Temporal Frequency Histogram */}
      <div className="pt-3 pb-1 space-y-1.5">
        {/* Micro-Histogram: Number of hazard events per day bucket */}
        <div className="h-6 flex items-end gap-0.5 px-1 bg-slate-950/60 rounded border border-slate-800/80 overflow-hidden relative">
          {dailyDistribution.buckets.map((b) => {
            const heightPct = (b.count / dailyDistribution.maxBucketCount) * 100;
            const isPassed = b.end <= currentTimestamp;
            const isCurrent = currentTimestamp >= b.start && currentTimestamp <= b.end;

            return (
              <div
                key={b.index}
                className="flex-1 flex flex-col justify-end h-full group relative cursor-pointer"
                onClick={() => onChangeTimestamp(b.start + (b.end - b.start) / 2)}
                title={`${new Date(b.start).toLocaleDateString()}: ${b.count} hazards (${b.criticalCount} critical)`}
              >
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    isCurrent
                      ? 'bg-amber-400 ring-1 ring-amber-300'
                      : isPassed
                      ? b.criticalCount > 0
                        ? 'bg-rose-500/70'
                        : 'bg-cyan-500/60'
                      : 'bg-slate-700/50 hover:bg-slate-600'
                  }`}
                  style={{ height: `${Math.max(12, heightPct)}%` }}
                />
              </div>
            );
          })}

          {/* Current Cursor Marker Line across Histogram */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-lg pointer-events-none transition-all z-10"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* The Native HTML Range Slider Bar */}
        <div className="relative flex items-center py-1">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPercent}
            onChange={handleSliderChange}
            aria-label="Time-Series Disaster Replay Slider"
            className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-ew-resize accent-amber-400 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {/* Date Labels below track */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span>T-{timeWindowDays}d ({new Date(minTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</span>
          </span>

          {/* Active Hover / Current Time Indicator Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 border border-amber-500/40 text-amber-300 font-bold shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>{currentDateFormatted.date}</span>
            <span className="text-slate-500">•</span>
            <span>{currentDateFormatted.time}</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-mono">
              {currentDateFormatted.relativeDays === 0
                ? 'Today (Live)'
                : `${currentDateFormatted.relativeDays}d ago`}
            </span>
          </div>

          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Live Present (Now)</span>
          </span>
        </div>
      </div>

      {/* Control Bar: Play / Pause, Speeds, Jump Buttons, and Event Count Stats */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Jump to oldest */}
          <button
            onClick={handleJumpToStart}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={`Rewind to beginning of ${timeWindowDays}-day window`}
          >
            <Rewind className="w-3.5 h-3.5" />
          </button>

          {/* Step Back 12 hours */}
          <button
            onClick={handleStepBackward}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-mono transition-colors cursor-pointer"
            title="Step back 12 hours"
          >
            -12h
          </button>

          {/* Play / Pause Toggle Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs transition-all shadow-md cursor-pointer ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50 ring-1 ring-rose-400'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
            title={isPlaying ? 'Pause chronological animation' : 'Animate hazard progression across time window'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Progression</span>
              </>
            )}
          </button>

          {/* Step Forward 12 hours */}
          <button
            onClick={handleStepForward}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] font-mono transition-colors cursor-pointer"
            title="Step forward 12 hours"
          >
            +12h
          </button>

          {/* Jump to Present Now */}
          <button
            onClick={handleJumpToNow}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Fast forward to present live moment"
          >
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed Multiplier Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-mono">Speed:</span>
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.val}
                onClick={() => onChangePlaybackSpeed(opt.val)}
                className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  playbackSpeed === opt.val
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Animate at ${opt.label} speed`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Real-time Metric: Visible filtered events */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-slate-400">Progression State:</span>
          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-bold text-amber-300">
            {filteredCount} / {totalCount} Calamities
          </span>
          {activeClusterEvents.length > 0 && onSelectEvent && (
            <div className="hidden xl:flex items-center gap-1 pl-2 border-l border-slate-800">
              <span className="text-slate-500 text-[10px]">Active Wave:</span>
              <button
                onClick={() => onSelectEvent(activeClusterEvents[0])}
                className="text-[10px] font-sans text-cyan-400 hover:underline truncate max-w-[140px] text-left cursor-pointer"
                title={`Inspect recent hazard: ${activeClusterEvents[0].name}`}
              >
                {activeClusterEvents[0].city}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
