import React, { useEffect, useState } from 'react';
import { CalamityEvent } from '../types/disaster';
import { resolveDisasterLocalClock } from '../utils/dateUtils';
import { 
  Clock, 
  Calendar, 
  Timer, 
  Globe2, 
  Sun, 
  Moon, 
  Sunrise, 
  Sunset, 
  Compass, 
  Radio 
} from 'lucide-react';

interface DisasterOccurrenceClockProps {
  event: CalamityEvent;
  compact?: boolean;
}

export const DisasterOccurrenceClock: React.FC<DisasterOccurrenceClockProps> = ({
  event,
  compact = false,
}) => {
  const [clockInfo, setClockInfo] = useState(() =>
    resolveDisasterLocalClock(
      event.occurredAt || event.updatedAt,
      event.coordinates.lat,
      event.coordinates.lng,
      event.country,
      event.city,
      event.occurrenceTimeLocal
    )
  );

  // Update elapsed mission clock tick every second
  useEffect(() => {
    const update = () => {
      setClockInfo(
        resolveDisasterLocalClock(
          event.occurredAt || event.updatedAt,
          event.coordinates.lat,
          event.coordinates.lng,
          event.country,
          event.city,
          event.occurrenceTimeLocal
        )
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const SolarIcon =
    clockInfo.solarPhase === 'NIGHT'
      ? Moon
      : clockInfo.solarPhase === 'DAWN'
      ? Sunrise
      : clockInfo.solarPhase === 'DUSK'
      ? Sunset
      : Sun;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-amber-300 font-bold">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Local Clock:</span>
          <span className="text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
            {clockInfo.localTime12h}
          </span>
          <span className="text-slate-400">({clockInfo.localDateFormatted})</span>
        </div>
        <div className="text-cyan-400 text-[10px]">
          {clockInfo.timezoneName}
        </div>
        <div className="text-rose-400 font-bold ml-auto flex items-center gap-1">
          <Timer className="w-3 h-3 text-rose-400 animate-pulse" />
          <span>{clockInfo.missionClockTPlus}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 shadow-xl overflow-hidden relative">
      {/* Background Subtle Radar Effect */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Top Section: Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs uppercase font-black tracking-wider text-amber-400">
            DISASTER OCCURRENCE CHRONOMETER & LOCAL WALL CLOCK
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Solar Phase Badge */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
              clockInfo.solarPhase === 'NIGHT'
                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                : clockInfo.solarPhase === 'DAWN' || clockInfo.solarPhase === 'DUSK'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50'
                : 'bg-yellow-950/80 text-yellow-300 border border-yellow-700/50'
            }`}
          >
            <SolarIcon className="w-3 h-3" />
            <span>{clockInfo.solarPhase}</span>
          </span>

          {/* Running Mission Clock */}
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono text-[11px] font-black bg-rose-950/60 text-rose-400 border border-rose-800/60">
            <Radio className="w-2.5 h-2.5 text-rose-500 animate-ping" />
            <span>{clockInfo.missionClockTPlus}</span>
          </span>
        </div>
      </div>

      {/* Centerpiece: Dual Clocks (Epicenter Local Wall Clock & International Zulu Clock) */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Box 1: Local Clock of the Disaster Site */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-400" /> Epicenter Municipal Wall Clock:
            </span>
            <span className="text-[10px] font-mono text-cyan-400">{clockInfo.utcOffsetStr}</span>
          </div>

          {/* Big Digital Readout */}
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-amber-400 drop-shadow-md">
              {clockInfo.localTime12h}
            </div>
            <div className="text-xs text-slate-200 font-bold mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{clockInfo.localDayOfWeek}, {clockInfo.localDateFormatted}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 truncate">Timezone: <strong className="text-slate-200">{clockInfo.timezoneName}</strong></span>
            <span className="text-amber-400/80 font-mono text-[10px] shrink-0">({clockInfo.elapsedDurationStr})</span>
          </div>
        </div>

        {/* Box 2: International UTC / Zulu Clock & Solar Context */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Globe2 className="w-3.5 h-3.5 text-sky-400" /> Standard Coordinated Time (UTC / Zulu):
            </span>
            <span className="text-[10px] font-mono text-slate-500">Universal Master</span>
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-sky-400">
              {clockInfo.utcFormatted.substring(11, 19)} <span className="text-sm text-slate-500 font-bold">UTC</span>
            </div>
            <div className="text-xs text-slate-300 font-medium mt-0.5">
              {clockInfo.utcFormatted.substring(0, 10)}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-400 leading-tight">
            <span className="text-amber-300 font-medium">Impact Assessment: </span>
            <span>{clockInfo.solarPhaseDescription}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
