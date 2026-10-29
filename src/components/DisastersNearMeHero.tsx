import React, { useState } from 'react';
import { CalamityEvent } from '../types/disaster';
import { UserGeoLocation, calculatePreciseDistanceKm, requestBrowserLocation } from '../utils/geolocationUtils';
import { triggerLocationLockHaptic, triggerActionHaptic, triggerCriticalAlertHaptic } from '../utils/hapticsService';
import { 
  ShieldCheck, 
  AlertTriangle, 
  MapPin, 
  Locate, 
  Clock, 
  ExternalLink, 
  ChevronRight, 
  Sparkles,
  Zap,
  Flame,
  Activity,
  Waves,
  RefreshCw
} from 'lucide-react';

interface DisastersNearMeHeroProps {
  events: CalamityEvent[];
  userLocation: UserGeoLocation | null;
  onUserLocationChange: (loc: UserGeoLocation | null) => void;
  onSelectEvent: (event: CalamityEvent) => void;
  activeQuickFilter: 'near_me' | '24h' | 'biggest' | 'all';
  onQuickFilterChange: (filter: 'near_me' | '24h' | 'biggest' | 'all') => void;
  onRefreshFeeds?: () => void;
  isLoadingLive?: boolean;
}

export const DisastersNearMeHero: React.FC<DisastersNearMeHeroProps> = ({
  events,
  userLocation,
  onUserLocationChange,
  onSelectEvent,
  activeQuickFilter,
  onQuickFilterChange,
  onRefreshFeeds,
  isLoadingLive,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleAcquireLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const loc = await requestBrowserLocation();
      triggerLocationLockHaptic();
      onUserLocationChange(loc);
      onQuickFilterChange('near_me');
    } catch (err: any) {
      setLocationError(err?.message || 'Unable to access your location. Try picking a city below.');
    } finally {
      setIsLocating(false);
    }
  };

  // Evaluate real incidents relative to user location
  const proximityData = React.useMemo(() => {
    if (!userLocation) return null;

    const itemsWithDist = events.map((ev) => {
      const distKm = calculatePreciseDistanceKm(
        userLocation.lat,
        userLocation.lng,
        ev.coordinates.lat,
        ev.coordinates.lng
      );
      return { event: ev, distKm: Math.round(distKm) };
    }).sort((a, b) => a.distKm - b.distKm);

    const within50Km = itemsWithDist.filter(i => i.distKm <= 50);
    const within150Km = itemsWithDist.filter(i => i.distKm <= 150);
    const within500Km = itemsWithDist.filter(i => i.distKm <= 500);
    const nearest = itemsWithDist[0] || null;

    return {
      nearest,
      within50Km,
      within150Km,
      within500Km,
      hasImmediateDanger: within50Km.length > 0,
      hasNearbyAdvisory: within150Km.length > 0,
    };
  }, [events, userLocation]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md space-y-4">
      {/* Primary Question Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Real-Time Community Safety Check
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
            What disasters are near me right now?
          </h2>
        </div>

        {/* Location badge or button */}
        <div className="flex items-center gap-2">
          {userLocation ? (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[200px]">
                {userLocation.name || `${userLocation.lat.toFixed(2)}°, ${userLocation.lng.toFixed(2)}°`}
              </span>
              <button
                onClick={handleAcquireLocation}
                disabled={isLocating}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold ml-1 cursor-pointer"
                title="Update location"
              >
                {isLocating ? '...' : 'Change'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleAcquireLocation}
              disabled={isLocating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
            >
              <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locating...' : 'Use My Current Location'}</span>
            </button>
          )}

          {onRefreshFeeds && (
            <button
              onClick={() => {
                triggerActionHaptic();
                onRefreshFeeds();
              }}
              disabled={isLoadingLive}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
              title="Refresh live disaster feeds"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${isLoadingLive ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Answer Body: Clear, Non-Technical Language */}
      {userLocation ? (
        <div>
          {proximityData && proximityData.hasNearbyAdvisory ? (
            <div className="p-3.5 sm:p-4 rounded-xl bg-rose-950/80 border-2 border-rose-500/80 text-rose-100 shadow-xl shadow-rose-950/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm sm:text-base text-rose-300">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                  <span>
                    ⚠️ {proximityData.within150Km.length} active disaster{proximityData.within150Km.length > 1 ? 's' : ''} detected near your area!
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">
                  Immediate Advisory
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {proximityData.within150Km.slice(0, 2).map(({ event, distKm }) => (
                  <div 
                    key={event.id}
                    onClick={() => onSelectEvent(event)}
                    className="p-3 rounded-lg bg-slate-950/90 border border-rose-500/40 hover:border-rose-400 transition-all cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs truncate max-w-[200px]">
                        {event.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-black bg-rose-900/80 text-rose-200">
                        {distKm} km away
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      📍 {event.city}, {event.country}
                    </div>
                    <div className="text-[10px] text-amber-300 font-mono">
                      Source: {event.source} • {event.liveIngestionTime || 'Just now'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-100 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-emerald-300">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Safe right now: No active disasters detected within 150 km of your location.</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Checked against live satellite, seismic, and weather feeds from USGS and NASA. 
                {proximityData?.nearest && (
                  <span className="text-slate-200 ml-1">
                    The nearest active incident is <strong>{proximityData.nearest.distKm} km away</strong> ({proximityData.nearest.event.name}).
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-200">Want to see incidents closest to you?</span>
            <p className="text-slate-400 text-[11px]">
              Tap "Use My Current Location" or pick a sample location:
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
              { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
              { name: 'Manila, Philippines', lat: 14.5995, lng: 120.9842 },
              { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964 },
            ].map(city => (
              <button
                key={city.name}
                onClick={() => {
                  triggerActionHaptic();
                  onUserLocationChange({
                    lat: city.lat,
                    lng: city.lng,
                    name: city.name,
                    source: 'preset',
                    timestamp: Date.now(),
                  });
                  onQuickFilterChange('near_me');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer border border-slate-700"
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {locationError && (
        <p className="text-xs text-rose-400 font-medium">
          {locationError}
        </p>
      )}

      {/* Requirement 6: Quick Buttons */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-bold text-slate-400 mr-1 hidden sm:inline">Quick Filters:</span>
          
          <button
            onClick={() => {
              triggerActionHaptic();
              if (!userLocation) {
                handleAcquireLocation();
              } else {
                onQuickFilterChange('near_me');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              activeQuickFilter === 'near_me'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Near me</span>
          </button>

          <button
            onClick={() => {
              triggerActionHaptic();
              onQuickFilterChange('24h');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              activeQuickFilter === '24h'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Last 24 hours</span>
          </button>

          <button
            onClick={() => {
              triggerActionHaptic();
              onQuickFilterChange('biggest');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              activeQuickFilter === 'biggest'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Biggest today</span>
          </button>

          {activeQuickFilter !== 'all' && (
            <button
              onClick={() => {
                triggerActionHaptic();
                onQuickFilterChange('all');
              }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 font-semibold cursor-pointer underline"
            >
              Show all ({events.length})
            </button>
          )}
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Showing verified USGS & NASA data
        </span>
      </div>
    </div>
  );
};
