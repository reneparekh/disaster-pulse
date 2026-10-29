import React, { useState, useMemo } from 'react';
import { CalamityEvent } from '../types/disaster';
import { UserGeoLocation, calculatePreciseDistanceKm, requestBrowserLocation } from '../utils/geolocationUtils';
import { triggerLocationLockHaptic, triggerWarningHaptic, triggerCriticalAlertHaptic } from '../utils/hapticsService';
import { 
  ShieldAlert, 
  MapPin, 
  Locate, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Radio, 
  Clock, 
  Maximize2, 
  Building2, 
  PhoneCall, 
  Sparkles,
  Layers,
  Eye,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Compass
} from 'lucide-react';

interface HazardProximityHeroProps {
  events: CalamityEvent[];
  userLocation: UserGeoLocation | null;
  onUserLocationChange: (loc: UserGeoLocation | null) => void;
  onFocusEventOnMap: (event: CalamityEvent) => void;
  isSpecialistMode: boolean;
  onToggleSpecialistMode: () => void;
  staleFeedWarning?: string | null;
}

const CITY_PRESETS = [
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
  { name: 'San Francisco, USA', lat: 37.7749, lng: -122.4194 },
  { name: 'Valencia, Spain', lat: 39.4699, lng: -0.3763 },
  { name: 'Jakarta / Java, Indonesia', lat: -6.2088, lng: 106.8456 },
  { name: 'Miami, Florida, USA', lat: 25.7617, lng: -80.1918 },
  { name: 'Manila, Philippines', lat: 14.5995, lng: 120.9842 },
];

export const HazardProximityHero: React.FC<HazardProximityHeroProps> = ({
  events,
  userLocation,
  onUserLocationChange,
  onFocusEventOnMap,
  isSpecialistMode,
  onToggleSpecialistMode,
  staleFeedWarning,
}) => {
  const [cityInput, setCityInput] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Acquire Browser Geolocation with high-accuracy to network fallback
  const handleAcquireLocation = async () => {
    setIsLocating(true);
    setLocationError(null);

    try {
      const loc = await requestBrowserLocation();
      triggerLocationLockHaptic();
      onUserLocationChange(loc);
    } catch (err: any) {
      setLocationError(err?.message || 'Could not acquire location. Try selecting a quick city preset.');
    } finally {
      setIsLocating(false);
    }
  };

  // Evaluate hazards relative to user's location
  const proximityAssessment = useMemo(() => {
    if (!userLocation) return null;

    const itemsWithDist = events.map((ev) => {
      const distKm = calculatePreciseDistanceKm(
        userLocation.lat,
        userLocation.lng,
        ev.coordinates.lat,
        ev.coordinates.lng
      );
      return { event: ev, distKm: +distKm.toFixed(1) };
    }).sort((a, b) => a.distKm - b.distKm);

    const nearest = itemsWithDist[0] || null;
    const within25Km = itemsWithDist.filter((i) => i.distKm <= 25);
    const within100Km = itemsWithDist.filter((i) => i.distKm <= 100);
    const within500Km = itemsWithDist.filter((i) => i.distKm <= 500);

    let dangerLevel: 'DANGER_IMMEDIATE' | 'ADVISORY_NEARBY' | 'WATCH_REGIONAL' | 'CLEAR' = 'CLEAR';
    if (within25Km.length > 0) {
      dangerLevel = 'DANGER_IMMEDIATE';
    } else if (within100Km.length > 0) {
      dangerLevel = 'ADVISORY_NEARBY';
    } else if (within500Km.length > 0) {
      dangerLevel = 'WATCH_REGIONAL';
    }

    return {
      nearest,
      within25Km,
      within100Km,
      within500Km,
      dangerLevel,
    };
  }, [userLocation, events]);

  const handleCitySelect = (preset: typeof CITY_PRESETS[0]) => {
    onUserLocationChange({
      lat: preset.lat,
      lng: preset.lng,
      name: preset.name,
      source: 'preset',
      timestamp: Date.now(),
      isSimulated: true,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim()) return;

    // Search against presets or known hubs
    const match = CITY_PRESETS.find((p) =>
      p.name.toLowerCase().includes(cityInput.toLowerCase())
    );
    if (match) {
      handleCitySelect(match);
      setCityInput('');
    } else {
      setLocationError(`Could not find "${cityInput}". Pick from the quick presets below.`);
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-slate-800 p-4 sm:p-5 shadow-2xl space-y-4 relative overflow-hidden">
      {/* Ambient background glow depending on danger state */}
      <div 
        className={`absolute -top-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          proximityAssessment?.dangerLevel === 'DANGER_IMMEDIATE'
            ? 'bg-rose-600/15'
            : proximityAssessment?.dangerLevel === 'ADVISORY_NEARBY'
            ? 'bg-amber-600/15'
            : 'bg-emerald-600/10'
        }`}
      />

      {/* Top Bar: Problem Statement & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
              <Compass className="w-3 h-3 text-amber-400" />
              CIVIL DEFENSE PROXIMITY CHECK
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Official USGS, GDACS & NASA Bulletins
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            What hazards are near me right now?
          </h2>
        </div>

        {/* User Persona Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0 font-bold">
          <button
            onClick={() => { if (isSpecialistMode) onToggleSpecialistMode(); }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              !isSpecialistMode
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Citizen Mode: Personal hazard distance, clear instructions, no technical jargon"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Citizen Safety</span>
          </button>
          <button
            onClick={() => { if (!isSpecialistMode) onToggleSpecialistMode(); }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              isSpecialistMode
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Specialist Mode: InSAR coherence, DEM gradients, spectral indices, and GeoJSON exports"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Geospatial Specialist</span>
          </button>
        </div>
      </div>

      {/* Stale Feed Warning Banner if feed is lagging */}
      {staleFeedWarning && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2.5 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">⚠️ Data Freshness Notice:</span>
            <p className="text-[11px] text-amber-300/90 leading-tight">
              {staleFeedWarning} Satellite and meteorological feeds operate on cyclical orbital passes (typically 3-6 hours). Always follow live instructions from local emergency authorities.
            </p>
          </div>
        </div>
      )}

      {/* Location Input Form: GPS or City Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 relative z-10">
        <div className="lg:col-span-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Action 1: Geolocation Button */}
          <button
            onClick={handleAcquireLocation}
            disabled={isLocating}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
          >
            <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Acquiring GPS Coordinates...' : 'Detect My Location'}</span>
          </button>

          {/* Action 2: City Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-amber-400">
            <Search className="w-4 h-4 text-slate-500 shrink-0 mr-2" />
            <input
              type="text"
              placeholder="Or type a city (e.g. Tokyo, Miami, Valencia)..."
              value={cityInput}
              onChange={(e) => setCityInput(e.target.value)}
              className="w-full bg-transparent text-slate-200 placeholder-slate-500 text-xs focus:outline-none"
            />
            {cityInput && (
              <button
                type="submit"
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
              >
                Go
              </button>
            )}
          </form>
        </div>

        {/* Location Presets */}
        <div className="lg:col-span-4 flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-[10px]">
          <span className="text-slate-500 font-mono font-bold uppercase shrink-0">Presets:</span>
          {CITY_PRESETS.slice(0, 3).map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleCitySelect(p)}
              className={`px-2 py-1 rounded-lg border font-mono transition-all cursor-pointer whitespace-nowrap ${
                userLocation?.name === p.name
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.name.split(',')[0]}
            </button>
          ))}
        </div>
      </div>

      {locationError && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2 rounded-lg">
          {locationError}
        </div>
      )}

      {/* Real-time Proximity Diagnostic Panel */}
      {userLocation && proximityAssessment && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative z-10 animate-fadeIn">
          {/* Status Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-300 font-mono">
                Monitoring location: <strong className="text-white">{userLocation.name}</strong> ({userLocation.lat.toFixed(4)}°N, {userLocation.lng.toFixed(4)}°E)
              </span>
            </div>

            {/* Severity Pill */}
            <div>
              {proximityAssessment.dangerLevel === 'DANGER_IMMEDIATE' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  🚨 IMMEDIATE HAZARD ZONE (&lt; 25 KM)
                </span>
              ) : proximityAssessment.dangerLevel === 'ADVISORY_NEARBY' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30">
                  <span className="w-2 h-2 rounded-full bg-slate-950"></span>
                  ⚠️ HAZARD IN REGION (&lt; 100 KM)
                </span>
              ) : proximityAssessment.dangerLevel === 'WATCH_REGIONAL' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  <span>ℹ️</span> MONITORING SECTOR (100 - 500 KM)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  SAFE ZONE: NO ACTIVE CALAMITIES WITHIN 500 KM
                </span>
              )}
            </div>
          </div>

          {/* Nearest Threat Deep Dive Card */}
          {proximityAssessment.nearest && (
            <div className={`p-3.5 rounded-xl border transition-all ${
              proximityAssessment.nearest.distKm <= 25
                ? 'bg-rose-950/30 border-rose-500/60'
                : proximityAssessment.nearest.distKm <= 100
                ? 'bg-amber-950/30 border-amber-500/50'
                : 'bg-slate-900 border-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                      Nearest Hazard:
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-black font-mono ${
                      proximityAssessment.nearest.distKm <= 25 ? 'bg-rose-600 text-white' :
                      proximityAssessment.nearest.distKm <= 100 ? 'bg-amber-500 text-slate-950' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {proximityAssessment.nearest.distKm} km away
                    </span>
                    <span className="text-xs text-slate-400">
                      • {proximityAssessment.nearest.event.type.toUpperCase()} ({proximityAssessment.nearest.event.country})
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">
                    {proximityAssessment.nearest.event.name}
                  </h3>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    <strong>Official Directives: </strong>
                    {proximityAssessment.nearest.event.publicAdvisory.immediateAction}
                  </p>
                </div>

                {/* Map Focus Action */}
                <button
                  type="button"
                  onClick={() => onFocusEventOnMap(proximityAssessment.nearest!.event)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-md"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Inspect On Map</span>
                </button>
              </div>

              {/* Official Source & Metadata Bar */}
              <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Source: <strong>{proximityAssessment.nearest.event.source}</strong></span>
                  {proximityAssessment.nearest.event.rawFeedUrl && (
                    <a
                      href={proximityAssessment.nearest.event.rawFeedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      Official Agency Bulletin <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span>Contact: <strong className="text-slate-200">{proximityAssessment.nearest.event.publicAdvisory.emergencyContact}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
