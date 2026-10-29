import React, { useState, useMemo } from 'react';
import {
  Layers,
  X,
  Search,
  Filter,
  AlertTriangle,
  Flame,
  Waves,
  Activity,
  Biohazard,
  Mountain,
  Snowflake,
  Wind,
  Droplets,
  SunMedium,
  CloudSnow,
  Thermometer,
  Globe,
  Radio,
  Clock,
  MapPin,
  Flag,
  Users,
  CloudRain,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  Info,
  Maximize2,
  Satellite
} from 'lucide-react';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';

export interface MapLegendProps {
  isOpen: boolean;
  onClose: () => void;
  activeEvents: CalamityEvent[];
  filteredType: CalamityType | 'all';
  onSelectTypeFilter?: (type: CalamityType | 'all') => void;
  severityFilter?: SeverityLevel | 'all';
  onSelectSeverityFilter?: (severity: SeverityLevel | 'all') => void;
  onFocusEvent?: (event: CalamityEvent) => void;
  showWeatherRadar?: boolean;
  onToggleWeatherRadar?: () => void;
  showWeatherSatellite?: boolean;
  onToggleWeatherSatellite?: () => void;
  showHeatmap?: boolean;
  onToggleHeatmap?: () => void;
  showResources?: boolean;
  onToggleResources?: () => void;
  showDateTimeTags?: boolean;
  onToggleDateTimeTags?: () => void;
  showHazardRadius?: boolean;
  onToggleHazardRadius?: () => void;
  showThermalAnomalies?: boolean;
  onToggleThermalAnomalies?: () => void;
  activeLayerKey?: 'terrain' | 'satellite' | 'dark';
  onChangeLayerKey?: (key: 'terrain' | 'satellite' | 'dark') => void;
}

type LegendTab = 'types' | 'severity' | 'markers' | 'tactical';

// Comprehensive icon mapping with fallback
const EMOJI_AND_ICONS: Record<string, { emoji: string; icon: React.ComponentType<{ className?: string }> }> = {
  volcano: { emoji: '🌋', icon: Flame },
  tsunami: { emoji: '🌊', icon: Waves },
  earthquake: { emoji: '📈', icon: Activity },
  wildfire: { emoji: '🔥', icon: Flame },
  virus: { emoji: '☣️', icon: Biohazard },
  landslide: { emoji: '⛰️', icon: Mountain },
  avalanche: { emoji: '❄️', icon: Snowflake },
  cyclone: { emoji: '🌀', icon: Wind },
  tornado: { emoji: '🌪️', icon: Wind },
  flood: { emoji: '💧', icon: Droplets },
  drought: { emoji: '☀️', icon: SunMedium },
  blizzard: { emoji: '🌨️', icon: CloudSnow },
  extreme_temp: { emoji: '🌡️', icon: Thermometer },
  pandemic: { emoji: '🌐', icon: Globe },
};

// Severity specifications
interface SeveritySpec {
  level: SeverityLevel;
  name: string;
  color: string;
  bgRgba: string;
  borderColor: string;
  markerSizePx: number;
  pulseSpeed: string;
  criteria: string;
  evacuationMandate: string;
  operationalAction: string;
}

const SEVERITY_SPECS: SeveritySpec[] = [
  {
    level: 'CRITICAL',
    name: 'Critical / Catastrophic',
    color: '#f43f5e',
    bgRgba: 'rgba(244, 63, 94, 0.25)',
    borderColor: '#f43f5e',
    markerSizePx: 28,
    pulseSpeed: 'Fast high-frequency pulsing beacon (1.2s ping)',
    criteria: 'Immediate threat to thousands of human lives, mass casualties expected, severe structural breakdown, or catastrophic containment loss.',
    evacuationMandate: 'Immediate mandatory evacuation within 50km–150km corridor. Air-med mobilization activated.',
    operationalAction: 'Dispatches National Disaster Management units, emergency air corridors, and international humanitarian relief triage.'
  },
  {
    level: 'HIGH',
    name: 'High Severity Alert',
    color: '#f59e0b',
    bgRgba: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#f59e0b',
    markerSizePx: 24,
    pulseSpeed: 'Moderate warning glow & steady pulse (2.0s)',
    criteria: 'Severe regional infrastructure disruption, localized building damage, major lifeline failures, or dangerous toxic/flood plume progression.',
    evacuationMandate: 'Phased voluntary evacuation recommended for vulnerable populations, medical patients, and schools.',
    operationalAction: 'Mobilizes regional civil defense, prepares field hospitals, positions supply trucks, and initiates public sirens.'
  },
  {
    level: 'MODERATE',
    name: 'Moderate Hazard',
    color: '#3b82f6',
    bgRgba: 'rgba(59, 130, 246, 0.20)',
    borderColor: '#3b82f6',
    markerSizePx: 24,
    pulseSpeed: 'Standard perimeter ring without outer ping',
    criteria: 'Localized environmental or geological disturbance under control or contained by municipal emergency forces.',
    evacuationMandate: 'Shelter in place advised; avoid low-lying drainage basins, coastlines, or unreinforced masonry.',
    operationalAction: 'Monitored continuously via satellite telemetry, localized emergency services on standby.'
  },
  {
    level: 'ADVISORY',
    name: 'Advisory / Watch',
    color: '#64748b',
    bgRgba: 'rgba(100, 116, 139, 0.20)',
    borderColor: '#64748b',
    markerSizePx: 24,
    pulseSpeed: 'Static low-intensity icon indicator',
    criteria: 'Preliminary meteorological anomalies, minor seismic tremors, or early epidemic surveillance clusters.',
    evacuationMandate: 'No evacuation required; stay tuned to emergency broadcast channels and local meteorological radios.',
    operationalAction: 'Automated satellite observation pass tracking and baseline atmospheric sensor validation.'
  }
];

export const MapLegend: React.FC<MapLegendProps> = ({
  isOpen,
  onClose,
  activeEvents,
  filteredType,
  onSelectTypeFilter,
  severityFilter = 'all',
  onSelectSeverityFilter,
  onFocusEvent,
  showWeatherRadar = false,
  onToggleWeatherRadar,
  showWeatherSatellite = false,
  onToggleWeatherSatellite,
  showHeatmap = false,
  onToggleHeatmap,
  showResources = false,
  onToggleResources,
  showDateTimeTags = true,
  onToggleDateTimeTags,
  showHazardRadius = true,
  onToggleHazardRadius,
  showThermalAnomalies = false,
  onToggleThermalAnomalies,
  activeLayerKey = 'satellite',
  onChangeLayerKey,
}) => {
  const [activeTab, setActiveTab] = useState<LegendTab>('types');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [inspectedType, setInspectedType] = useState<CalamityType | null>(null);

  // Event counts by calamity type
  const eventCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    activeEvents.forEach(ev => {
      counts[ev.type] = (counts[ev.type] || 0) + 1;
    });
    return counts;
  }, [activeEvents]);

  // Event counts by severity level
  const eventCountsBySeverity = useMemo(() => {
    const counts: Record<SeverityLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MODERATE: 0,
      ADVISORY: 0,
    };
    activeEvents.forEach(ev => {
      if (counts[ev.severity] !== undefined) {
        counts[ev.severity]++;
      }
    });
    return counts;
  }, [activeEvents]);

  // Filtered disaster list based on search query
  const filteredDisasterList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return CALAMITY_METADATA_LIST;
    return CALAMITY_METADATA_LIST.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.scientificScale.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Active filter count
  const hasActiveFilter = filteredType !== 'all' || severityFilter !== 'all';

  if (!isOpen) return null;

  return (
    <div className={`absolute z-[1200] transition-all duration-300 font-sans ${
      isMinimized
        ? 'bottom-4 right-4 w-72 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden'
        : 'bottom-4 right-4 sm:right-6 w-[94vw] sm:w-[480px] max-h-[82vh] bg-slate-950/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden text-slate-100'
    }`}>
      {/* HEADER BAR */}
      <div className="p-3 bg-gradient-to-r from-slate-900 via-slate-925 to-slate-900 border-b border-slate-800 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-100">
                Interactive Map Legend
              </span>
              {hasActiveFilter && (
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  (Filtered Active)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Visual Marker & Severity Guide • {activeEvents.length} Active Events
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                if (onSelectTypeFilter) onSelectTypeFilter('all');
                if (onSelectSeverityFilter) onSelectSeverityFilter('all');
              }}
              className="p-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Reset all filters applied from legend"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title={isMinimized ? 'Expand full legend' : 'Minimize legend'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close legend"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MINIMIZED QUICK PREVIEW DOCK (Collapsible Map Legend Overlay) */}
      {isMinimized ? (
        <div className="p-2.5 px-3 text-xs flex items-center justify-between gap-3 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-white">
              <span>Map Legend</span>
              <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(Colors & Shapes)</span>
            </div>
            {/* Quick mini color dots preview for 14 calamity types */}
            <div className="flex items-center -space-x-1 ml-1 hidden sm:flex">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900" title="Volcano / Critical" />
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-slate-900" title="Wildfire" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900" title="Earthquake" />
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900" title="Tsunami" />
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-slate-900" title="Flood" />
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-slate-900" title="Cyclone" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono ml-1">
              <span className="text-rose-400 font-bold">{eventCountsBySeverity.CRITICAL} Crit</span>
              <span>·</span>
              <span className="text-amber-400 font-bold">{eventCountsBySeverity.HIGH} High</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow cursor-pointer"
              title="Expand full map legend (Marker Colors & Intensity Shapes)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Expand</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Legend Overlay"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB NAVIGATION (Segmented Control) */}
          <div className="p-2 bg-slate-900/70 border-b border-slate-800 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('types')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'types'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Explain disaster marker colors, hex codes, and 14 hazard types"
            >
              🎨 Marker Colors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('markers')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'markers'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Explain intensity shapes: sonar pings, evacuation circles, pin geometry, and beacon dots"
            >
              ⭕ Intensity Shapes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('severity')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'severity'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Explain severity levels and evacuation mandates"
            >
              ⚠️ Severity Levels
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tactical')}
              className={`flex-1 py-1.5 px-2 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center ${
                activeTab === 'tactical'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Tactical overlays: Relief resources, Doppler radar, evacuation routes"
            >
              🛡️ Tactical Overlays
            </button>
          </div>

          {/* TAB 1: 14 DISASTER TYPES */}
          {activeTab === 'types' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search input & count header */}
              <div className="p-2.5 border-b border-slate-800 bg-slate-950/70 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search disaster types, scales (e.g. VEI, Richter, Hurricane)..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {filteredType !== 'all' && (
                  <button
                    type="button"
                    onClick={() => onSelectTypeFilter && onSelectTypeFilter('all')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer shrink-0"
                    title="Show all disaster types on map"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {/* Marker Colors Palette Overview */}
              <div className="p-2.5 bg-gradient-to-r from-slate-900 via-slate-925 to-slate-950 border-b border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-amber-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Disaster Marker Color Palette Standard</span>
                  </div>
                  <span className="font-mono text-[9px] text-slate-400">GDACS / USGS Standard</span>
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Pins follow international emergency management color codes: Crimson for Volcanoes & Thermal, Flame Orange for Wildfires, Yellow/Gold for Seismicity, Cyan for Tsunamis, and Blue for Floods. Click any card to filter the live map!
                </p>
              </div>

              {/* Scrollable Disaster Types List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-[440px]">
                <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                  <span>Click any disaster type to filter the map view</span>
                  <span className="font-mono text-[10px]">
                    {filteredDisasterList.length} categories
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredDisasterList.map((meta) => {
                    const iconMeta = EMOJI_AND_ICONS[meta.id] || { emoji: '⚠️', icon: AlertTriangle };
                    const count = eventCountsByType[meta.id] || 0;
                    const isCurrentFilter = filteredType === meta.id;
                    const isInspected = inspectedType === meta.id;

                    return (
                      <div
                        key={meta.id}
                        onClick={() => {
                          if (onSelectTypeFilter) {
                            if (filteredType === meta.id) {
                              onSelectTypeFilter('all');
                            } else {
                              onSelectTypeFilter(meta.id as CalamityType);
                            }
                          }
                          setInspectedType(inspectedType === meta.id ? null : meta.id as CalamityType);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer text-left group relative ${
                          isCurrentFilter
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg ring-1 ring-amber-400/50'
                            : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700 text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {/* Live Pin Preview */}
                            <div className="relative flex items-center justify-center shrink-0">
                              <span
                                className="absolute w-7 h-7 rounded-full opacity-60 animate-ping pointer-events-none"
                                style={{ backgroundColor: meta.color }}
                              />
                              <span
                                className="relative w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border border-white/30"
                                style={{ backgroundColor: meta.color }}
                              >
                                {iconMeta.emoji}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-100 group-hover:text-amber-300 transition-colors flex items-center gap-1.5 truncate">
                                <span>{meta.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span 
                                  className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/60 font-semibold border"
                                  style={{ color: meta.color, borderColor: `${meta.color}60` }}
                                >
                                  {meta.color}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                  {meta.scientificScale.split('(')[0].trim()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              count > 0 ? 'bg-slate-800 text-amber-300 border border-slate-700' : 'bg-slate-950 text-slate-500'
                            }`}>
                              {count} {count === 1 ? 'event' : 'events'}
                            </span>
                          </div>
                        </div>

                        {/* Collapsible / Detailed Scientific Measurement info */}
                        <div className="mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400 space-y-0.5 leading-snug">
                          <div>
                            <span className="text-slate-500">Metric: </span>
                            <span className="text-slate-300 font-mono">{meta.scientificScale}</span>
                          </div>
                          <div className="line-clamp-2 text-slate-400">
                            {meta.description}
                          </div>
                        </div>

                        {isCurrentFilter && (
                          <div className="mt-2 pt-1 border-t border-amber-500/40 text-[9px] font-bold text-amber-400 flex items-center justify-between">
                            <span>✅ FILTERED ON MAP</span>
                            <span className="underline">Click to view all</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEVERITY LEVELS */}
          {activeTab === 'severity' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px]">
              <div className="text-[11px] text-slate-400 px-1">
                Disaster severity dictates map pin size, beacon pulse rate, evacuation corridor radius, and medical response mobilization.
              </div>

              <div className="space-y-3">
                {SEVERITY_SPECS.map((spec) => {
                  const count = eventCountsBySeverity[spec.level] || 0;
                  const isFiltered = severityFilter === spec.level;

                  return (
                    <div
                      key={spec.level}
                      className={`p-3 rounded-xl border transition-all ${
                        isFiltered
                          ? 'border-amber-500 bg-slate-900 shadow-xl ring-1 ring-amber-500/50'
                          : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          {/* Live Visual Marker Representation */}
                          <div className="relative flex items-center justify-center shrink-0 w-10 h-10">
                            {spec.level === 'CRITICAL' && (
                              <span
                                className="absolute w-10 h-10 rounded-full animate-ping opacity-75 pointer-events-none"
                                style={{ backgroundColor: spec.color }}
                              />
                            )}
                            {spec.level === 'HIGH' && (
                              <span
                                className="absolute w-8 h-8 rounded-full animate-pulse opacity-50 pointer-events-none"
                                style={{ backgroundColor: spec.color }}
                              />
                            )}
                            <div
                              className="relative rounded-full flex items-center justify-center shadow-2xl border-2 border-white/60 font-bold text-white text-xs"
                              style={{
                                width: `${spec.markerSizePx}px`,
                                height: `${spec.markerSizePx}px`,
                                backgroundColor: spec.color,
                              }}
                            >
                              {spec.level === 'CRITICAL' ? '🚨' : spec.level === 'HIGH' ? '⚠️' : '⚡'}
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-100">
                                {spec.name}
                              </span>
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border"
                                style={{
                                  backgroundColor: spec.bgRgba,
                                  borderColor: spec.borderColor,
                                  color: spec.color,
                                }}
                              >
                                {spec.level}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Marker Pin: {spec.markerSizePx}px • {spec.pulseSpeed}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectSeverityFilter) {
                                onSelectSeverityFilter(isFiltered ? 'all' : spec.level);
                              }
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors border ${
                              isFiltered
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                            }`}
                          >
                            {isFiltered ? 'Filtered' : `Filter (${count})`}
                          </button>
                        </div>
                      </div>

                      {/* Criteria & Protocol details */}
                      <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] space-y-1.5">
                        <div>
                          <span className="text-slate-400 font-semibold">Impact Criteria: </span>
                          <span className="text-slate-200">{spec.criteria}</span>
                        </div>
                        <div>
                          <span className="text-amber-400 font-semibold">Evacuation Mandate: </span>
                          <span className="text-slate-300">{spec.evacuationMandate}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-500">Response Protocol: </span>
                          {spec.operationalAction}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INTENSITY SHAPES & DYNAMIC HALOS */}
          {activeTab === 'markers' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px]">
              <div className="text-[11px] text-slate-400 px-1">
                Visual explanation of disaster marker shapes, concentric evacuation rings, seismic sonar pings, and tactical map symbols.
              </div>

              <div className="space-y-2.5">
                {/* 1. Sonar Radar Ping & Epicenter Wave */}
                <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/20 flex items-start gap-3">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <span className="absolute w-12 h-12 rounded-full bg-amber-400/25 animate-ping" />
                    <span className="absolute w-8 h-8 rounded-full border-2 border-amber-400 animate-pulse" />
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-300 ring-4 ring-amber-500/80 shadow-[0_0_15px_#f59e0b]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-amber-300">Sonar Radar Ping & Hypocenter Wave (⭕)</span>
                      <span className="text-[9px] font-mono px-1 bg-amber-900/60 text-amber-200 rounded">Active Rupture</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Expanding circular sonar ripple rendered over the coordinates of active ground motion ruptures, volcanic explosive columns, or whenever clicking <strong>Locate on Map</strong>. Highlights the exact hypocenter vector.
                    </div>
                  </div>
                </div>

                {/* 2. Evacuation Buffer Zone (Dashed Perimeter Circle) */}
                <div className="p-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/20 flex items-start gap-3">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-500/15 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-cyan-300">50km</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-cyan-300">Evacuation Buffer Zone (Dashed Perimeter Circle)</span>
                      <span className="text-[9px] font-mono px-1 bg-cyan-900/60 text-cyan-200 rounded">Footprint Radius</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Concentric dashed perimeter boundary surrounding disaster epicenters. Its radius dynamically scales to match the official civil defense evacuation mandate (e.g. 5 km, 20 km, 50 km).
                    </div>
                  </div>
                </div>

                {/* 3. Marker Pin Geometry: Hexagonal Shield vs Circular Pin */}
                <div className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0 py-1">
                    <div className="w-7 h-7 rounded-lg rotate-45 bg-rose-600 border border-rose-400 flex items-center justify-center shadow-lg">
                      <span className="-rotate-45 text-[9px] font-black text-white">CRIT</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-amber-500 border border-amber-300 flex items-center justify-center text-[9px] text-slate-950 font-black">
                      HIGH
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-100">Pin Geometry: Hexagonal Shield vs Circular Badge</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      <strong>CRITICAL</strong> events use a diamond/hexagonal shield pin with high-frequency pulsating beacons to command immediate field responder attention. <strong>HIGH</strong>, <strong>MODERATE</strong>, and <strong>ADVISORY</strong> events use rounded circular pins.
                    </div>
                  </div>
                </div>
                {/* 1. Local Hazard Alert Halo */}
                <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-950/20 flex items-start gap-3">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <span className="absolute w-12 h-12 rounded-full bg-rose-500/60 animate-ping" />
                    <span className="relative w-7 h-7 rounded-full bg-rose-600 ring-4 ring-rose-400 flex items-center justify-center text-xs text-white font-bold animate-pulse">
                      🚨
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-rose-300">500km Local Hazard Beacon (🚨)</span>
                      <span className="text-[9px] font-mono px-1 bg-rose-900/60 text-rose-200 rounded">500km Range</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Triggered when an active <strong>CRITICAL</strong> disaster occurs within <strong>500 km</strong> of your current GPS or simulated coordinates. A 56px red warning halo radiates with an anchored <code className="text-rose-400 font-mono text-[10px]">🚨 LOCAL HAZARD (X km)</code> badge.
                    </div>
                  </div>
                </div>

                {/* 2. Live Telemetry Beacon Dot */}
                <div className="p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 flex items-start gap-3">
                  <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                    <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-xs">
                      🌊
                    </div>
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-emerald-300">Live Telemetry Dot (🟢)</span>
                      <span className="text-[9px] font-mono px-1 bg-emerald-900/60 text-emerald-200 rounded">Real-Time</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Pulsing emerald indicator placed at the top-right corner of the pin. Indicates that satellite telemetry (e.g., Sentinel-2, NOAA GOES, MODIS thermal flux) was updated within the last 15–60 minutes.
                    </div>
                  </div>
                </div>

                {/* 3. Searched Location Sector Halo */}
                <div className="p-2.5 rounded-xl border border-amber-500/40 bg-amber-950/20 flex items-start gap-3">
                  <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                    <div className="w-6 h-6 rounded-full bg-amber-600 ring-4 ring-amber-400 animate-bounce flex items-center justify-center text-xs">
                      🌋
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-amber-300">Searched Location Halo (🟡)</span>
                      <span className="text-[9px] font-mono px-1 bg-amber-900/60 text-amber-200 rounded">Search Target</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Amber animated bounce halo encircling calamities located within a <strong>450 km sector</strong> of the city, country, or coordinates queried in the map search box.
                    </div>
                  </div>
                </div>

                {/* 4. Actively Selected Event Halo */}
                <div className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 flex items-start gap-3">
                  <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                    <div className="w-6 h-6 rounded-full bg-orange-600 ring-4 ring-white scale-125 flex items-center justify-center text-xs">
                      🔥
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-100">Selected Event Focus Ring (⚪)</span>
                      <span className="text-[9px] font-mono px-1 bg-slate-800 text-slate-300 rounded">Active Inspection</span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                      Double solid white ring with a 1.25x magnification scale applied to the currently inspected calamity, accompanied by the bottom Mission Clock HUD and telemetry card.
                    </div>
                  </div>
                </div>

                {/* 5. Date & Time Tag on Map Pin Surface */}
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center shrink-0 w-16">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px]">
                      💧
                    </div>
                    <div className="mt-1 px-1 py-0.5 rounded bg-slate-950 border border-slate-700 text-[8px] font-mono text-amber-300 text-center whitespace-nowrap">
                      📅 10-12 ⏰ 14:30
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-200">Epicenter Date/Time Sub-Tag</span>
                      {onToggleDateTimeTags && (
                        <button
                          type="button"
                          onClick={onToggleDateTimeTags}
                          className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                        >
                          Toggle: {showDateTimeTags ? 'ON' : 'OFF'}
                        </button>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      Displays the exact local solar date and hour of the event directly beneath the map pin in real-time coordinates.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TACTICAL & RELIEF OVERLAYS */}
          {activeTab === 'tactical' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px]">
              <div className="text-[11px] text-slate-400 px-1">
                Visual symbols for humanitarian facilities, evacuation routes, population risk contours, and environmental radar.
              </div>

              <div className="space-y-2.5">
                {/* Emergency Relief Facilities */}
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                      <span>🏥</span> Relief Infrastructure Symbols
                    </span>
                    {onToggleResources && (
                      <button
                        type="button"
                        onClick={onToggleResources}
                        className="text-[10px] text-emerald-300 hover:underline font-semibold cursor-pointer"
                      >
                        Layer: {showResources ? 'ACTIVE' : 'OFF'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                    <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px]">
                        ⛺
                      </span>
                      <div>
                        <div className="font-bold text-slate-200 text-[11px]">Shelters</div>
                        <div className="text-[9px] text-slate-400">Safe Havens</div>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-[10px]">
                        💧
                      </span>
                      <div>
                        <div className="font-bold text-slate-200 text-[11px]">Water Points</div>
                        <div className="text-[9px] text-slate-400">Potable Supply</div>
                      </div>
                    </div>

                    <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-[10px]">
                        🏥
                      </span>
                      <div>
                        <div className="font-bold text-slate-200 text-[11px]">Medical</div>
                        <div className="text-[9px] text-slate-400">Trauma Units</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evacuation Distance Tool Symbols */}
                <div className="p-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/20 space-y-1.5">
                  <div className="font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                    <span>📏</span> Evacuation Path Measurement Tool
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono font-bold flex items-center justify-center text-[10px]">
                        A
                      </span>
                      <div>
                        <span className="font-semibold text-slate-200">Point A</span>
                        <div className="text-[9px] text-slate-400">Origin / Citizen Pin</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-mono font-bold flex items-center justify-center text-[10px]">
                        B
                      </span>
                      <div>
                        <span className="font-semibold text-slate-200">Point B</span>
                        <div className="text-[9px] text-slate-400">Target / Safe Haven</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                    <span className="text-cyan-400 font-bold">--- Cyan Dashed Line:</span> Geodesic Great Circle evacuation path with live distance in km, miles & transit times (Foot, Cycle, Convoy, Air).
                  </div>
                </div>

                {/* Population Heatmap & Weather Radar */}
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-bold text-xs text-slate-200">Humanitarian Exposure Heatmap</div>
                        <div className="text-[10px] text-slate-400">Color gradient: Yellow (100k) to Deep Crimson (&gt;1M exposed)</div>
                      </div>
                    </div>
                    {onToggleHeatmap && (
                      <button
                        type="button"
                        onClick={onToggleHeatmap}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                      >
                        {showHeatmap ? 'ON' : 'OFF'}
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="font-bold text-xs text-slate-200">Real-Time Weather Radar</div>
                        <div className="text-[10px] text-slate-400">RainViewer Doppler precipitation & wind patterns</div>
                      </div>
                    </div>
                    {onToggleWeatherRadar && (
                      <button
                        type="button"
                        onClick={onToggleWeatherRadar}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                      >
                        {showWeatherRadar ? 'ON' : 'OFF'}
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Satellite className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="font-bold text-xs text-slate-200">Real-Time Cloud Coverage (Satellite)</div>
                        <div className="text-[10px] text-slate-400">NASA EOSDIS GIBS VIIRS/MODIS cloud cover & cyclonic storms</div>
                      </div>
                    </div>
                    {onToggleWeatherSatellite && (
                      <button
                        type="button"
                        onClick={onToggleWeatherSatellite}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          showWeatherSatellite
                            ? 'bg-emerald-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {showWeatherSatellite ? 'ACTIVE' : 'OFF'}
                      </button>
                    )}
                  </div>

                  {/* Real-time Satellite Thermal Anomalies (NASA FIRMS) */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <div>
                        <div className="font-bold text-xs text-orange-300">Thermal Anomalies & Wildfire Radiance</div>
                        <div className="text-[10px] text-slate-400">NASA FIRMS VIIRS 375m & MODIS active fire radiance (FRP in MW)</div>
                      </div>
                    </div>
                    {onToggleThermalAnomalies && (
                      <button
                        type="button"
                        onClick={onToggleThermalAnomalies}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          showThermalAnomalies
                            ? 'bg-orange-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {showThermalAnomalies ? 'ACTIVE' : 'OFF'}
                      </button>
                    )}
                  </div>

                  {/* 50km Hazard Radius & Impact Zone */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-dashed bg-amber-500/20 flex items-center justify-center text-[9px] text-amber-300 font-bold shrink-0 font-mono">
                        50k
                      </div>
                      <div>
                        <div className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                          <span>50 km Event Hazard Radius Circle</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Impact perimeter (~7,854 km²) around selected disaster marker</div>
                      </div>
                    </div>
                    {onToggleHazardRadius && (
                      <button
                        type="button"
                        onClick={onToggleHazardRadius}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                          showHazardRadius
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {showHazardRadius ? 'ACTIVE' : 'OFF'}
                      </button>
                    )}
                  </div>

                  {/* Base Map Tile Layers & Disaster Visibility */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                        <span>🗺️</span> Base Map Layers & Disaster Visibility
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Current: <strong className="text-white capitalize">{activeLayerKey}</strong></span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                      {/* Terrain */}
                      <div
                        onClick={() => onChangeLayerKey?.('terrain')}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          activeLayerKey === 'terrain'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>⛰️ Terrain</span>
                          {activeLayerKey === 'terrain' && <span className="text-[9px] text-amber-400 font-mono">ACTIVE</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          Contour lines & elevation. Best for floods, tsunamis & landslides.
                        </p>
                      </div>

                      {/* Satellite */}
                      <div
                        onClick={() => onChangeLayerKey?.('satellite')}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          activeLayerKey === 'satellite'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>🛰️ Satellite</span>
                          {activeLayerKey === 'satellite' && <span className="text-[9px] text-amber-400 font-mono">ACTIVE</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          Optical imagery. Best for wildfires, burn perimeters & cyclones.
                        </p>
                      </div>

                      {/* Dark */}
                      <div
                        onClick={() => onChangeLayerKey?.('dark')}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          activeLayerKey === 'dark'
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span>🌑 Dark Mode</span>
                          {activeLayerKey === 'dark' && <span className="text-[9px] text-amber-400 font-mono">ACTIVE</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          Nocturnal canvas. Best for night rescue, FIRMS hotspots & low-glare.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER BAR WITH SUMMARY */}
          <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>{eventCountsBySeverity.CRITICAL} Critical</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{eventCountsBySeverity.HIGH} High</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>{eventCountsBySeverity.MODERATE} Moderate</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] cursor-pointer"
            >
              Close Legend
            </button>
          </div>
        </>
      )}
    </div>
  );
};
