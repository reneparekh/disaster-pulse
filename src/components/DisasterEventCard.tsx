import React, { useState, useMemo } from 'react';
import { CalamityEvent } from '../types/disaster';
import { UserGeoLocation, calculatePreciseDistanceKm } from '../utils/geolocationUtils';
import { resolveDisasterLocalClock } from '../utils/dateUtils';
import { getCountryLocale, translateEventDescription } from '../utils/localeDictionary';
import { 
  AlertTriangle, 
  MapPin, 
  ExternalLink, 
  Clock, 
  ShieldAlert, 
  Radio, 
  Building2, 
  ChevronRight,
  Flame,
  Activity,
  Waves,
  Wind,
  Navigation,
  Crosshair,
  Languages
} from 'lucide-react';
import { triggerActionHaptic } from '../utils/hapticsService';

interface DisasterEventCardProps {
  event: CalamityEvent;
  userLocation: UserGeoLocation | null;
  onSelectEvent: (event: CalamityEvent) => void;
  onLocateOnMap?: (event: CalamityEvent) => void;
  onOpenReportModal?: (eventName: string) => void;
  isSelected?: boolean;
}

export const DisasterEventCard: React.FC<DisasterEventCardProps> = ({
  event,
  userLocation,
  onSelectEvent,
  onLocateOnMap,
  onOpenReportModal,
  isSelected = false,
}) => {
  const [isTranslated, setIsTranslated] = useState<boolean>(false);

  const locale = useMemo(() => getCountryLocale(event.country), [event.country]);
  const translatedData = useMemo(() => translateEventDescription(event), [event]);

  const clock = resolveDisasterLocalClock(
    event.occurredAt || event.updatedAt,
    event.coordinates.lat,
    event.coordinates.lng,
    event.country,
    event.city,
    event.occurrenceTimeLocal
  );

  const now = Date.now();
  const eventTimestamp = event.occurredAt ? new Date(event.occurredAt).getTime() : now;
  const ageMs = Math.max(0, now - eventTimestamp);
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  const isOlderThanOneHour = ageMinutes >= 60;

  const distanceKm = userLocation
    ? Math.round(calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, event.coordinates.lat, event.coordinates.lng))
    : null;

  const handleLocateOnMap = () => {
    triggerActionHaptic();
    if (onLocateOnMap) {
      onLocateOnMap(event);
    } else {
      onSelectEvent(event);
    }

    // Direct event dispatch to ensure map centers on event coordinates immediately
    window.dispatchEvent(new CustomEvent('disaster:locate', { detail: event }));

    // Mobile viewport helper: scroll map into view smoothly if out of view
    const mapEl = document.getElementById('disaster-map-container');
    if (mapEl) {
      const rect = mapEl.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Determine official agency link
  const agencyUrl = event.rawFeedUrl || (
    event.type === 'earthquake'
      ? `https://earthquake.usgs.gov/earthquakes/eventpage/us${event.id.replace('usgs-live-', '')}`
      : event.type === 'wildfire'
      ? 'https://firms.modaps.eosdis.nasa.gov/'
      : event.type === 'volcano'
      ? 'https://volcano.si.edu/'
      : 'https://www.gdacs.org/'
  );

  return (
    <div 
      className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
        isSelected 
          ? 'bg-slate-900 border-amber-500 ring-2 ring-amber-500/30 shadow-xl' 
          : 'bg-slate-900/95 border-slate-800 hover:border-slate-700 shadow-md'
      }`}
    >
      {/* Top Header: Severity + Distance + Quick Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider ${
            event.severity === 'CRITICAL'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              : event.severity === 'HIGH'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
          }`}>
            {event.severity}
          </span>

          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono font-bold">
            {event.intensity?.value || event.type}
          </span>

          {distanceKm !== null && (
            <span className={`px-2 py-0.5 rounded-md text-xs font-black flex items-center gap-1 ${
              distanceKm <= 50 
                ? 'bg-rose-600 text-white animate-pulse' 
                : distanceKm <= 150 
                ? 'bg-amber-500 text-slate-950 font-bold' 
                : 'bg-slate-800 text-cyan-300 border border-cyan-800/60'
            }`}>
              <MapPin className="w-3 h-3" />
              <span>{distanceKm} km from you</span>
            </span>
          )}
        </div>

        {/* Quick Card Actions: Translate + Locate on Map */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Translate Button using locale dictionary based on event's country */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerActionHaptic();
              setIsTranslated(prev => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95 border ${
              isTranslated
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30 ring-1 ring-emerald-500/40 shadow-emerald-950/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
            }`}
            title={isTranslated ? 'Show original English' : `Translate descriptions to ${locale.nativeName} (${locale.languageName}) for field workers in ${event.country}`}
            aria-label={`Translate descriptions to ${locale.languageName}`}
          >
            <Languages className={`w-3.5 h-3.5 ${isTranslated ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{isTranslated ? `${locale.flag} ${locale.nativeName}` : `Translate (${locale.code.toUpperCase()})`}</span>
          </button>

          {/* Locate on Map button in card header */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLocateOnMap();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/35 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-sm cursor-pointer hover:shadow-amber-500/20 active:scale-95 shrink-0"
            title={`Center map on ${event.name} (${event.coordinates.lat.toFixed(2)}, ${event.coordinates.lng.toFixed(2)})`}
            aria-label={`Locate ${event.name} on map`}
          >
            <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Locate on Map</span>
          </button>
        </div>
      </div>

      {/* Title & Location */}
      <div className={isTranslated && locale.direction === 'rtl' ? 'text-right' : ''}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-white text-base leading-snug">
            {isTranslated ? translatedData.name : event.name}
          </h3>
          {isTranslated && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center gap-1">
              <span>{locale.flag}</span>
              <span>{locale.code.toUpperCase()}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{event.city}, {event.country}</span>
        </p>
      </div>

      {/* Field Worker Active Translation Status Banner */}
      {isTranslated && (
        <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-300 animate-fadeIn">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0">{locale.flag}</span>
            <span className="truncate">
              Locale Dictionary: <strong>{locale.nativeName}</strong> ({locale.languageName}) for field workers in {event.country}
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerActionHaptic();
              setIsTranslated(false);
            }}
            className="text-[10px] text-emerald-400 hover:text-white underline font-mono shrink-0 cursor-pointer"
          >
            Original EN
          </button>
        </div>
      )}

      {/* Requirement 5: Data Source, Event Time, and How Old the Data Is */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-1.5 font-mono">
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400 font-sans">{isTranslated ? translatedData.labels.officialSource : 'Official Source:'}</span>
          <span className="text-amber-300 font-bold truncate max-w-[220px]">
            {event.source || 'USGS / NASA Official Ingestion'}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400 font-sans">{isTranslated ? translatedData.labels.incidentTime : 'Incident Time:'}</span>
          <span className="text-slate-200">
            {clock.localDateFormatted} • {clock.localTime12h} ({clock.timezoneName})
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400 font-sans">{isTranslated ? translatedData.labels.dataAge : 'Data Age:'}</span>
          <span className="font-bold text-white">
            {ageMinutes < 60 ? `${ageMinutes} mins ago` : `${Math.floor(ageMinutes / 60)}h ${ageMinutes % 60}m ago`}
          </span>
        </div>

        {/* Stale Warning Banner if > 1 hour */}
        {isOlderThanOneHour ? (
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5 text-amber-300 font-bold font-sans text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{isTranslated ? translatedData.labels.dataStale : '⚠️ Data may be out of date (Reported > 1 hr ago)'}</span>
          </div>
        ) : (
          <div className="mt-2 pt-2 border-t border-slate-800 flex items-center gap-1.5 text-emerald-400 font-medium font-sans text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{isTranslated ? translatedData.labels.dataFresh : 'Data is fresh (Updated recently)'}</span>
          </div>
        )}
      </div>

      {/* Requirement 7: Official Agency Warning Word-for-Word with Outbound Link */}
      {event.publicAdvisory && (
        <div className={`p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-2 text-xs ${isTranslated && locale.direction === 'rtl' ? 'text-right' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              {isTranslated ? translatedData.labels.agencyWarning : 'Official Agency Warning (Word-for-Word)'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {isTranslated ? `${locale.flag} Local Translation` : 'Not AI-Generated'}
            </span>
          </div>

          <p className="font-bold text-white leading-relaxed">
            "{isTranslated ? translatedData.headline : event.publicAdvisory.headline}"
          </p>

          <p className="text-slate-300 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-rose-500/20">
            <strong>{isTranslated ? translatedData.labels.actionRequired : 'Action:'}</strong> {isTranslated ? translatedData.immediateAction : event.publicAdvisory.immediateAction}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rose-500/20">
            <a
              href={agencyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-bold text-xs underline cursor-pointer"
            >
              <span>Read Original Official Agency Bulletin</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {onOpenReportModal && (
              <button
                type="button"
                onClick={() => onOpenReportModal(event.name)}
                className="text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer"
              >
                Report an issue with this
              </button>
            )}
          </div>
        </div>
      )}

      {/* Primary Card Action Bar: Locate on Map & Detailed Briefing */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleLocateOnMap();
          }}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-950/30 cursor-pointer group"
          title={`Center disaster map on ${event.name} [${event.coordinates.lat.toFixed(2)}, ${event.coordinates.lng.toFixed(2)}]`}
        >
          <Navigation className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" />
          <span>Locate on Map</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerActionHaptic();
            onSelectEvent(event);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700/80 transition-all cursor-pointer"
          title="Open comprehensive crisis telemetry and civil defense briefing"
        >
          <span>Details</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
