import React from 'react';
import { CalamityEvent } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { resolveDisasterLocalClock } from '../utils/dateUtils';
import { UserGeoLocation, calculateDistanceKm } from '../utils/geolocationUtils';
import { 
  MapPin, 
  ExternalLink, 
  Activity, 
  HeartPulse, 
  ShieldAlert, 
  Satellite, 
  ArrowUpRight,
  Clock, 
  Calendar,
  Compass,
  Timer,
  Flame, 
  Waves, 
  FlameKindling, 
  Biohazard, 
  Mountain, 
  Snowflake, 
  Wind, 
  Tornado, 
  Droplets, 
  SunMedium, 
  CloudSnow, 
  Thermometer, 
  Globe,
  Radio,
  AlertTriangle
} from 'lucide-react';

interface DisasterListProps {
  events: CalamityEvent[];
  selectedEvent: CalamityEvent | null;
  onSelectEvent: (event: CalamityEvent) => void;
  userLocation?: UserGeoLocation | null;
}

const ICON_MAP: Record<string, React.ElementType> = {
  volcano: Flame,
  tsunami: Waves,
  earthquake: Activity,
  wildfire: FlameKindling,
  virus: Biohazard,
  landslide: Mountain,
  avalanche: Snowflake,
  cyclone: Wind,
  tornado: Tornado,
  flood: Droplets,
  drought: SunMedium,
  blizzard: CloudSnow,
  extreme_temp: Thermometer,
  pandemic: Globe,
};

export const DisasterList: React.FC<DisasterListProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  userLocation,
}) => {
  return (
    <div className="space-y-2.5">
      {events.map(ev => {
        const meta = CALAMITY_METADATA_LIST.find(m => m.id === ev.type);
        const IconComp = ICON_MAP[ev.type] || Activity;
        const isSelected = selectedEvent?.id === ev.id;
        const isCritical = ev.severity === 'CRITICAL';
        const googleMapsUrl = `https://www.google.com/maps?q=${ev.coordinates.lat},${ev.coordinates.lng}`;

        const distKm = userLocation
          ? calculateDistanceKm(userLocation.lat, userLocation.lng, ev.coordinates.lat, ev.coordinates.lng)
          : null;
        const isLocalHazardAlert = isCritical && distKm !== null && distKm <= 500;

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
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              isLocalHazardAlert
                ? 'border-rose-500 bg-rose-950/20 shadow-xl ring-2 ring-rose-500/50'
                : isSelected
                ? 'border-amber-400 bg-slate-900 shadow-xl ring-1 ring-amber-400/40'
                : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            {/* Top Status & Live Indicator */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-900">
              <div className="flex items-center gap-2 flex-wrap">
                {isLocalHazardAlert && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse shadow-md border border-white">
                    <AlertTriangle className="w-3 h-3 text-white" />
                    LOCAL HAZARD ALERT ({distKm} km)
                  </span>
                )}
                {ev.isLiveFeed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    {ev.liveFeedSource === 'USGS' ? 'LIVE USGS SEISMIC' : 'LIVE NASA SATELLITE'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                    MONITORED BASELINE
                  </span>
                )}
                {ev.liveIngestionTime && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Synced: {ev.liveIngestionTime}
                  </span>
                )}
              </div>

              {/* Alert Badge */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                isCritical
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {ev.severity}
              </span>
            </div>

            {/* Main Info Row */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${meta?.color || '#f59e0b'}20`, color: meta?.color || '#f59e0b' }}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      {meta?.title || ev.type}
                    </span>
                    <span className="text-slate-500 text-[10px]">•</span>
                    <span className="text-slate-400 text-[11px] font-mono truncate max-w-[140px]">
                      {ev.satelliteTelemetry.satellite.split('/')[0]}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-100 text-sm mt-0.5 leading-snug">
                    {ev.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{ev.city}, <strong>{ev.country}</strong></span>
                    {distKm !== null && (
                      <span className="text-[10px] text-cyan-400 font-bold ml-1 font-mono">
                        • {distKm} km from you
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Intensity Value */}
              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono font-bold text-amber-400">
                  {ev.intensity.value}
                </div>
                <div className="text-[10px] text-slate-500">
                  {ev.coordinates.lat.toFixed(2)}°, {ev.coordinates.lng.toFixed(2)}°
                </div>
              </div>
            </div>

            {/* Dedicated Disaster Occurrence Clock Banner */}
            <div className="mt-2.5 px-2.5 py-2 rounded-lg bg-slate-950 border border-amber-500/30 text-[11px] space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Occurrence Clock:</span>
                  <span className="font-mono text-white bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                    {clockInfo.localTime12h}
                  </span>
                  <span className="text-slate-300 font-normal">({clockInfo.localDateFormatted})</span>
                </div>
                <div className="text-[10px] font-mono text-cyan-400">
                  {clockInfo.timezoneName}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900 font-mono">
                <span>Universal UTC: {clockInfo.utcFormatted.substring(11, 19)} ({clockInfo.utcFormatted.substring(0, 10)})</span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Timer className="w-3 h-3 text-rose-500 animate-pulse" />
                  {clockInfo.missionClockTPlus}
                </span>
              </div>
            </div>

            {/* Bottom Details Row */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                {ev.medicalEmergency.isMedicalAlert && (
                  <div className="flex items-center gap-1 text-[11px] text-rose-400">
                    <HeartPulse className="w-3.5 h-3.5" />
                    <span>Hosp: {ev.medicalEmergency.hospitalPressure.replace('_', ' ')}</span>
                  </div>
                )}
                {ev.rawFeedUrl && (
                  <a
                    href={ev.rawFeedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                  >
                    API Feed <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-[11px] font-semibold transition-colors"
                >
                  Google Maps <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEvent(ev);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors"
                >
                  Diagnostics <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
