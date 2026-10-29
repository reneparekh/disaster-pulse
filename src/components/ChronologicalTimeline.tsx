import React, { useState, useMemo } from 'react';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { resolveDisasterLocalClock, formatIncidentUTC, formatTimeElapsed } from '../utils/dateUtils';
import { UserGeoLocation, calculateDistanceKm } from '../utils/geolocationUtils';
import { 
  Activity, 
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
  Clock,
  Calendar,
  MapPin,
  ExternalLink,
  ShieldAlert,
  HeartPulse,
  Users,
  Radio,
  ArrowUpDown,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
  Satellite,
  Compass,
  Navigation
} from 'lucide-react';

interface ChronologicalTimelineProps {
  events: CalamityEvent[];
  selectedEvent: CalamityEvent | null;
  onSelectEvent: (event: CalamityEvent) => void;
  userLocation?: UserGeoLocation | null;
  className?: string;
  isFullWidth?: boolean;
}

// Simple, clean icons representing each disaster type
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

// Fallback colors for severity
const SEVERITY_BADGE_STYLES: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
  HIGH: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40' },
  MODERATE: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  ADVISORY: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export const ChronologicalTimeline: React.FC<ChronologicalTimelineProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  userLocation,
  className = '',
  isFullWidth = false,
}) => {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc'); // 'desc' = Newest first
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'CRITICAL' | 'HIGH'>('all');
  const [timelineSearch, setTimelineSearch] = useState('');

  // 1. Sort events chronologically by timestamp
  const sortedAndFilteredEvents = useMemo(() => {
    let result = [...events];

    // Optional local severity filter
    if (filterSeverity !== 'all') {
      result = result.filter(e => e.severity === filterSeverity);
    }

    // Optional search query
    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase();
      result = result.filter(e => 
        e.name.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
      );
    }

    // Chronological sort
    result.sort((a, b) => {
      const timeA = new Date(a.occurredAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.occurredAt || b.updatedAt || 0).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [events, sortOrder, filterSeverity, timelineSearch]);

  // 2. Group sorted events by Calendar Date milestones for clear longitudinal progression
  const groupedMilestones = useMemo(() => {
    const groups: { dateKey: string; label: string; items: CalamityEvent[] }[] = [];
    const dateMap = new Map<string, CalamityEvent[]>();

    sortedAndFilteredEvents.forEach(ev => {
      const d = new Date(ev.occurredAt || ev.updatedAt || Date.now());
      const dateKey = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'undated';

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(ev);
    });

    // Determine readable label for each date
    dateMap.forEach((items, dateKey) => {
      let label = dateKey;
      if (dateKey !== 'undated') {
        const parts = dateKey.split('-');
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = dateKey === todayStr;

        label = isToday 
          ? `Today • ${dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      } else {
        label = 'Baseline Catalog Timeline';
      }

      groups.push({ dateKey, label, items });
    });

    return groups;
  }, [sortedAndFilteredEvents]);

  return (
    <div className={`flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl ${className}`}>
      {/* Timeline Controls Header */}
      <div className="p-3 sm:p-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-slate-100 tracking-tight">
                Chronological Timeline
              </span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-amber-300 border border-slate-700">
                {sortedAndFilteredEvents.length} Events
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Sorted by occurrence timestamp • Temporal sequence
            </p>
          </div>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* Sort Direction Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition-all cursor-pointer font-medium text-[11px]"
            title={sortOrder === 'desc' ? 'Currently: Newest First (Click to sort Oldest First)' : 'Currently: Oldest First (Click to sort Newest First)'}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>

          {/* Severity Filter Pills */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                filterSeverity === 'all' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                filterSeverity === 'CRITICAL' ? 'bg-rose-500/30 text-rose-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Critical
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Vertical Timeline Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-6">
        {sortedAndFilteredEvents.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Clock className="w-10 h-10 text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-400">No events found in timeline</p>
            <p className="text-xs text-slate-600 mt-0.5">Try resetting severity filters or search query</p>
          </div>
        ) : (
          groupedMilestones.map((group) => (
            <div key={group.dateKey} className="space-y-3">
              {/* Date Milestone Header Pill */}
              <div className="sticky top-0 z-10 flex items-center gap-2 py-1 bg-slate-900/90 backdrop-blur-sm">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-amber-300 shadow-sm">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  {group.label}
                </span>
                <div className="h-px flex-1 bg-slate-800"></div>
                <span className="text-[10px] font-mono text-slate-500">
                  {group.items.length} {group.items.length === 1 ? 'incident' : 'incidents'}
                </span>
              </div>

              {/* Vertical Timeline Spine & Event Cards */}
              <div className="relative pl-6 sm:pl-7 space-y-3.5 before:absolute before:left-3 sm:before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-amber-500/80 before:via-rose-500/60 before:to-slate-800">
                {group.items.map((ev) => {
                  const meta = CALAMITY_METADATA_LIST.find(m => m.id === ev.type);
                  const IconComp = ICON_MAP[ev.type] || Activity;
                  const isSelected = selectedEvent?.id === ev.id;
                  const isCritical = ev.severity === 'CRITICAL';
                  const sevStyle = SEVERITY_BADGE_STYLES[ev.severity] || SEVERITY_BADGE_STYLES.MODERATE;
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
                      className="relative group transition-all"
                    >
                      {/* Timeline Node Icon Circle on the vertical spine */}
                      <div 
                        style={{ backgroundColor: meta?.color ? `${meta.color}25` : '#f59e0b25', borderColor: meta?.color || '#f59e0b' }}
                        className={`absolute -left-6 sm:-left-7 top-3 w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 z-10 ${
                          isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 scale-110' : ''
                        }`}
                        title={`${meta?.title || ev.type} (${ev.severity})`}
                      >
                        <IconComp 
                          className="w-3.5 h-3.5" 
                          style={{ color: meta?.color || '#f59e0b' }} 
                        />
                        {isCritical && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                          </span>
                        )}
                      </div>

                      {/* Timeline Card */}
                      <div
                        onClick={() => onSelectEvent(ev)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'bg-slate-850 border-amber-500/80 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                            : 'bg-slate-950/80 hover:bg-slate-850/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top Line: Disaster Type + Timestamp + Relative Time + Severity */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Calamity Type Pill with Simple Icon */}
                            <span 
                              style={{ color: meta?.color || '#f59e0b', backgroundColor: meta?.color ? `${meta.color}15` : '#f59e0b15' }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border border-current/30"
                            >
                              <IconComp className="w-3 h-3 shrink-0" />
                              <span>{meta?.title || ev.type}</span>
                            </span>

                            {/* Live Feed Ingestion Badge */}
                            {ev.isLiveFeed && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                {ev.liveFeedSource || 'LIVE'}
                              </span>
                            )}

                            {/* Relative Time Badge */}
                            {ev.occurredAt && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300/90 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <Clock className="w-2.5 h-2.5 text-amber-400" />
                                {formatTimeElapsed(ev.occurredAt) || 'Recent'}
                              </span>
                            )}
                          </div>

                          {/* Severity Pill */}
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${sevStyle.bg} ${sevStyle.text} ${sevStyle.border}`}>
                              {ev.severity}
                            </span>
                          </div>
                        </div>

                        {/* Title & Location */}
                        <div className="mt-2.5">
                          <h4 className="font-bold text-slate-100 group-hover:text-amber-300 transition-colors text-sm sm:text-base leading-snug">
                            {ev.name}
                          </h4>

                          <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                            <span className="flex items-center gap-1 truncate text-slate-300 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>{ev.city}, {ev.country}</span>
                            </span>

                            {/* Occurrence Clock */}
                            <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">
                              {clockInfo.utcFormatted.substring(11, 19)} UTC
                            </span>
                          </div>
                        </div>

                        {/* Local Geolocation Hazard Alert */}
                        {isLocalHazardAlert && (
                          <div className="mt-2 p-1.5 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-[11px] font-bold flex items-center justify-between gap-1 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse shrink-0" />
                              <span>LOCAL HAZARD ALERT: Within {distKm?.toFixed(0)}km radius</span>
                            </div>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500 text-slate-950 font-black">
                              IMMEDIATE EVAC
                            </span>
                          </div>
                        )}

                        {/* Bottom Telemetry Metrics Strip */}
                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          {/* Intensity Value */}
                          <div className="flex items-center gap-1 text-slate-300 font-mono">
                            <span className="text-slate-500">Intensity:</span>
                            <span className="font-bold text-amber-400 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                              {ev.intensity.value}
                            </span>
                          </div>

                          {/* Danger Zone Population */}
                          <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                            <Users className="w-3 h-3 text-amber-400" />
                            <span>{(ev.medicalEmergency?.affectedPopulation || 0).toLocaleString()} citizens</span>
                          </div>

                          {/* Medical Alert Status */}
                          {ev.medicalEmergency?.isMedicalAlert ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-rose-300 font-semibold bg-rose-950/50 px-1.5 py-0.2 rounded border border-rose-800/40">
                              <HeartPulse className="w-3 h-3 text-rose-400" />
                              <span>Medical Alert</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Stable Triage
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            {/* In-app Locate on Map button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectEvent(ev);
                                window.dispatchEvent(new CustomEvent('disaster:locate', { detail: ev }));
                                const mapEl = document.getElementById('disaster-map-container');
                                if (mapEl) {
                                  mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
                              title="Center disaster map on this event"
                            >
                              <Navigation className="w-2.5 h-2.5" />
                              <span>Locate on Map</span>
                            </button>

                            {/* External Google Maps Button */}
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                              title="Open Google Maps coordinates in new tab"
                            >
                              <span>Map Pin</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Timeline Footer Summary */}
      <div className="p-2.5 px-3.5 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400 flex items-center justify-between font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>Timeline synchronized with real-time feeds</span>
        </div>
        <div className="text-[10px] text-slate-500">
          Showing {sortedAndFilteredEvents.length} chronological checkpoints
        </div>
      </div>
    </div>
  );
};
