import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { CalamityEvent, CalamityType, SeverityLevel } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { MapLegend } from './MapLegend';
import { formatIncidentUTC, formatTimeElapsed, formatIncidentDateTime, resolveDisasterLocalClock } from '../utils/dateUtils';
import { 
  GLOBAL_POPULATION_HUBS, 
  analyzeCatastropheHumanitarianImpact, 
  CatastropheHumanitarianImpact 
} from '../data/populationData';
import { 
  UserGeoLocation, 
  TEST_LOCATION_PRESETS, 
  calculateDistanceKm, 
  calculatePreciseDistanceKm,
  interpolateGreatCirclePoints,
  findNearbyHazards, 
  requestBrowserLocation,
  LocalHazardInfo,
  formatGisCoordinates,
  calculateUtmZone
} from '../utils/geolocationUtils';
import {
  EmergencyResource,
  EmergencyResourceType,
  generateViewportEmergencyResources,
  calculateViewportResourceSummary,
  ViewportResourceSummary
} from '../utils/emergencyResources';
import { 
  Layers, 
  MapPin, 
  ExternalLink, 
  ShieldAlert, 
  Satellite, 
  Compass, 
  Clock, 
  Users, 
  HeartPulse, 
  AlertTriangle, 
  Flame,
  Mountain,
  Eye, 
  EyeOff, 
  ChevronUp, 
  ChevronDown, 
  SlidersHorizontal,
  Locate,
  Navigation,
  Crosshair,
  Radio,
  Check,
  X,
  Target,
  Globe,
  Package,
  Tent,
  Droplets,
  Building2,
  RefreshCw,
  Phone,
  Search,
  Loader2,
  Sparkles,
  Maximize2,
  Minimize2,
  Ruler,
  Route,
  Milestone,
  ArrowRightLeft,
  CloudRain,
  Cloud,
  CloudSun,
  Thermometer,
  Play,
  Brain,
  Info,
  Copy,
  Sliders
} from 'lucide-react';
import { 
  searchLocationWithLiveEvents, 
  GeocodingResult, 
  findEventsNearCoordinates,
  findNearestEvent
} from '../utils/geocodingService';
import { 
  generateMLHazardHotspots, 
  filterPredictiveHotspots 
} from '../services/mlHazardForecastService';
import { 
  PredictiveHotspot, 
  ForecastHorizon 
} from '../types/mlForecasting';
import {
  ThermalAnomaly,
  ThermalAnomalySummary,
  generateThermalAnomalies,
  filterThermalAnomalies,
  calculateThermalSummary
} from '../services/thermalAnomalyService';
import { StaleDataBanner } from './StaleDataBanner';
import { MapLayers, MapLayerKey } from './MapLayers';
import { LiveFeedStats } from '../services/liveFeedService';
import { copyToClipboard } from '../utils/clipboardUtils';
import { 
  triggerMapMarkerTapHaptic, 
  triggerCriticalAlertHaptic, 
  triggerWarningHaptic, 
  triggerMeasurePointHaptic, 
  triggerMeasureCompleteHaptic, 
  triggerLocationLockHaptic, 
  triggerResourceMarkerHaptic, 
  triggerActionHaptic 
} from '../utils/hapticsService';

export interface MeasurePoint {
  lat: number;
  lng: number;
  label?: string;
  source?: 'map_click' | 'user_location' | 'calamity' | 'preset';
}

interface DisasterMapProps {
  events: CalamityEvent[];
  allEvents?: CalamityEvent[];
  selectedEvent: CalamityEvent | null;
  onSelectEvent: (event: CalamityEvent) => void;
  onClearSelectedEvent?: () => void;
  filteredType: CalamityType | 'all';
  onResetTypeFilter?: () => void;
  onTypeFilterChange?: (type: CalamityType | 'all') => void;
  userLocation?: UserGeoLocation | null;
  onUserLocationChange?: (location: UserGeoLocation | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onNavigateToForecast?: () => void;
  feedStats?: LiveFeedStats;
  isLoadingLive?: boolean;
  onRefreshFeeds?: () => Promise<void> | void;
  staleThresholdMinutes?: number;
  isPowerSaverMode?: boolean;
}

// Simple, distinct emoji/icon and color mapping for all 14 calamity types
const CALAMITY_MAP_ICONS: Record<string, { emoji: string; label: string; color: string }> = {
  volcano: { emoji: '🌋', label: 'Volcano', color: '#ef4444' },
  tsunami: { emoji: '🌊', label: 'Tsunami', color: '#06b6d4' },
  earthquake: { emoji: '📈', label: 'Earthquake', color: '#f97316' },
  wildfire: { emoji: '🔥', label: 'Wildfire', color: '#ea580c' },
  virus: { emoji: '☣️', label: 'Virus/Pathogen', color: '#a855f7' },
  landslide: { emoji: '⛰️', label: 'Landslide', color: '#ca8a04' },
  avalanche: { emoji: '❄️', label: 'Avalanche', color: '#38bdf8' },
  cyclone: { emoji: '🌀', label: 'Cyclone', color: '#06b6d4' },
  tornado: { emoji: '🌪️', label: 'Tornado', color: '#f43f5e' },
  flood: { emoji: '💧', label: 'Flood', color: '#3b82f6' },
  drought: { emoji: '☀️', label: 'Drought', color: '#eab308' },
  blizzard: { emoji: '🌨️', label: 'Blizzard', color: '#7dd3fc' },
  extreme_temp: { emoji: '🌡️', label: 'Extreme Temp', color: '#f97316' },
  pandemic: { emoji: '🌐', label: 'Pandemic', color: '#a855f7' },
};

export const TILE_LAYERS = {
  osm: {
    id: 'osm',
    name: 'OpenStreetMap Standard',
    shortName: 'OSM',
    description: 'Clean, detailed street-level mapping worldwide',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    id: 'satellite',
    name: 'Esri World Imagery',
    shortName: 'Satellite',
    description: 'High-resolution global satellite imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
    subdomains: ['a', 'b', 'c'],
  },
  terrain: {
    id: 'terrain',
    name: 'OpenTopoMap',
    shortName: 'Terrain',
    description: 'Topographic maps with contour lines and elevation',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
  },
  dark: {
    id: 'dark',
    name: 'CartoDB Dark Matter',
    shortName: 'Dark',
    description: 'Elegant dark theme for night operations',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  light: {
    id: 'light',
    name: 'CartoDB Positron',
    shortName: 'Light',
    description: 'Clean light theme for clarity',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  voyager: {
    id: 'voyager',
    name: 'CartoDB Voyager',
    shortName: 'Voyager',
    description: 'Colorful, modern mapping style',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  natgeo: {
    id: 'natgeo',
    name: 'Esri National Geographic',
    shortName: 'NatGeo',
    description: 'National Geographic styled maps',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, NatGeo, Garmin, HERE, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO',
    maxZoom: 16,
    subdomains: ['a', 'b', 'c'],
  },
  humanitarian: {
    id: 'humanitarian',
    name: 'HOT OSM Humanitarian',
    shortName: 'HOT',
    description: 'Humanitarian OpenStreetMap Team style',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
};

/**
 * Defensively flies the Leaflet map to the specified target coordinates and zoom level.
 * Prevents "Invalid LatLng object: (NaN, NaN)" exceptions triggered when:
 * 1. Coordinates contain NaN or non-finite values.
 * 2. The map DOM container has 0x0 size (unmeasured / initial render / hidden tab), causing divide-by-zero in Leaflet's flyTo math.
 * 3. Zoom level is NaN, uninitialized, or invalid.
 * 4. The Leaflet instance is not yet fully loaded or was disposed.
 */
function safeFlyTo(
  map: L.Map | null | undefined,
  lat: number | undefined | null,
  lng: number | undefined | null,
  targetZoom?: number | null,
  options?: L.ZoomPanOptions & { duration?: number }
): void {
  if (!map) return;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  // Ensure map is still attached and loaded
  if (!(map as any)._loaded || !(map as any)._container) {
    try {
      const fallbackZoom = Number.isFinite(targetZoom) ? (targetZoom as number) : 5.5;
      map.setView([lat, lng], fallbackZoom);
    } catch {
      // ignore
    }
    return;
  }

  // Check map container size to avoid Leaflet flyTo unproject division-by-zero
  let size: L.Point | null = null;
  try {
    size = map.getSize();
  } catch {
    size = null;
  }

  if (!size || size.x <= 0 || size.y <= 0) {
    // Invalidate size and fall back to setView without throwing
    try {
      map.invalidateSize();
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 5.5;
      const safeZoom = Number.isFinite(targetZoom)
        ? (targetZoom as number)
        : (Number.isFinite(currentZoom) ? Math.max(currentZoom, 5.5) : 5.5);
      map.setView([lat, lng], safeZoom);
    } catch (e) {
      console.warn('safeFlyTo setView fallback error:', e);
    }
    return;
  }

  // Calculate safe zoom level
  const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 5.5;
  const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : 5.5;
  const finalZoom = Number.isFinite(targetZoom)
    ? (targetZoom as number)
    : Math.max(safeCurrentZoom, 5.5);

  try {
    map.flyTo([lat, lng], finalZoom, options || { duration: 1.2 });
  } catch (err) {
    console.warn('safeFlyTo animation exception, fallback to setView:', err);
    try {
      map.setView([lat, lng], finalZoom);
    } catch (fallbackErr) {
      console.warn('safeFlyTo fallback error:', fallbackErr);
    }
  }
}

export const DisasterMap: React.FC<DisasterMapProps> = ({
  events,
  allEvents,
  selectedEvent,
  onSelectEvent,
  onClearSelectedEvent,
  filteredType,
  onResetTypeFilter,
  onTypeFilterChange,
  userLocation: propUserLocation,
  onUserLocationChange,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  onNavigateToForecast,
  feedStats,
  isLoadingLive = false,
  onRefreshFeeds,
  staleThresholdMinutes = 60,
  isPowerSaverMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const weatherRadarLayerRef = useRef<L.TileLayer | null>(null);
  const weatherSatelliteLayerRef = useRef<L.TileLayer | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const radarLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const resourcesLayerRef = useRef<L.LayerGroup | null>(null);
  const searchLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const measureLayerRef = useRef<L.LayerGroup | null>(null);
  const forecastLayerRef = useRef<L.LayerGroup | null>(null);
  const locatePulseLayerRef = useRef<L.LayerGroup | null>(null);
  const hazardRadiusLayerRef = useRef<L.LayerGroup | null>(null);
  const thermalLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measurePointsRef = useRef<{ a: MeasurePoint | null; b: MeasurePoint | null }>({ a: null, b: null });
  const disasterMapRootRef = useRef<HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(2.3);
  const [activeLayerKey, setActiveLayerKey] = useState<keyof typeof TILE_LAYERS>('osm');
  
  // Toggle between showing parent-filtered events or all events catalog
  const [showAllCalamities, setShowAllCalamities] = useState<boolean>(false);
  const [showDateTimeTags, setShowDateTimeTags] = useState<boolean>(true);
  const [showHazardRadius, setShowHazardRadius] = useState<boolean>(true);

  // Satellite Thermal Anomaly & Wildfire Radiance Overlay State (NASA FIRMS)
  const [showThermalAnomalies, setShowThermalAnomalies] = useState<boolean>(false);
  const [selectedThermalAnomaly, setSelectedThermalAnomaly] = useState<ThermalAnomaly | null>(null);
  const [thermalMinFRP, setThermalMinFRP] = useState<number>(0);
  const [thermalSensorFilter, setThermalSensorFilter] = useState<'all' | 'viirs' | 'modis'>('all');
  const [isThermalHUDOpen, setIsThermalHUDOpen] = useState<boolean>(false);

  // Weather Radar Overlay State
  const [showWeatherRadar, setShowWeatherRadar] = useState<boolean>(false);

  // Near-Real-Time Weather Satellite Cloud & Storm Overlay State (NASA EOSDIS GIBS)
  const [showWeatherSatellite, setShowWeatherSatellite] = useState<boolean>(false);
  const [isSatelliteHUDOpen, setIsSatelliteHUDOpen] = useState<boolean>(false);
  const [satelliteProduct, setSatelliteProduct] = useState<'viirs' | 'modis'>('viirs');
  const [satelliteOpacity, setSatelliteOpacity] = useState<number>(0.75);
  const [satelliteDateOffset, setSatelliteDateOffset] = useState<0 | 1>(0); // 0 = Today (NRT), 1 = Yesterday (-24h)

  const getSatelliteDateString = useCallback((offsetDays: number): string => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - offsetDays);
    return d.toISOString().split('T')[0];
  }, []);

  // Machine Learning Hazard Forecasting State
  const [showForecastHotspots, setShowForecastHotspots] = useState<boolean>(true);
  const [forecastMinProbability, setForecastMinProbability] = useState<number>(50);
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>('72h');
  const [selectedForecastHotspot, setSelectedForecastHotspot] = useState<PredictiveHotspot | null>(null);
  const [isForecastHUDOpen, setIsForecastHUDOpen] = useState<boolean>(false);

  // Interactive Map Legend State & Severity Filter (Default true so collapsible legend is available on overlay)
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);
  const [legendSeverityFilter, setLegendSeverityFilter] = useState<SeverityLevel | 'all'>('all');

  // Leaflet Fullscreen Toggle handler (combines HTML5 Fullscreen with CSS viewport expansion for iframes)
  const toggleFullscreen = useCallback(() => {
    triggerActionHaptic();
    setIsFullscreen(prev => {
      const next = !prev;
      const el = disasterMapRootRef.current || document.getElementById('disaster-map-container');
      
      if (next) {
        if (el && el.requestFullscreen) {
          el.requestFullscreen().catch(() => {
            // Silently fall back to CSS viewport expansion for iframe preview
          });
        }
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }

      // Schedule multiple invalidateSize calls to ensure clean Leaflet reflow across display
      requestAnimationFrame(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 350);

      return next;
    });
  }, []);

  // Listen to disaster:toggle-fullscreen, ESC key, and browser fullscreen events
  useEffect(() => {
    const handleToggleEvent = () => toggleFullscreen();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 150);
      }
    };

    window.addEventListener('disaster:toggle-fullscreen', handleToggleEvent);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('disaster:toggle-fullscreen', handleToggleEvent);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, toggleFullscreen]);

  // Interactive Distance Measurement & Evacuation Path Tool
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurePointA, setMeasurePointA] = useState<MeasurePoint | null>(null);
  const [measurePointB, setMeasurePointB] = useState<MeasurePoint | null>(null);
  const [isMeasurePanelOpen, setIsMeasurePanelOpen] = useState<boolean>(true);
  const [measureAnimationTrigger, setMeasureAnimationTrigger] = useState<number>(0);

  // Time Replay Slider, Colorblind Mode, and Attribution States
  const [timeReplayWindow, setTimeReplayWindow] = useState<'24h' | '48h' | '7d' | '30d' | 'all'>('all');
  const [isColorblindMode, setIsColorblindMode] = useState<boolean>(false);
  const [isAttributionModalOpen, setIsAttributionModalOpen] = useState<boolean>(false);
  const [isPlayingTimeReplay, setIsPlayingTimeReplay] = useState<boolean>(false);

  // Map Location & Live Event Search State
  const [mapSearchQuery, setMapSearchQuery] = useState<string>(propSearchQuery || '');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchNotFoundMessage, setSearchNotFoundMessage] = useState<string | null>(null);
  const [searchedLocationInfo, setSearchedLocationInfo] = useState<{
    name: string;
    displayName?: string;
    lat: number;
    lng: number;
    type?: string;
    events: Array<{ event: CalamityEvent; distanceKm: number }>;
    nearestEvent?: { event: CalamityEvent; distanceKm: number } | null;
  } | null>(null);

  // Emergency Resources Overlay State
  const [showResources, setShowResources] = useState<boolean>(false);
  const [resourceTypeFilter, setResourceTypeFilter] = useState<'all' | 'shelter' | 'water' | 'medical'>('all');
  const [viewportResources, setViewportResources] = useState<EmergencyResource[]>([]);
  const [isResourcesHudOpen, setIsResourcesHudOpen] = useState<boolean>(true);
  const [isResourcesFilterOpen, setIsResourcesFilterOpen] = useState<boolean>(false);
  const [selectedResource, setSelectedResource] = useState<EmergencyResource | null>(null);

  // Dedicated GIS Layer Control Popover State
  const [isLayerControlOpen, setIsLayerControlOpen] = useState<boolean>(false);
  const layerControlRef = useRef<HTMLDivElement>(null);

  // Toggleable Hazard Intensity Heatmap Overlay State
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.75);
  const [heatmapMode, setHeatmapMode] = useState<'hazard_intensity' | 'blended' | 'catastrophe_only' | 'population_only'>('hazard_intensity');
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);

  // Geolocation & 500km Radar State
  const [internalLocation, setInternalLocation] = useState<UserGeoLocation | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRadarDropdownOpen, setIsRadarDropdownOpen] = useState<boolean>(false);

  // Sync prop search query if updated externally
  useEffect(() => {
    if (propSearchQuery !== undefined && propSearchQuery !== mapSearchQuery) {
      setMapSearchQuery(propSearchQuery);
      if (propSearchQuery.trim().length === 0) {
        setSearchedLocationInfo(null);
        setSearchResults([]);
      } else if (propSearchQuery.trim().length >= 2) {
        const pool = allEvents && allEvents.length > 0 ? allEvents : events;
        searchLocationWithLiveEvents(propSearchQuery.trim(), pool).then(res => {
          setSearchResults(res);
          if (res.length > 0 && propSearchQuery.trim().length >= 3) {
            handleSelectLocation(res[0], false);
          }
        });
      }
    }
  }, [propSearchQuery, allEvents, events]);

  // Close search dropdown and layer control when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (layerControlRef.current && !layerControlRef.current.contains(e.target as Node)) {
        setIsLayerControlOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Haptic feedback dispatcher for disaster selections
  const triggerEventHaptic = (ev: CalamityEvent) => {
    if (ev.severity === 'CRITICAL') {
      triggerCriticalAlertHaptic();
    } else if (ev.severity === 'HIGH') {
      triggerWarningHaptic();
    } else {
      triggerMapMarkerTapHaptic();
    }
  };

  const handleSelectEventWithHaptic = (ev: CalamityEvent) => {
    triggerEventHaptic(ev);
    onSelectEvent(ev);
  };

  // Sync prop location with internal state
  const activeUserLocation = propUserLocation !== undefined ? propUserLocation : internalLocation;

  const updateUserLocation = (loc: UserGeoLocation | null) => {
    setInternalLocation(loc);
    if (onUserLocationChange) {
      onUserLocationChange(loc);
    }
  };

  // Handle Go to Location & Show Live Events
  const handleSelectLocation = (result: GeocodingResult, shouldCloseDropdown = true) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // 1. Determine target zoom
    let targetZoom = 7.5;
    if (result.type === 'live_event') {
      targetZoom = 8.5;
    } else if (result.type === 'country') {
      targetZoom = 5.2;
    } else {
      targetZoom = 7.5;
    }

    // Smoothly fly map to searched location
    safeFlyTo(map, result.lat, result.lng, targetZoom, { duration: 1.5 });

    // 2. Identify all live events in and near that location (<= 450 km for cities, 1200 km for countries)
    const pool = allEvents && allEvents.length > 0 ? allEvents : events;
    const radius = result.type === 'country' ? 1200 : 450;
    const nearby = findEventsNearCoordinates(result.lat, result.lng, pool, radius);
    const nearest = nearby.length === 0 ? findNearestEvent(result.lat, result.lng, pool) : null;

    setSearchedLocationInfo({
      name: result.name,
      displayName: result.displayName,
      lat: result.lat,
      lng: result.lng,
      type: result.type,
      events: nearby,
      nearestEvent: nearest,
    });
    setSearchNotFoundMessage(null);

    // 3. Select the event if clicked directly or if there is exactly 1 active event nearby
    if (result.event) {
      handleSelectEventWithHaptic(result.event);
    } else if (nearby.length === 1) {
      handleSelectEventWithHaptic(nearby[0].event);
    }

    if (shouldCloseDropdown) {
      setIsSearchOpen(false);
    }
    setMapSearchQuery(result.name);
    if (onSearchQueryChange) {
      onSearchQueryChange(result.name);
    }
  };

  // Handle Search Input Change with live suggestions & debounced auto-navigation
  const handleSearchInputChange = async (val: string) => {
    setMapSearchQuery(val);
    setSearchNotFoundMessage(null);
    if (onSearchQueryChange) {
      onSearchQueryChange(val);
    }

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    if (val.trim().length >= 2) {
      setIsSearching(true);
      setIsSearchOpen(true);
      const pool = allEvents && allEvents.length > 0 ? allEvents : events;
      try {
        const res = await searchLocationWithLiveEvents(val.trim(), pool);
        setSearchResults(res);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }

      // Debounced auto-jump: When user pauses typing (600ms) with a match of >= 3 chars
      searchDebounceTimerRef.current = setTimeout(() => {
        const pool = allEvents && allEvents.length > 0 ? allEvents : events;
        searchLocationWithLiveEvents(val.trim(), pool).then(res => {
          if (res.length > 0) {
            const clean = val.trim().toLowerCase();
            const topMatch = res.find(r => r.name.toLowerCase() === clean) || res[0];
            if (topMatch && (clean.length >= 3 || topMatch.name.toLowerCase() === clean)) {
              handleSelectLocation(topMatch, false);
            }
          }
        });
      }, 600);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Submit search box on Enter or 'Go' button
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    const query = mapSearchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    const pool = allEvents && allEvents.length > 0 ? allEvents : events;
    try {
      const res = await searchLocationWithLiveEvents(query, pool);
      setIsSearching(false);
      if (res.length > 0) {
        handleSelectLocation(res[0], true);
      } else {
        setSearchNotFoundMessage(`No location found for "${query}". Try searching Tokyo, Valencia, Miami, San Francisco, Iceland, etc.`);
        setTimeout(() => setSearchNotFoundMessage(null), 5000);
      }
    } catch {
      setIsSearching(false);
    }
  };

  // Clear searched location
  const handleClearSearchedLocation = () => {
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }
    setSearchedLocationInfo(null);
    setMapSearchQuery('');
    setSearchResults([]);
    setSearchNotFoundMessage(null);
    if (onSearchQueryChange) {
      onSearchQueryChange('');
    }
  };

  // Fit all live events in the searched location
  const handleFitLocationEvents = () => {
    if (!mapInstanceRef.current || !searchedLocationInfo || searchedLocationInfo.events.length === 0) return;
    const map = mapInstanceRef.current;
    const latLngs = searchedLocationInfo.events.map(e => [e.event.coordinates.lat, e.event.coordinates.lng] as [number, number]);
    latLngs.push([searchedLocationInfo.lat, searchedLocationInfo.lng]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
  };

  // Nearby hazard computations relative to active user location
  const { localCriticalHazards, allNearbyHazards, closestHazard } = useMemo(() => {
    return findNearbyHazards(events, activeUserLocation, 500);
  }, [events, activeUserLocation]);

  // Request browser geolocation
  const handleAcquireBrowserLocation = async () => {
    try {
      setIsLocating(true);
      setLocationError(null);
      const loc = await requestBrowserLocation();
      triggerLocationLockHaptic();
      updateUserLocation(loc);
      setIsRadarDropdownOpen(false);

      if (mapInstanceRef.current) {
        safeFlyTo(mapInstanceRef.current, loc.lat, loc.lng, 7, { duration: 1.5 });
      }
    } catch (err: any) {
      console.warn('Geolocation request error:', err);
      setLocationError(err?.message || 'Could not acquire browser geolocation.');
    } finally {
      setIsLocating(false);
    }
  };

  // Select test preset
  const handleSelectPreset = (preset: typeof TEST_LOCATION_PRESETS[0]) => {
    triggerActionHaptic();
    const loc: UserGeoLocation = {
      lat: preset.lat,
      lng: preset.lng,
      name: preset.name,
      source: 'preset',
      timestamp: Date.now(),
    };
    updateUserLocation(loc);
    setIsRadarDropdownOpen(false);
    setLocationError(null);

    if (mapInstanceRef.current) {
      safeFlyTo(mapInstanceRef.current, loc.lat, loc.lng, 6.5, { duration: 1.5 });
    }
  };

  // Clear user location
  const handleClearLocation = () => {
    triggerActionHaptic();
    updateUserLocation(null);
    setIsRadarDropdownOpen(false);
    setLocationError(null);
  };

  // Compute humanitarian impact analytics for current events
  const humanitarianAnalytics = useMemo(() => {
    return analyzeCatastropheHumanitarianImpact(events, GLOBAL_POPULATION_HUBS);
  }, [events]);

  const totalExposedPopulation = useMemo(() => {
    return humanitarianAnalytics.reduce((sum, h) => sum + h.totalExposedPopulation, 0);
  }, [humanitarianAnalytics]);

  const topImpactCatastrophes = useMemo(() => {
    return [...humanitarianAnalytics]
      .sort((a, b) => b.totalExposedPopulation - a.totalExposedPopulation)
      .slice(0, 4);
  }, [humanitarianAnalytics]);

  // Initialize Map with resilient container lifecycle, ResizeObserver, and leak-free cleanup
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Defensively clean up any stale Leaflet association on this DOM container
    if ((container as any)._leaflet_id && !mapInstanceRef.current) {
      (container as any)._leaflet_id = null;
    }

    let map = mapInstanceRef.current;

    if (!map) {
      map = L.map(container, {
        center: [20, 10],
        zoom: 2.3,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        attributionControl: false,
      } as any);

      // Add attribution in neat corner
      L.control.attribution({ position: 'bottomright' }).addTo(map);

      // Add default tile layer
      const layerConfig = TILE_LAYERS[activeLayerKey];
      const tiles = L.tileLayer(layerConfig.url, {
        attribution: layerConfig.attribution,
        maxZoom: layerConfig.maxZoom,
        maxNativeZoom: Math.min(layerConfig.maxZoom, 18),
        minZoom: 2,
        subdomains: layerConfig.subdomains,
        crossOrigin: true,
      }).addTo(map);

      tileLayerRef.current = tiles;
      heatmapLayerRef.current = L.layerGroup().addTo(map);
      radarLayerRef.current = L.layerGroup().addTo(map);
      searchLocationLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      resourcesLayerRef.current = L.layerGroup().addTo(map);
      measureLayerRef.current = L.layerGroup().addTo(map);
      forecastLayerRef.current = L.layerGroup().addTo(map);
      locatePulseLayerRef.current = L.layerGroup().addTo(map);
      hazardRadiusLayerRef.current = L.layerGroup().addTo(map);
      thermalLayerRef.current = L.layerGroup().addTo(map);

      // Cartographic scale bar (Metric km / m and Nautical/Imperial)
      L.control.scale({ imperial: true, metric: true, position: 'bottomleft' }).addTo(map);

      // Implement & Add Leaflet Fullscreen Control Plugin (L.Control)
      const FullscreenControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function () {
          const controlDiv = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-fullscreen');
          const btn = L.DomUtil.create('a', 'leaflet-control-fullscreen-button', controlDiv);
          btn.href = '#';
          btn.title = 'Toggle Fullscreen Mode (Expand Map to Browser Viewport)';
          btn.setAttribute('role', 'button');
          btn.setAttribute('aria-label', 'Toggle Fullscreen Mode');
          btn.innerHTML = `
            <svg class="fullscreen-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          `;
          L.DomEvent.disableClickPropagation(btn);
          L.DomEvent.on(btn, 'click', (e) => {
            L.DomEvent.preventDefault(e);
            window.dispatchEvent(new CustomEvent('disaster:toggle-fullscreen'));
          });
          return controlDiv;
        }
      });
      new (FullscreenControl as any)().addTo(map);

      // Cursor coordinates & zoom tracking for GIS Geodetic Status Readout
      map.on('mousemove', (e: L.LeafletMouseEvent) => {
        if (Number.isFinite(e.latlng.lat) && Number.isFinite(e.latlng.lng)) {
          setCursorCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
      map.on('mouseout', () => {
        setCursorCoords(null);
      });
      map.on('zoomend', () => {
        if (mapInstanceRef.current) {
          setCurrentZoom(Number(mapInstanceRef.current.getZoom().toFixed(1)));
        }
      });

      mapInstanceRef.current = map;
    }

    // Attach ResizeObserver to automatically invalidate Leaflet size when layout switches or screen rotates
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        weatherRadarLayerRef.current = null;
        weatherSatelliteLayerRef.current = null;
        heatmapLayerRef.current = null;
        radarLayerRef.current = null;
        searchLocationLayerRef.current = null;
        markersLayerRef.current = null;
        resourcesLayerRef.current = null;
        measureLayerRef.current = null;
        forecastLayerRef.current = null;
        if (locatePulseLayerRef.current) {
          locatePulseLayerRef.current.clearLayers();
          locatePulseLayerRef.current = null;
        }
        if (hazardRadiusLayerRef.current) {
          hazardRadiusLayerRef.current.clearLayers();
          hazardRadiusLayerRef.current = null;
        }
        if (thermalLayerRef.current) {
          thermalLayerRef.current.clearLayers();
          thermalLayerRef.current = null;
        }
        markersMapRef.current.clear();
      }
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const layerConfig = TILE_LAYERS[activeLayerKey];
    tileLayerRef.current = L.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
      maxZoom: layerConfig.maxZoom,
      maxNativeZoom: Math.min(layerConfig.maxZoom, 18),
      minZoom: 2,
      subdomains: layerConfig.subdomains,
      crossOrigin: true,
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [activeLayerKey]);

  // Real-time Weather Precipitation Radar Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    if (showWeatherRadar) {
      if (!weatherRadarLayerRef.current) {
        weatherRadarLayerRef.current = L.tileLayer(
          'https://tilecache.rainviewer.com/v2/radar/nowcast_512/{z}/{x}/{y}/2/1_1.png',
          {
            opacity: 0.65,
            zIndex: 400,
            attribution: 'Radar &copy; RainViewer / NOAA',
            maxZoom: 12,
          }
        );
      }
      weatherRadarLayerRef.current.addTo(map);
    } else {
      if (weatherRadarLayerRef.current && map.hasLayer(weatherRadarLayerRef.current)) {
        map.removeLayer(weatherRadarLayerRef.current);
      }
    }
  }, [showWeatherRadar]);

  // Near-Real-Time Weather Satellite Cloud Cover & Storm Structure Layer (NASA EOSDIS GIBS)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (weatherSatelliteLayerRef.current) {
      if (map.hasLayer(weatherSatelliteLayerRef.current)) {
        map.removeLayer(weatherSatelliteLayerRef.current);
      }
      weatherSatelliteLayerRef.current = null;
    }

    if (showWeatherSatellite) {
      const selectedDate = getSatelliteDateString(satelliteDateOffset);
      const fallbackDate = getSatelliteDateString(satelliteDateOffset + 1);
      const layerId = satelliteProduct === 'viirs'
        ? 'VIIRS_SNPP_CorrectedReflectance_TrueColor'
        : 'MODIS_Terra_CorrectedReflectance_TrueColor';

      const primaryUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${selectedDate}/GoogleMapsCompatible_Level9/{z}/{x}/{y}.jpg`;
      const fallbackUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${fallbackDate}/GoogleMapsCompatible_Level9/{z}/{x}/{y}.jpg`;

      const satLayer = L.tileLayer(primaryUrl, {
        opacity: satelliteOpacity,
        zIndex: 350,
        attribution: 'Weather Satellite Imagery &copy; NASA EOSDIS GIBS / NOAA',
        maxZoom: 9,
        minZoom: 1,
        bounds: [[-85.051129, -180], [85.051129, 180]],
      });

      // Defensive tile fallback: if today's polar orbit pass for a specific tile hasn't completed yet, fall back to previous pass
      satLayer.on('tileerror', (e: any) => {
        if (e.tile && !e.tile.__fallbackAttempted && e.coords) {
          e.tile.__fallbackAttempted = true;
          e.tile.src = fallbackUrl
            .replace('{z}', e.coords.z)
            .replace('{x}', e.coords.x)
            .replace('{y}', e.coords.y);
        }
      });

      weatherSatelliteLayerRef.current = satLayer;
      satLayer.addTo(map);
    }
  }, [showWeatherSatellite, satelliteProduct, satelliteDateOffset, getSatelliteDateString]);

  // Sync Opacity changes to live Weather Satellite Layer without recreating layer
  useEffect(() => {
    if (weatherSatelliteLayerRef.current) {
      weatherSatelliteLayerRef.current.setOpacity(satelliteOpacity);
    }
  }, [satelliteOpacity]);

  // Memoized Thermal Anomaly Dataset and Summary (NASA FIRMS / VIIRS 375m)
  const currentThermalAnomalies = useMemo(() => {
    const candidateEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    const raw = generateThermalAnomalies(candidateEvents);
    return filterThermalAnomalies(raw, thermalMinFRP, thermalSensorFilter);
  }, [showAllCalamities, allEvents, events, thermalMinFRP, thermalSensorFilter]);

  const thermalSummary = useMemo(() => {
    return calculateThermalSummary(currentThermalAnomalies);
  }, [currentThermalAnomalies]);

  // Real-Time Satellite Thermal Anomalies & Wildfire Radiance Overlay (NASA FIRMS)
  useEffect(() => {
    if (!mapInstanceRef.current || !thermalLayerRef.current) return;
    const group = thermalLayerRef.current;
    group.clearLayers();

    if (!showThermalAnomalies) return;

    currentThermalAnomalies.forEach((anomaly) => {
      const {
        lat,
        lng,
        fireRadiativePowerMW,
        brightnessTempKelvin,
        brightnessTempCelsius,
        confidencePercent,
        satelliteSensor,
        satellitePlatform,
        locationName,
        country,
        clusterRadiusKm,
        dayNight,
        acquisitionTimeUtc,
      } = anomaly;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // 1. Thermal radiant emission halo circle
      const radiusMeters = Math.max(3000, clusterRadiusKm * 1000);
      const isHighFRP = fireRadiativePowerMW >= 150;
      const haloColor = fireRadiativePowerMW >= 200 ? '#ef4444' : fireRadiativePowerMW >= 100 ? '#ea580c' : '#f59e0b';

      const haloCircle = L.circle([lat, lng], {
        radius: radiusMeters,
        color: haloColor,
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: haloColor,
        fillOpacity: isPowerSaverMode ? 0.08 : 0.18,
        interactive: false,
      });
      group.addLayer(haloCircle);

      // 2. High-visibility thermal beacon marker pin
      const beaconIcon = L.divIcon({
        className: 'custom-thermal-beacon-pin',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer -ml-3.5 -mt-3.5 select-none" title="Thermal Hotspot: ${locationName} (${fireRadiativePowerMW} MW)">
            ${!isPowerSaverMode ? `
              <span class="absolute inline-flex ${isHighFRP ? 'h-9 w-9' : 'h-7 w-7'} rounded-full ${isHighFRP ? 'bg-rose-500' : 'bg-orange-500'} opacity-60 animate-ping"></span>
            ` : ''}
            <span class="relative inline-flex items-center justify-center rounded-full text-white shadow-xl ring-2 ${isHighFRP ? 'ring-rose-300 bg-gradient-to-tr from-rose-700 via-orange-600 to-amber-500' : 'ring-amber-300 bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400'}" style="width: 28px; height: 28px;">
              <span class="text-xs">🔥</span>
            </span>
            ${isHighFRP ? `
              <div class="absolute -bottom-4 whitespace-nowrap px-1 py-0.2 rounded bg-slate-950/95 border border-rose-500/80 text-[8px] font-mono font-bold text-rose-300 shadow pointer-events-none">
                ${fireRadiativePowerMW} MW
              </div>
            ` : ''}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], {
        icon: beaconIcon,
        zIndexOffset: 700 + Math.min(200, fireRadiativePowerMW),
      });

      // Proximity to active user/responder
      let distUserKm: number | null = null;
      if (activeUserLocation && Number.isFinite(activeUserLocation.lat) && Number.isFinite(activeUserLocation.lng)) {
        distUserKm = calculateDistanceKm(activeUserLocation.lat, activeUserLocation.lng, lat, lng);
      }

      // Tooltip
      marker.bindTooltip(`
        <div class="p-1.5 font-mono text-xs max-w-xs space-y-1 select-none">
          <div class="flex items-center justify-between gap-1.5 border-b border-slate-700 pb-1">
            <span class="font-bold text-orange-400 flex items-center gap-1 font-sans">
              <span>🔥</span> THERMAL ANOMALY
            </span>
            <span class="px-1 py-0.2 rounded text-[9px] font-black ${isHighFRP ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'}">
              ${fireRadiativePowerMW} MW FRP
            </span>
          </div>
          <div class="font-bold text-white text-[11px] leading-tight">${locationName}</div>
          <div class="text-[10px] text-slate-300">${country} • Orbit: ${acquisitionTimeUtc} (${dayNight === 'D' ? 'Day' : 'Night'})</div>
          <div class="grid grid-cols-2 gap-1 pt-0.5 text-[10px]">
            <div class="p-1 rounded bg-slate-900 border border-slate-800">
              <div class="text-slate-400 text-[9px]">Brightness Temp</div>
              <div class="font-bold text-slate-200">${brightnessTempCelsius}°C (${brightnessTempKelvin} K)</div>
            </div>
            <div class="p-1 rounded bg-slate-900 border border-slate-800">
              <div class="text-slate-400 text-[9px]">Sensor Confidence</div>
              <div class="font-bold text-amber-300">${confidencePercent}% (${satelliteSensor})</div>
            </div>
          </div>
          ${distUserKm !== null ? `
            <div class="text-[10px] text-cyan-300 font-sans font-bold pt-0.5">
              📍 ${distUserKm.toFixed(1)} km from responder location
            </div>
          ` : ''}
        </div>
      `, { className: 'leaflet-tooltip-dark', direction: 'top', offset: [0, -14] });

      // Popup
      marker.bindPopup(`
        <div class="p-2.5 font-sans text-xs max-w-sm space-y-2">
          <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span class="font-bold text-orange-400 flex items-center gap-1.5 text-sm">
              <span>🔥</span> Satellite Thermal Anomaly
            </span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
              ${satelliteSensor}
            </span>
          </div>

          <div>
            <div class="font-bold text-white text-sm">${locationName}</div>
            <div class="text-slate-400 text-[11px] font-mono">${country} • ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>
          </div>

          <!-- Radiometric Measurement Stats -->
          <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
            <div>
              <div class="text-slate-400 text-[10px]">Fire Radiative Power</div>
              <div class="font-black text-orange-400 text-sm">${fireRadiativePowerMW} MW</div>
            </div>
            <div>
              <div class="text-slate-400 text-[10px]">Brightness Temp (4μm)</div>
              <div class="font-black text-rose-300 text-sm">${brightnessTempCelsius}°C <span class="text-[10px] text-slate-400 font-normal">(${brightnessTempKelvin} K)</span></div>
            </div>
            <div>
              <div class="text-slate-400 text-[10px]">Sensor Platform</div>
              <div class="font-semibold text-slate-200">${satellitePlatform} (${dayNight === 'D' ? 'Daytime' : 'Nighttime'})</div>
            </div>
            <div>
              <div class="text-slate-400 text-[10px]">Detection Quality</div>
              <div class="font-semibold text-emerald-400">${confidencePercent}% Confidence</div>
            </div>
          </div>

          ${anomaly.associatedEventName ? `
            <div class="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] space-y-1">
              <div class="font-bold text-amber-300 text-[10px] uppercase">Associated Disaster Incident:</div>
              <div class="text-white font-semibold">${anomaly.associatedEventName}</div>
              ${anomaly.associatedEventId ? `
                <button
                  onclick="window.__selectDisasterEvent && window.__selectDisasterEvent('${anomaly.associatedEventId}')"
                  class="mt-1 w-full py-1 px-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition-colors cursor-pointer text-center"
                >
                  Open Incident Triage Report ↗
                </button>
              ` : ''}
            </div>
          ` : ''}

          <div class="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span class="text-slate-400 font-mono">Orbit Pass: ${acquisitionTimeUtc}</span>
            <button
              onclick="window.__copyGpsCoordinates ? window.__copyGpsCoordinates('${lat}, ${lng}') : null"
              class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono transition-colors cursor-pointer"
            >
              📋 Copy GPS
            </button>
          </div>
        </div>
      `, { className: 'leaflet-popup-dark', maxWidth: 320 });

      marker.on('click', () => {
        triggerActionHaptic();
        setSelectedThermalAnomaly(anomaly);
      });

      group.addLayer(marker);
    });
  }, [showThermalAnomalies, currentThermalAnomalies, isPowerSaverMode, activeUserLocation]);

  // Machine Learning Predictive Hotspot Markers and Impact Footprints
  useEffect(() => {
    if (!mapInstanceRef.current || !forecastLayerRef.current) return;
    const forecastGroup = forecastLayerRef.current;
    forecastGroup.clearLayers();

    if (!showForecastHotspots) return;

    const candidateEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    const rawHotspots = generateMLHazardHotspots(candidateEvents, forecastHorizon);
    const hotspots = filterPredictiveHotspots(rawHotspots, forecastMinProbability, forecastHorizon, filteredType);

    hotspots.forEach((hotspot) => {
      const isSelected = selectedForecastHotspot?.id === hotspot.id;

      const tierColors = {
        VERY_HIGH: {
          stroke: '#f43f5e',
          fill: '#f43f5e',
          bg: 'bg-rose-600',
          border: 'border-rose-300',
          ping: 'bg-rose-400',
          text: 'text-rose-300',
        },
        HIGH: {
          stroke: '#f97316',
          fill: '#f97316',
          bg: 'bg-amber-600',
          border: 'border-amber-300',
          ping: 'bg-amber-400',
          text: 'text-amber-300',
        },
        ELEVATED: {
          stroke: '#eab308',
          fill: '#eab308',
          bg: 'bg-yellow-600',
          border: 'border-yellow-300',
          ping: 'bg-yellow-400',
          text: 'text-yellow-300',
        },
        MODERATE: {
          stroke: '#06b6d4',
          fill: '#06b6d4',
          bg: 'bg-cyan-600',
          border: 'border-cyan-300',
          ping: 'bg-cyan-400',
          text: 'text-cyan-300',
        },
      }[hotspot.probabilityTier];

      // 1. Predictive Hazard Radius Buffer Circle
      const radiusMeters = hotspot.estimatedImpactRadiusKm * 1000;
      const bufferCircle = L.circle([hotspot.coordinates.lat, hotspot.coordinates.lng], {
        radius: radiusMeters,
        color: tierColors.stroke,
        weight: isSelected ? 2.5 : 1.5,
        dashArray: isSelected ? '4, 4' : '6, 6',
        fillColor: tierColors.fill,
        fillOpacity: isSelected ? 0.22 : 0.12,
      });

      bufferCircle.on('click', () => {
        triggerWarningHaptic();
        setSelectedForecastHotspot(hotspot);
        setIsForecastHUDOpen(true);
      });
      forecastGroup.addLayer(bufferCircle);

      // 2. Predictive Probability DivIcon Marker
      const icon = L.divIcon({
        className: 'custom-forecast-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="absolute -inset-2 rounded-full ${tierColors.ping} opacity-70 animate-ping"></div>
            <div class="relative flex items-center gap-1 px-2 py-0.5 rounded-full ${tierColors.bg} border-2 ${tierColors.border} text-white shadow-2xl font-mono text-[11px] font-black transition-transform group-hover:scale-110">
              <span class="text-xs">🧠</span>
              <span>${hotspot.probability}%</span>
            </div>
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap px-1 py-0.2 rounded bg-slate-950/95 border ${tierColors.border} text-[8px] font-mono font-bold ${tierColors.text} shadow-xl">
              ${hotspot.hazardType.toUpperCase()}
            </div>
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });

      const marker = L.marker([hotspot.coordinates.lat, hotspot.coordinates.lng], {
        icon,
        zIndexOffset: isSelected ? 1500 : 1050,
      });

      marker.bindTooltip(`
        <div style="font-family:sans-serif;font-size:11px;line-height:1.4">
          <div style="font-weight:bold;color:${tierColors.stroke};display:flex;align-items:center;gap:4px">
            <span>🧠 ML PREDICTIVE HOTSPOT (${hotspot.horizon.toUpperCase()})</span>
          </div>
          <strong style="color:#ffffff">${hotspot.name}</strong><br/>
          <span style="color:#94a3b8">${hotspot.region}, ${hotspot.country}</span><br/>
          <div style="margin-top:3px;font-family:monospace;font-size:10px">
            <span style="color:${tierColors.stroke};font-weight:bold">Probability: ${hotspot.probability}%</span> [${hotspot.confidenceInterval.low}%-${hotspot.confidenceInterval.high}%]<br/>
            <span>Impact Footprint: ±${hotspot.estimatedImpactRadiusKm} km</span><br/>
            <span>Pop at Risk: ${(hotspot.populationAtRisk / 1000).toFixed(0)}k</span>
          </div>
        </div>
      `, { direction: 'top', offset: [0, -14] });

      marker.on('click', () => {
        triggerWarningHaptic();
        setSelectedForecastHotspot(hotspot);
        setIsForecastHUDOpen(true);
        if (mapInstanceRef.current) {
          safeFlyTo(mapInstanceRef.current, hotspot.coordinates?.lat, hotspot.coordinates?.lng, 7, { duration: 1 });
        }
      });

      forecastGroup.addLayer(marker);
    });
  }, [showForecastHotspots, forecastMinProbability, forecastHorizon, filteredType, selectedForecastHotspot, allEvents, events, showAllCalamities]);

  // Update 500km Geolocation Radar Circle, User Pin & Hazard Connectors
  useEffect(() => {
    if (!mapInstanceRef.current || !radarLayerRef.current) return;
    const radarGroup = radarLayerRef.current;
    radarGroup.clearLayers();

    if (!activeUserLocation) return;

    const hasCriticalIn500km = localCriticalHazards.length > 0;
    const circleColor = hasCriticalIn500km ? '#f43f5e' : '#38bdf8';
    const circleFill = hasCriticalIn500km ? '#f43f5e' : '#38bdf8';

    // 1. 500km Radius Perimeter Circle
    const radarCircle = L.circle([activeUserLocation.lat, activeUserLocation.lng], {
      radius: 500000, // 500 km in meters
      color: circleColor,
      weight: 2,
      dashArray: '6, 6',
      fillColor: circleFill,
      fillOpacity: hasCriticalIn500km ? 0.08 : 0.04,
    });

    radarCircle.bindTooltip(
      `
      <div class="text-xs p-1 font-mono">
        <div class="font-bold ${hasCriticalIn500km ? 'text-rose-400' : 'text-sky-400'} flex items-center gap-1">
          <span>${hasCriticalIn500km ? '🚨 500 KM LOCAL HAZARD ALERT PERIMETER' : '🛡️ 500 KM RADAR PERIMETER'}</span>
        </div>
        <div class="text-[11px] text-slate-200 mt-0.5">
          ${activeUserLocation.name}
        </div>
        <div class="text-[10px] text-slate-400 mt-0.5">
          ${hasCriticalIn500km 
            ? `⚠️ ${localCriticalHazards.length} CRITICAL disaster(s) within 500km!` 
            : '✅ No CRITICAL disasters detected within 500 km'}
        </div>
      </div>
      `,
      { className: 'leaflet-tooltip-dark', direction: 'center', permanent: false }
    );

    radarGroup.addLayer(radarCircle);

    // 2. User Location Marker Pin
    const userPinIcon = L.divIcon({
      className: 'custom-user-location-pin',
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <span class="absolute inline-flex h-10 w-10 rounded-full ${hasCriticalIn500km ? 'bg-rose-500' : 'bg-sky-400'} opacity-60 animate-ping"></span>
          <span class="relative inline-flex items-center justify-center rounded-full text-white shadow-2xl ring-4 ring-slate-950 font-black text-xs ${hasCriticalIn500km ? 'bg-rose-600' : 'bg-sky-500'}" style="width: 32px; height: 32px;">
            📍
          </span>
          <div class="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950/95 border border-slate-700 text-[10px] font-bold text-white shadow-xl pointer-events-none">
            YOU ARE HERE
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const userMarker = L.marker([activeUserLocation.lat, activeUserLocation.lng], {
      icon: userPinIcon,
      title: `Your Location: ${activeUserLocation.name}`,
      zIndexOffset: 1000,
    });

    userMarker.bindPopup(`
      <div class="p-2 text-xs">
        <div class="font-bold text-slate-100 flex items-center gap-1.5 text-sm">
          <span>📍 ${activeUserLocation.name}</span>
        </div>
        <div class="text-slate-400 text-[11px] font-mono mt-0.5">
          Coordinates: ${activeUserLocation.lat.toFixed(4)}°N, ${activeUserLocation.lng.toFixed(4)}°E
        </div>
        <div class="mt-2 pt-1.5 border-t border-slate-800 text-[11px]">
          ${hasCriticalIn500km 
            ? `<span class="text-rose-400 font-bold">🚨 ${localCriticalHazards.length} CRITICAL Calamities within 500km Radius</span>` 
            : `<span class="text-emerald-400 font-bold">🛡️ 500km Radius Clear of Critical Threats</span>`}
        </div>
      </div>
    `);

    radarGroup.addLayer(userMarker);

    // 3. Connect User Pin with local critical hazards via dashed warning rays
    localCriticalHazards.forEach(hazard => {
      const ray = L.polyline(
        [
          [activeUserLocation.lat, activeUserLocation.lng],
          [hazard.event.coordinates.lat, hazard.event.coordinates.lng],
        ],
        {
          color: '#f43f5e',
          weight: 2.5,
          dashArray: '6, 6',
          opacity: 0.9,
        }
      );

      ray.bindTooltip(
        `
        <div class="text-xs p-1 font-mono text-rose-300 font-bold">
          🚨 LOCAL HAZARD: ${hazard.distanceKm} km to ${hazard.event.name}
        </div>
        `,
        { className: 'leaflet-tooltip-dark', sticky: true }
      );

      radarGroup.addLayer(ray);
    });
  }, [activeUserLocation, localCriticalHazards]);

  // Dedicated Visual Layer for Searched Location Beacon, Radar Radius Ring & Event Connecting Rays
  useEffect(() => {
    if (!mapInstanceRef.current || !searchLocationLayerRef.current) return;
    const group = searchLocationLayerRef.current;
    group.clearLayers();

    if (!searchedLocationInfo) return;

    const { lat, lng, name, events: locEvents } = searchedLocationInfo;

    // 1. Pulsing Golden Target Beacon Pin at the searched location
    const searchBeaconIcon = L.divIcon({
      className: 'custom-searched-location-pin',
      html: `
        <div class="relative flex flex-col items-center justify-center cursor-pointer">
          <span class="absolute inline-flex h-12 w-12 rounded-full bg-amber-400 opacity-60 animate-ping"></span>
          <span class="relative inline-flex items-center justify-center rounded-full bg-amber-500 text-slate-950 shadow-2xl ring-4 ring-amber-300 font-black text-sm" style="width: 32px; height: 32px;">
            📍
          </span>
          <div class="mt-1 whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950/95 border border-amber-500 text-[10px] font-bold text-amber-300 shadow-xl pointer-events-none">
            ${name}
          </div>
        </div>
      `,
      iconSize: [32, 44],
      iconAnchor: [16, 22],
    });

    const searchMarker = L.marker([lat, lng], {
      icon: searchBeaconIcon,
      title: `Searched Location: ${name}`,
      zIndexOffset: 1200,
    });

    searchMarker.bindPopup(`
      <div class="p-2 text-xs">
        <div class="font-bold text-amber-400 text-sm flex items-center gap-1.5">
          <span>📍 ${name}</span>
        </div>
        <div class="text-slate-300 text-[11px] font-mono mt-0.5">
          Coordinates: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
        </div>
        <div class="mt-2 pt-1.5 border-t border-slate-800 text-[11px]">
          ${locEvents.length > 0 
            ? `<strong class="text-amber-300">⚡ ${locEvents.length} Live Event(s) Detected in this Location</strong>` 
            : `<span class="text-emerald-400">🛡️ No active disasters detected within 450 km</span>`}
        </div>
      </div>
    `);

    group.addLayer(searchMarker);

    // 2. Concentric Radar Radius Ring around searched spot
    const searchCircle = L.circle([lat, lng], {
      radius: 350000,
      color: '#f59e0b',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#f59e0b',
      fillOpacity: 0.05,
    });
    group.addLayer(searchCircle);

    // 3. Connect searched location to all live events in that sector via luminous lines
    locEvents.slice(0, 6).forEach(({ event: ev, distanceKm }) => {
      const isCritical = ev.severity === 'CRITICAL';
      const ray = L.polyline(
        [
          [lat, lng],
          [ev.coordinates.lat, ev.coordinates.lng],
        ],
        {
          color: isCritical ? '#f43f5e' : '#f59e0b',
          weight: 2,
          opacity: 0.8,
          dashArray: '5, 5',
        }
      );
      ray.bindTooltip(`📍 ${ev.name} (${distanceKm} km)`, {
        className: 'leaflet-tooltip-dark',
        sticky: true,
      });
      group.addLayer(ray);
    });
  }, [searchedLocationInfo]);

  // Zoom & frame the 50km hazard radius circle smoothly inside the map viewport
  const handleFitHazardRadius = useCallback(() => {
    if (!mapInstanceRef.current || !selectedEvent?.coordinates) return;
    const { lat, lng } = selectedEvent.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      const circle = L.circle([lat, lng], { radius: 50000 });
      mapInstanceRef.current.fitBounds(circle.getBounds(), {
        padding: [60, 60],
        maxZoom: 10,
        animate: true,
        duration: 1.0,
      });
    } catch {
      safeFlyTo(mapInstanceRef.current, lat, lng, 8.5);
    }
  }, [selectedEvent]);

  // Dedicated Visual 50km Hazard Radius Impact Zone for Selected Event Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !hazardRadiusLayerRef.current) return;
    const group = hazardRadiusLayerRef.current;
    group.clearLayers();

    if (!selectedEvent || !selectedEvent.coordinates || !showHazardRadius) {
      return;
    }

    const lat = selectedEvent.coordinates.lat;
    const lng = selectedEvent.coordinates.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Severity theme styling
    const severityThemes: Record<string, { stroke: string; fill: string; title: string }> = {
      CRITICAL: { stroke: '#f43f5e', fill: '#f43f5e', title: 'CRITICAL IMPACT ZONE' },
      HIGH: { stroke: '#ea580c', fill: '#ea580c', title: 'HIGH HAZARD IMPACT ZONE' },
      MEDIUM: { stroke: '#f59e0b', fill: '#f59e0b', title: 'MODERATE HAZARD IMPACT ZONE' },
      LOW: { stroke: '#06b6d4', fill: '#06b6d4', title: 'ADVISORY IMPACT ZONE' },
    };
    const theme = severityThemes[selectedEvent.severity] || severityThemes.HIGH;
    const meta = CALAMITY_MAP_ICONS[selectedEvent.type] || { emoji: '⚠️', label: selectedEvent.type, color: theme.stroke };

    // 1. Primary 50 km Visual Hazard Radius Circle
    const hazardCircle50km = L.circle([lat, lng], {
      radius: 50000, // 50 km in meters
      color: theme.stroke,
      weight: 2.5,
      dashArray: '8, 8',
      fillColor: theme.fill,
      fillOpacity: isPowerSaverMode ? 0.08 : 0.14,
      className: 'hazard-radius-50km-circle',
      interactive: true,
    });

    // Distance to responder / user
    let userDistKm: number | null = null;
    let isUserInside = false;
    if (activeUserLocation && Number.isFinite(activeUserLocation.lat) && Number.isFinite(activeUserLocation.lng)) {
      userDistKm = calculateDistanceKm(activeUserLocation.lat, activeUserLocation.lng, lat, lng);
      isUserInside = userDistKm <= 50;
    }

    const responderStatusHtml = userDistKm !== null
      ? (isUserInside
          ? `<div class="p-1.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-300 font-bold text-[10px] flex items-center justify-between">
               <span>🚨 RESPONDER INSIDE 50KM DANGER ZONE!</span>
               <span class="font-mono">${userDistKm.toFixed(1)} km to Epicenter</span>
             </div>`
          : `<div class="p-1 rounded bg-slate-900 border border-slate-800 text-cyan-300 text-[10px] flex items-center justify-between">
               <span>🛡️ Responder Outside Zone</span>
               <span class="font-mono">${userDistKm.toFixed(1)} km away</span>
             </div>`)
      : '';

    hazardCircle50km.bindTooltip(`
      <div class="p-2 font-mono text-xs max-w-xs space-y-1.5 select-none">
        <div class="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
          <span class="font-bold text-amber-400 flex items-center gap-1 font-sans">
            <span>⚠️</span> 50 KM HAZARD IMPACT ZONE
          </span>
          <span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase" style="background:${theme.stroke}33; color:${theme.stroke}; border: 1px solid ${theme.stroke}66">
            ${selectedEvent.severity}
          </span>
        </div>
        <div class="text-[11px] text-white font-bold leading-tight">${selectedEvent.name}</div>
        <div class="text-[10px] text-slate-300">${meta.emoji} ${selectedEvent.city}, ${selectedEvent.country} • ${selectedEvent.type.toUpperCase()}</div>
        <div class="grid grid-cols-2 gap-1 pt-1 text-[10px]">
          <div class="p-1 rounded bg-slate-900 border border-slate-800">
            <div class="text-slate-400">Radial Reach</div>
            <div class="font-bold text-slate-200">50.0 km (31.1 mi)</div>
          </div>
          <div class="p-1 rounded bg-slate-900 border border-slate-800">
            <div class="text-slate-400">Surface Area</div>
            <div class="font-bold text-slate-200">~7,854 km²</div>
          </div>
        </div>
        ${responderStatusHtml}
        <div class="text-[9px] text-amber-300/90 italic pt-0.5">Click "Fit 50km Zone" in card to frame impact zone</div>
      </div>
    `, { className: 'leaflet-tooltip-dark', sticky: true });

    group.addLayer(hazardCircle50km);

    // 2. Inner 15 km High-Severity Core Epicenter Zone
    const coreCircle15km = L.circle([lat, lng], {
      radius: 15000, // 15 km in meters
      color: theme.stroke,
      weight: 1.5,
      dashArray: '4, 4',
      fillColor: theme.fill,
      fillOpacity: isPowerSaverMode ? 0.12 : 0.22,
      className: 'hazard-core-15km-circle',
      interactive: false,
    });
    group.addLayer(coreCircle15km);

    // 3. Northern Boundary Radial Measure Ray & Perimeter Boundary Badge
    const northEdgeLat = lat + (50 / 111.32);
    const northEdgeLng = lng;

    const radialRay = L.polyline([[lat, lng], [northEdgeLat, northEdgeLng]], {
      color: theme.stroke,
      weight: 1.5,
      dashArray: '3, 6',
      opacity: 0.75,
      interactive: false,
    });
    group.addLayer(radialRay);

    const perimeterBadgeIcon = L.divIcon({
      className: 'hazard-perimeter-badge',
      html: `
        <div class="pointer-events-none select-none flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/95 border text-[9px] font-mono font-black tracking-wider whitespace-nowrap shadow-2xl -translate-x-1/2 -translate-y-1/2" style="border-color: ${theme.stroke}; color: ${theme.stroke};">
          <span class="w-1.5 h-1.5 rounded-full ${isPowerSaverMode ? '' : 'animate-ping'}" style="background-color: ${theme.stroke};"></span>
          <span>50 KM HAZARD PERIMETER</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const perimeterMarker = L.marker([northEdgeLat, northEdgeLng], {
      icon: perimeterBadgeIcon,
      interactive: false,
      zIndexOffset: 1500,
    });
    group.addLayer(perimeterMarker);

    // 4. If responder is inside 50km danger zone, draw direct alert connector ray
    if (activeUserLocation && isUserInside) {
      const userConnector = L.polyline(
        [[activeUserLocation.lat, activeUserLocation.lng], [lat, lng]],
        {
          color: '#f43f5e',
          weight: 3,
          dashArray: '4, 4',
          opacity: 0.95,
        }
      );
      userConnector.bindTooltip(
        `<div class="text-[10px] font-mono text-rose-300 font-bold p-1">🚨 INSIDE 50KM IMPACT ZONE: ${userDistKm?.toFixed(1)} km to Epicenter</div>`,
        { className: 'leaflet-tooltip-dark', sticky: true }
      );
      group.addLayer(userConnector);
    }
  }, [selectedEvent, showHazardRadius, activeUserLocation, isPowerSaverMode]);

  // Sync measurePointsRef to avoid stale closures in map click event listener
  useEffect(() => {
    measurePointsRef.current = { a: measurePointA, b: measurePointB };
  }, [measurePointA, measurePointB]);

  // Map Click Listener for Interactive Distance Measurement (Evacuation Path)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const container = map.getContainer();

    if (!isMeasuring) {
      container.style.cursor = '';
      return;
    }

    container.style.cursor = 'crosshair';

    const handleMapMeasureClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const { a, b } = measurePointsRef.current;

      if (!a) {
        // Step 1: Set Point A (Origin)
        triggerMeasurePointHaptic();
        setMeasurePointA({
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          label: 'Evacuation Origin (Point A)',
          source: 'map_click',
        });
        setMeasurePointB(null);
      } else if (!b) {
        // Step 2: Set Point B (Refuge / Target)
        triggerMeasureCompleteHaptic();
        setMeasurePointB({
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          label: 'Evacuation Destination (Point B)',
          source: 'map_click',
        });
      } else {
        // Both were already set: clicking begins a fresh new measurement starting with Point A
        triggerMeasurePointHaptic();
        setMeasurePointA({
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          label: 'Evacuation Origin (Point A)',
          source: 'map_click',
        });
        setMeasurePointB(null);
      }
    };

    map.on('click', handleMapMeasureClick);
    return () => {
      container.style.cursor = '';
      map.off('click', handleMapMeasureClick);
    };
  }, [isMeasuring]);

  // Precise Calculated Distance between Point A & Point B (in km)
  const calculatedDistanceKm = useMemo(() => {
    if (!measurePointA || !measurePointB) return null;
    return calculatePreciseDistanceKm(
      measurePointA.lat,
      measurePointA.lng,
      measurePointB.lat,
      measurePointB.lng
    );
  }, [measurePointA, measurePointB]);

  // Distance in statute miles
  const calculatedDistanceMiles = useMemo(() => {
    if (calculatedDistanceKm === null) return null;
    return Math.round(calculatedDistanceKm * 0.621371 * 10) / 10;
  }, [calculatedDistanceKm]);

  // Evacuation travel duration diagnostics for walking, biking, driving, and aeromedical
  const evacuationEstimates = useMemo(() => {
    if (calculatedDistanceKm === null) return null;
    const d = calculatedDistanceKm;

    const calcDuration = (speedKmH: number) => {
      const totalHours = d / speedKmH;
      const hours = Math.floor(totalHours);
      const minutes = Math.round((totalHours - hours) * 60);
      if (hours === 0) return `${minutes} min${minutes !== 1 ? 's' : ''}`;
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    };

    return {
      walking: calcDuration(4.5),       // average pedestrian evacuation pace (4.5 km/h)
      running: calcDuration(9.0),       // rapid march / run (9 km/h)
      bicycle: calcDuration(16.0),      // bicycle / e-bike / light mobility (16 km/h)
      vehicle: calcDuration(45.0),      // convoy / emergency 4x4 in disaster terrain (45 km/h)
      helicopter: calcDuration(220.0),  // aeromedical extraction (220 km/h)
    };
  }, [calculatedDistanceKm]);

  // Evacuation Corridor Hazard Detection
  const corridorHazardDiagnostics: {
    closestHazard: CalamityEvent | null;
    distanceToClosestKm: number | null;
    isDangerZone: boolean;
    isCautionZone: boolean;
  } | null = useMemo(() => {
    if (!measurePointA || !measurePointB) return null;
    const pool = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    
    const midLat = (measurePointA.lat + measurePointB.lat) / 2;
    const midLng = (measurePointA.lng + measurePointB.lng) / 2;

    let closestDist = Infinity;
    let closestEv: CalamityEvent | null = null;

    pool.forEach(ev => {
      const distA = calculatePreciseDistanceKm(measurePointA.lat, measurePointA.lng, ev.coordinates.lat, ev.coordinates.lng);
      const distB = calculatePreciseDistanceKm(measurePointB.lat, measurePointB.lng, ev.coordinates.lat, ev.coordinates.lng);
      const distMid = calculatePreciseDistanceKm(midLat, midLng, ev.coordinates.lat, ev.coordinates.lng);
      const minD = Math.min(distA, distB, distMid);
      if (minD < closestDist) {
        closestDist = minD;
        closestEv = ev;
      }
    });

    return {
      closestHazard: closestEv,
      distanceToClosestKm: closestDist < Infinity ? closestDist : null,
      isDangerZone: closestDist <= 50,
      isCautionZone: closestDist > 50 && closestDist <= 120,
    };
  }, [measurePointA, measurePointB, showAllCalamities, allEvents, events]);

  // Dedicated Visual Layer for Distance Measurement (Point A, Point B, Evacuation Polyline, Midpoint Label)
  useEffect(() => {
    if (!mapInstanceRef.current || !measureLayerRef.current) return;
    const measureGroup = measureLayerRef.current;
    measureGroup.clearLayers();

    if (!measurePointA) return;

    // 1. Point A: Evacuation Origin Marker
    const iconA = L.divIcon({
      className: 'custom-measure-point-a',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2 rounded-full bg-emerald-500/40 animate-ping"></div>
          <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-xs font-mono">
            A
          </div>
          <div class="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-slate-950/95 border border-emerald-500 text-emerald-300 text-[10px] font-black shadow-xl">
            ORIGIN
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const markerA = L.marker([measurePointA.lat, measurePointA.lng], {
      icon: iconA,
      zIndexOffset: 1200,
    });
    markerA.bindTooltip(`📍 <strong>Point A (Evacuation Origin)</strong><br/><span style="font-family:monospace;font-size:10px">${measurePointA.lat.toFixed(4)}°N, ${measurePointA.lng.toFixed(4)}°E</span>`, {
      direction: 'top',
      offset: [0, -18],
    });
    measureGroup.addLayer(markerA);

    // 2. Point B: Evacuation Refuge / Destination Marker & Polyline Transition
    if (!measurePointB) return;

    const iconB = L.divIcon({
      className: 'custom-measure-point-b',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute -inset-2 rounded-full bg-cyan-400/40 animate-ping"></div>
          <div class="w-8 h-8 rounded-full bg-cyan-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-xs font-mono">
            B
          </div>
          <div class="absolute top-9 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-slate-950/95 border border-cyan-400 text-cyan-300 text-[10px] font-black shadow-xl">
            REFUGE
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const markerB = L.marker([measurePointB.lat, measurePointB.lng], {
      icon: iconB,
      zIndexOffset: 1200,
    });
    markerB.bindTooltip(`🏁 <strong>Point B (Evacuation Destination)</strong><br/><span style="font-family:monospace;font-size:10px">${measurePointB.lat.toFixed(4)}°N, ${measurePointB.lng.toFixed(4)}°E</span>`, {
      direction: 'top',
      offset: [0, -18],
    });
    measureGroup.addLayer(markerB);

    // Interpolate Great Circle Arc for curved high-accuracy line (36 points for smooth curve)
    const arcPoints = interpolateGreatCirclePoints(
      measurePointA.lat,
      measurePointA.lng,
      measurePointB.lat,
      measurePointB.lng,
      36
    );

    // Glow shadow line with animated pulse
    const glowLine = L.polyline([arcPoints[0], arcPoints[0]], {
      className: 'animated-evacuation-glow',
      color: '#0891b2',
      weight: 7,
      opacity: 0.6,
      lineCap: 'round',
    });
    measureGroup.addLayer(glowLine);

    // Primary vibrant dashed animated path line
    const pathLine = L.polyline([arcPoints[0], arcPoints[0]], {
      className: 'animated-evacuation-line',
      color: '#22d3ee',
      weight: 4,
      dashArray: '12, 10',
      opacity: 0.95,
      lineCap: 'round',
    });
    measureGroup.addLayer(pathLine);

    // Animated directional runner beacon riding along the path
    const runnerIcon = L.divIcon({
      className: 'custom-measure-runner',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-4 h-4 rounded-full bg-cyan-300 border-2 border-white shadow-xl animate-ping opacity-90"></div>
          <div class="absolute w-3.5 h-3.5 rounded-full bg-cyan-400 border border-white shadow-lg flex items-center justify-center">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const runnerMarker = L.marker(arcPoints[0], {
      icon: runnerIcon,
      zIndexOffset: 1250,
    });
    measureGroup.addLayer(runnerMarker);

    // Midpoint measurement badge
    const midLat = (measurePointA.lat + measurePointB.lat) / 2;
    const midLng = (measurePointA.lng + measurePointB.lng) / 2;
    const distKm = calculatePreciseDistanceKm(
      measurePointA.lat,
      measurePointA.lng,
      measurePointB.lat,
      measurePointB.lng
    );
    const distMi = Math.round(distKm * 0.621371 * 10) / 10;

    const midBadgeIcon = L.divIcon({
      className: 'custom-measure-midpoint',
      html: `
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/95 border-2 border-cyan-400 text-white shadow-2xl font-mono text-xs font-bold whitespace-nowrap cursor-pointer hover:scale-105 transition-transform animate-fadeIn">
          <span class="text-amber-400">📏</span>
          <span class="text-cyan-300 font-black">${distKm.toLocaleString()} km</span>
          <span class="text-slate-400 text-[10px]">(${distMi} mi)</span>
        </div>
      `,
      iconSize: [120, 26],
      iconAnchor: [60, 13],
    });

    const midMarker = L.marker([midLat, midLng], {
      icon: midBadgeIcon,
      zIndexOffset: 1300,
    });
    midMarker.bindTooltip(`
      <div style="font-family:sans-serif;font-size:11px;line-height:1.4">
        <strong style="color:#22d3ee">📏 Evacuation Path Length</strong><br/>
        <strong>${distKm.toLocaleString()} km</strong> (${distMi} miles)<br/>
        <span style="color:#94a3b8">Walking (~4.5 km/h): ${(distKm / 4.5).toFixed(1)} hrs</span>
      </div>
    `, { direction: 'top', offset: [0, -10] });

    // Smooth progressive draw animation from Point A along arc to Point B
    let animId: number;
    let loopTimeout: ReturnType<typeof setTimeout>;
    const startTime = performance.now();
    const duration = 850; // ms for transition

    const animateTransition = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out curve
      const ease = 1 - Math.pow(1 - progress, 3);
      const pointCount = Math.max(2, Math.floor(ease * (arcPoints.length - 1)) + 1);
      const currentSlice = arcPoints.slice(0, pointCount);

      glowLine.setLatLngs(currentSlice);
      pathLine.setLatLngs(currentSlice);
      const tipCoord = currentSlice[currentSlice.length - 1];
      runnerMarker.setLatLng(tipCoord);

      if (progress < 1) {
        animId = requestAnimationFrame(animateTransition);
      } else {
        glowLine.setLatLngs(arcPoints);
        pathLine.setLatLngs(arcPoints);
        measureGroup.addLayer(midMarker);

        // Keep directional beacon gently traversing from A to B every few seconds to indicate heading
        let patrolIdx = 0;
        const stepPatrol = () => {
          patrolIdx = (patrolIdx + 1) % arcPoints.length;
          runnerMarker.setLatLng(arcPoints[patrolIdx]);
          loopTimeout = setTimeout(stepPatrol, 65);
        };
        loopTimeout = setTimeout(stepPatrol, 1200);
      }
    };

    animId = requestAnimationFrame(animateTransition);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(loopTimeout);
    };
  }, [measurePointA, measurePointB, measureAnimationTrigger]);

  // Actions for Distance Measurement Tool
  const handleFitMeasurement = () => {
    if (!mapInstanceRef.current || !measurePointA || !measurePointB) return;
    mapInstanceRef.current.fitBounds(
      [
        [measurePointA.lat, measurePointA.lng],
        [measurePointB.lat, measurePointB.lng],
      ],
      { padding: [60, 60], maxZoom: 14 }
    );
  };

  const handleResetMeasurement = () => {
    triggerActionHaptic();
    setMeasurePointA(null);
    setMeasurePointB(null);
  };

  const handleSwapMeasurementPoints = () => {
    if (!measurePointA || !measurePointB) return;
    triggerActionHaptic();
    const temp = measurePointA;
    setMeasurePointA(measurePointB);
    setMeasurePointB(temp);
  };

  const handleSetPointAToUserLocation = () => {
    if (activeUserLocation) {
      setMeasurePointA({
        lat: activeUserLocation.lat,
        lng: activeUserLocation.lng,
        label: `My Location (${activeUserLocation.name})`,
        source: 'user_location',
      });
      if (mapInstanceRef.current) {
        safeFlyTo(mapInstanceRef.current, activeUserLocation.lat, activeUserLocation.lng, 8, { duration: 1 });
      }
    }
  };

  const handleSetPointBToSelectedEvent = () => {
    if (selectedEvent) {
      setMeasurePointB({
        lat: selectedEvent.coordinates.lat,
        lng: selectedEvent.coordinates.lng,
        label: `${selectedEvent.name} (${selectedEvent.city})`,
        source: 'calamity',
      });
    }
  };

  // Update Heatmap Overlay: Population Density relative to Active Catastrophe Zones
  useEffect(() => {
    if (!mapInstanceRef.current || !heatmapLayerRef.current) return;
    const heatmapGroup = heatmapLayerRef.current;
    heatmapGroup.clearLayers();

    if (!showHeatmap) return;

    const candidateEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    const heatmapEvents = (!showAllCalamities && filteredType !== 'all') 
      ? candidateEvents.filter(e => e.type === filteredType) 
      : candidateEvents;

    // 1. Render Global Population Density Nodes (when mode is blended or population_only)
    if (heatmapMode === 'blended' || heatmapMode === 'population_only') {
      GLOBAL_POPULATION_HUBS.forEach((hub) => {
        let radiusMeters = 55000;
        let color = '#f59e0b';
        let fillColor = '#ea580c';

        if (hub.category === 'MEGACITY') {
          radiusMeters = 110000;
          color = '#ef4444';
          fillColor = '#dc2626';
        } else if (hub.category === 'MAJOR_METRO') {
          radiusMeters = 75000;
          color = '#f97316';
          fillColor = '#ea580c';
        } else {
          radiusMeters = 45000;
          color = '#eab308';
          fillColor = '#f59e0b';
        }

        const outerCircle = L.circle([hub.coordinates.lat, hub.coordinates.lng], {
          radius: radiusMeters * 1.6,
          stroke: false,
          fillColor: fillColor,
          fillOpacity: 0.12 * heatmapOpacity,
          interactive: false,
        });

        const coreCircle = L.circle([hub.coordinates.lat, hub.coordinates.lng], {
          radius: radiusMeters,
          color: color,
          weight: 1,
          opacity: 0.45 * heatmapOpacity,
          fillColor: fillColor,
          fillOpacity: 0.32 * heatmapOpacity,
        });

        coreCircle.bindTooltip(
          `
          <div class="text-xs p-1">
            <div class="font-bold text-slate-100 flex items-center gap-1">
              <span>👥 ${hub.name}</span>
            </div>
            <div class="text-[11px] text-amber-300 font-mono mt-0.5">
              Population: ${(hub.metroPopulation / 1000000).toFixed(1)} Million
            </div>
            <div class="text-[10px] text-slate-400 font-mono">
              Density: ${hub.densityPerKm2.toLocaleString()} people/km²
            </div>
          </div>
          `,
          { className: 'leaflet-tooltip-dark', direction: 'top', offset: [0, -5] }
        );

        heatmapGroup.addLayer(outerCircle);
        heatmapGroup.addLayer(coreCircle);
      });
    }

    // 2. Render Active Hazard Intensity & Impact Dispersion Footprints
    if (heatmapMode === 'blended' || heatmapMode === 'catastrophe_only' || heatmapMode === 'hazard_intensity') {
      heatmapEvents.forEach((ev) => {
        const meta = CALAMITY_METADATA_LIST.find((m) => m.id === ev.type);
        const hazardColor = meta?.color || '#ef4444';

        // Calculate physical hazard intensity and realistic thermal/seismic attenuation radii (in km)
        let coreRadiusKm = Math.max(ev.publicAdvisory.evacuationZoneKm || 15, 12);
        let intensityScale = 'Standard Catastrophe Zone';

        if (ev.type === 'earthquake') {
          const mag = parseFloat(String(ev.intensity.value)) || (ev.severity === 'CRITICAL' ? 7.6 : 6.2);
          coreRadiusKm = Math.max(25, Math.pow(10, (mag - 4.5) * 0.75) * 12);
          intensityScale = `Peak Ground Acceleration (PGA ~${(mag * 0.08).toFixed(2)}g / MMI ${mag >= 7.5 ? 'VIII–IX' : 'VI–VII'})`;
        } else if (ev.type === 'cyclone' || ev.type === 'tornado') {
          coreRadiusKm = ev.severity === 'CRITICAL' ? 110 : 60;
          intensityScale = 'Gale-Force Wind Radius (Saffir-Simpson Scale)';
        } else if (ev.type === 'wildfire') {
          coreRadiusKm = ev.severity === 'CRITICAL' ? 45 : 22;
          intensityScale = 'Fire Radiative Power (FRP) & Active Thermal Front';
        } else if (ev.type === 'volcano') {
          coreRadiusKm = ev.severity === 'CRITICAL' ? 65 : 30;
          intensityScale = 'Volcanic Explosivity Index (VEI) Ash & Blast Zone';
        } else if (ev.type === 'tsunami') {
          coreRadiusKm = ev.severity === 'CRITICAL' ? 85 : 40;
          intensityScale = 'Near-Shore Inundation & Wave Surge Corridor';
        } else if (ev.type === 'flood') {
          coreRadiusKm = ev.severity === 'CRITICAL' ? 55 : 25;
          intensityScale = 'Hydrodynamic Floodplain Inundation Envelope';
        }

        const coreMeters = coreRadiusKm * 1000;
        const midMeters = coreRadiusKm * 2.2 * 1000;
        const outerMeters = coreRadiusKm * 4.2 * 1000;

        // Outer Attenuation / Dispersion Envelope (Yellow / Heat Fringe)
        const outerCircle = L.circle([ev.coordinates.lat, ev.coordinates.lng], {
          radius: outerMeters,
          color: '#eab308',
          weight: 1,
          dashArray: '3, 4',
          opacity: 0.35 * heatmapOpacity,
          fillColor: '#fde047',
          fillOpacity: 0.08 * heatmapOpacity,
          interactive: false,
        });

        // Mid-Intensity Dispersion Zone (Amber / Orange)
        const midCircle = L.circle([ev.coordinates.lat, ev.coordinates.lng], {
          radius: midMeters,
          color: '#f97316',
          weight: 1.5,
          opacity: 0.65 * heatmapOpacity,
          fillColor: '#ea580c',
          fillOpacity: 0.18 * heatmapOpacity,
          interactive: false,
        });

        // Core Destructive Epicenter / Burn Zone (Crimson / Deep Red)
        const isCrit = ev.severity === 'CRITICAL';
        const coreCircle = L.circle([ev.coordinates.lat, ev.coordinates.lng], {
          radius: coreMeters,
          color: isCrit ? '#dc2626' : hazardColor,
          weight: 2,
          opacity: 0.95 * heatmapOpacity,
          fillColor: isCrit ? '#ef4444' : '#f97316',
          fillOpacity: 0.38 * heatmapOpacity,
          interactive: true,
        });

        const exposedPop = ev.medicalEmergency.affectedPopulation;
        const tooltipContent = `
          <div class="text-xs p-2 max-w-xs bg-slate-950 text-slate-100 rounded-lg shadow-xl font-sans">
            <div class="flex items-center justify-between pb-1 border-b border-slate-800 gap-2">
              <span class="font-black text-rose-400 uppercase tracking-wider text-[10px] flex items-center gap-1">
                <span>🔥</span> HAZARD INTENSITY HEATMAP
              </span>
              <span class="px-1.5 py-0.2 rounded font-mono font-bold text-[9px] ${
                isCrit ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }">
                ${ev.severity}
              </span>
            </div>
            <div class="font-bold text-white text-sm mt-1 leading-snug">${ev.name}</div>
            <div class="text-[11px] text-slate-300 mt-0.5">📍 ${ev.city}, ${ev.country}</div>
            
            <div class="mt-2 pt-1.5 border-t border-slate-800 space-y-1 font-mono text-[10px]">
              <div class="flex items-center justify-between text-amber-300 font-bold">
                <span class="font-sans text-slate-400">Hazard Energy:</span>
                <span>${ev.intensity?.value || 'High'}</span>
              </div>
              <div class="text-slate-400 text-[9px] font-sans italic">
                ${intensityScale}
              </div>
              <div class="flex items-center justify-between text-rose-300 pt-1 border-t border-slate-900">
                <span class="font-sans text-slate-400">Core Destruction:</span>
                <span>${Math.round(coreRadiusKm)} km radius</span>
              </div>
              <div class="flex items-center justify-between text-yellow-300">
                <span class="font-sans text-slate-400">Dispersion Boundary:</span>
                <span>${Math.round(coreRadiusKm * 4.2)} km buffer</span>
              </div>
              <div class="flex items-center justify-between text-cyan-300 pt-0.5 border-t border-slate-800/80">
                <span class="font-sans text-slate-400">Population at Risk:</span>
                <span>${exposedPop.toLocaleString()} citizens</span>
              </div>
            </div>
          </div>
        `;

        coreCircle.bindTooltip(tooltipContent, {
          className: 'leaflet-tooltip-dark',
          direction: 'top',
          offset: [0, -10],
        });

        coreCircle.on('click', () => handleSelectEventWithHaptic(ev));
        midCircle.on('click', () => handleSelectEventWithHaptic(ev));

        heatmapGroup.addLayer(outerCircle);
        heatmapGroup.addLayer(midCircle);
        heatmapGroup.addLayer(coreCircle);
      });
    }
  }, [events, allEvents, showAllCalamities, filteredType, showHeatmap, heatmapOpacity, heatmapMode, onSelectEvent]);

  // All disaster events currently displayed/active on the map based on filters
  const currentVisibleEvents = useMemo(() => {
    // Priority: use the filtered events passed from parent, or allEvents if showAllCalamities is toggled
    const candidateEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    let mapEvents = (!showAllCalamities && filteredType !== 'all')
      ? candidateEvents.filter(e => e.type === filteredType)
      : candidateEvents;

    // Apply dashboard-level temporal filtering if events prop was passed
    if (!showAllCalamities) {
      mapEvents = events;
    }

    if (legendSeverityFilter !== 'all') {
      mapEvents = mapEvents.filter(e => e.severity === legendSeverityFilter);
    }

    if (timeReplayWindow !== 'all') {
      const now = Date.now();
      const cutoffHours = timeReplayWindow === '24h' ? 24 : timeReplayWindow === '48h' ? 48 : timeReplayWindow === '7d' ? 168 : 720;
      const cutoffMs = cutoffHours * 3600 * 1000;
      mapEvents = mapEvents.filter(e => {
        if (!e.occurredAt) return true;
        const evTime = new Date(e.occurredAt).getTime();
        return (now - evTime) <= cutoffMs;
      });
    }

    return mapEvents;
  }, [showAllCalamities, allEvents, events, filteredType, legendSeverityFilter, timeReplayWindow]);

  // Machine Learning Forecast Hotspots for current map state
  const currentForecastHotspots = useMemo(() => {
    const candidateEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;
    const raw = generateMLHazardHotspots(candidateEvents, forecastHorizon);
    return filterPredictiveHotspots(raw, forecastMinProbability, forecastHorizon, filteredType);
  }, [allEvents, events, showAllCalamities, forecastHorizon, forecastMinProbability, filteredType]);

  // Handler for 'Zoom to All' control button: automatically pans and zooms the map to fit all currently visible disaster event markers
  const handleZoomToAll = useCallback(() => {
    if (!mapInstanceRef.current || currentVisibleEvents.length === 0) return;
    const map = mapInstanceRef.current;

    const validEvents = currentVisibleEvents.filter(
      ev => ev?.coordinates && Number.isFinite(ev.coordinates.lat) && Number.isFinite(ev.coordinates.lng)
    );

    if (validEvents.length === 0) return;

    if (validEvents.length === 1) {
      const ev = validEvents[0];
      safeFlyTo(map, ev.coordinates.lat, ev.coordinates.lng, 7.5, { duration: 1.2 });
      return;
    }

    const latLngs = validEvents.map(e => [e.coordinates.lat, e.coordinates.lng] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10, animate: true });
    }
  }, [currentVisibleEvents]);

  // Update Disaster Markers with Local Hazard Alert highlighting
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();
    markersMapRef.current.clear();

    const mapEvents = currentVisibleEvents;

    mapEvents.forEach(ev => {
      if (!ev || !ev.coordinates || !Number.isFinite(ev.coordinates.lat) || !Number.isFinite(ev.coordinates.lng)) {
        return;
      }
      const meta = CALAMITY_METADATA_LIST.find(m => m.id === ev.type);
      const iconInfo = CALAMITY_MAP_ICONS[ev.type] || { emoji: '⚠️', label: ev.type, color: meta?.color || '#f59e0b' };
      const color = meta?.color || iconInfo.color;
      const isCritical = ev.severity === 'CRITICAL';
      const isSelected = selectedEvent?.id === ev.id;
      const isLive = ev.isLiveFeed;

      // Geolocation proximity evaluation
      const distToUser = activeUserLocation
        ? calculateDistanceKm(
            activeUserLocation.lat,
            activeUserLocation.lng,
            ev.coordinates.lat,
            ev.coordinates.lng
          )
        : null;

      // SPECIFIC LOCAL HAZARD ALERT: CRITICAL calamity within 500km radius!
      const isLocalHazardAlert = isCritical && distToUser !== null && distToUser <= 500;

      // Event located within currently searched location sector
      const isSearchedLocationEvent = searchedLocationInfo
        ? searchedLocationInfo.events.some(item => item.event.id === ev.id)
        : false;

      const ringClass = isLocalHazardAlert
        ? 'ring-4 ring-rose-500 animate-pulse'
        : isSearchedLocationEvent
        ? 'ring-4 ring-amber-400 animate-bounce'
        : isLive 
        ? 'ring-2 ring-emerald-400 animate-pulse' 
        : isSelected 
        ? 'ring-4 ring-white' 
        : 'ring-2 ring-slate-900';

      const clockInfo = resolveDisasterLocalClock(
        ev.occurredAt || ev.updatedAt,
        ev.coordinates.lat,
        ev.coordinates.lng,
        ev.country,
        ev.city,
        ev.occurrenceTimeLocal
      );

      const shortDate = clockInfo.localDateFormatted
        ? clockInfo.localDateFormatted.replace(/, \d{4}/, '')
        : (ev.occurredAt ? ev.occurredAt.substring(5, 10) : 'Recent');

      const shortTime = clockInfo.localTime12h
        ? clockInfo.localTime12h.replace(/:\d{2} /, ' ')
        : (ev.occurredAt ? ev.occurredAt.substring(11, 16) : 'Live');

      // Custom pulsing HTML marker with Calamity Emoji & Occurrence Date/Time badge
      const customIcon = L.divIcon({
        className: 'custom-calamity-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer group">
            <span class="absolute top-0 inline-flex ${isLocalHazardAlert ? 'h-14 w-14 bg-rose-500' : 'h-8 w-8'} rounded-full opacity-75 animate-ping pointer-events-none" style="background-color: ${isLocalHazardAlert ? '#f43f5e' : color};"></span>
            ${isLive ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 z-20"></span>' : ''}
            
            <span class="relative inline-flex items-center justify-center rounded-full text-xs font-bold text-white shadow-2xl transition-transform ${isSelected || isLocalHazardAlert ? 'scale-125' : 'scale-100'} ${ringClass}" style="background-color: ${isLocalHazardAlert ? '#e11d48' : color}; width: ${isCritical ? '28px' : '24px'}; height: ${isCritical ? '28px' : '24px'};">
              ${isLocalHazardAlert ? '🚨' : iconInfo.emoji}
            </span>

            ${showDateTimeTags ? `
              <!-- Visible Date & Time of Occurrence Tag directly on map surface -->
              <div class="mt-1 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-950/95 border border-slate-700/80 shadow-2xl text-[9px] font-mono font-bold text-amber-300 flex items-center gap-1 backdrop-blur-sm z-20 pointer-events-none">
                <span class="text-slate-400 text-[8px]">📅</span>
                <span>${shortDate}</span>
                <span class="text-slate-600">•</span>
                <span class="text-slate-400 text-[8px]">⏰</span>
                <span>${shortTime}</span>
              </div>
            ` : ''}

            ${isLocalHazardAlert ? `
              <!-- Specific Local Hazard Alert Badge anchored below marker -->
              <div class="mt-0.5 whitespace-nowrap px-1.5 py-0.2 rounded bg-rose-600 border border-white text-[8px] font-black text-white shadow-2xl animate-pulse flex items-center gap-0.5 z-30 ring-1 ring-rose-400">
                <span>🚨 LOCAL HAZARD</span>
                <span class="opacity-95 font-mono">(${distToUser}km)</span>
              </div>
            ` : ''}
          </div>
        `,
        iconSize: [96, showDateTimeTags ? 58 : 32],
        iconAnchor: [48, 16],
      });

      const marker = L.marker([ev.coordinates.lat, ev.coordinates.lng], {
        icon: customIcon,
        title: `${ev.name} • ${meta?.title} • ${clockInfo.localDateFormatted} ${clockInfo.localTime12h}`,
      });

      // Bind rich popup featuring complete Occurrence Date and Time
      const popupContent = `
        <div class="p-3 text-xs max-w-xs font-sans bg-slate-950 text-slate-100 rounded-lg">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800 gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-base">${iconInfo.emoji}</span>
              <span class="font-bold text-amber-400 text-xs uppercase">${meta?.title || ev.type}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                ev.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                ev.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }">
                ${ev.severity}
              </span>
              <button
                type="button"
                onclick="window.__closeMapPopup && window.__closeMapPopup()"
                class="w-5 h-5 flex items-center justify-center rounded bg-slate-800 hover:bg-rose-900/80 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                title="Close notification (See map clearly)"
                aria-label="Close notification"
              >
                ✕
              </button>
            </div>
          </div>

          <div class="font-bold text-sm text-white mt-2 leading-tight">${ev.name}</div>
          <div class="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1">
            <span>📍 ${ev.city}, ${ev.country}</span>
          </div>

          <!-- PROMINENT DATE & TIME OF OCCURRENCE SECTION -->
          <div class="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px]">
            <div class="flex items-center justify-between text-amber-300 font-bold">
              <span class="flex items-center gap-1 text-slate-400 font-sans">📅 Date of Occurrence:</span>
              <span>${clockInfo.localDateFormatted}</span>
            </div>
            <div class="flex items-center justify-between text-amber-300 font-bold">
              <span class="flex items-center gap-1 text-slate-400 font-sans">⏰ Time of Occurrence:</span>
              <span>${clockInfo.localTime12h} (${clockInfo.utcFormatted.substring(11, 19)} UTC)</span>
            </div>
            <div class="flex items-center justify-between text-cyan-400 text-[10px]">
              <span class="text-slate-400 font-sans">🌐 Timezone:</span>
              <span>${clockInfo.timezoneName}</span>
            </div>
            ${ev.occurredAt ? `
              <div class="flex items-center justify-between text-emerald-400 text-[10px] pt-0.5 border-t border-slate-800">
                <span class="text-slate-400 font-sans">⏳ Elapsed:</span>
                <span>${formatTimeElapsed(ev.occurredAt) || 'Recent Incident'}</span>
              </div>
            ` : ''}
          </div>

          <!-- Scientific Intensity & Danger Zone -->
          <div class="mt-2 pt-1.5 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <span class="text-slate-500">Intensity:</span>
              <div class="font-bold text-slate-200">${ev.intensity.value}</div>
            </div>
            <div>
              <span class="text-slate-500">Danger Zone:</span>
              <div class="font-bold text-amber-400">${(ev.medicalEmergency?.affectedPopulation || 0).toLocaleString()} in Zone</div>
            </div>
          </div>

          <!-- 50km Visual Hazard Radius Impact Zone -->
          <div class="mt-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-[10px] font-mono">
            <span class="text-amber-300 font-bold flex items-center gap-1 font-sans">
              <span>⚠️</span> 50 km Hazard Radius:
            </span>
            <span class="text-white font-bold">~7,854 km² Zone</span>
          </div>

          ${isLocalHazardAlert ? `
            <div class="mt-2 p-1 rounded bg-rose-950/80 border border-rose-500/60 text-rose-300 text-[10px] font-bold flex items-center justify-between">
              <span>🚨 Local Hazard Alert</span>
              <span>${distToUser} km away</span>
            </div>
          ` : ''}

          <!-- Direct Actions -->
          <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5">
            <button
              onclick="window.__selectDisasterEvent && window.__selectDisasterEvent('${ev.id}')"
              class="flex-1 py-1 px-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-center text-[10px] transition-colors cursor-pointer"
            >
              Diagnostics
            </button>
            <button
              onclick="window.__selectDisasterEvent && window.__selectDisasterEvent('${ev.id}'); window.__fitHazardRadius && window.__fitHazardRadius(${ev.coordinates.lat}, ${ev.coordinates.lng});"
              class="py-1 px-2 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-mono text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Fit 50km hazard radius impact zone in view"
            >
              <span>50km Zone</span> 🎯
            </button>
            <a
              href="https://www.google.com/maps?q=${ev.coordinates.lat},${ev.coordinates.lng}"
              target="_blank"
              rel="noopener noreferrer"
              class="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 font-mono text-[10px] flex items-center gap-1 transition-colors"
            >
              <span>Maps</span> ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'leaflet-popup-dark',
        maxWidth: 320,
      });

      // Bind rich tooltip on hover
      marker.bindTooltip(`
        <div class="p-1 text-xs font-sans max-w-xs">
          <div class="font-bold text-white flex items-center gap-1">
            <span>${iconInfo.emoji}</span>
            <span>${ev.name}</span>
          </div>
          <div class="text-[11px] text-slate-300">${ev.city}, ${ev.country}</div>
          <div class="mt-1 pt-1 border-t border-slate-700 font-mono text-[10px] text-amber-300">
            📅 ${clockInfo.localDateFormatted} • ⏰ ${clockInfo.localTime12h} (${clockInfo.utcFormatted.substring(11, 16)} UTC)
          </div>
        </div>
      `, {
        className: 'leaflet-tooltip-dark',
        direction: 'top',
        offset: [0, -18],
      });

      marker.on('click', () => {
        handleSelectEventWithHaptic(ev);
      });

      // Draw actual Hazard Area Footprint (Polygon / Inundation / Isoseismal Boundary) instead of just a dot
      const isSelectedEvent = selectedEvent?.id === ev.id;
      const hazardColor = isColorblindMode 
        ? (ev.severity === 'CRITICAL' ? '#d55e00' : ev.severity === 'HIGH' ? '#e69f00' : '#56b4e9')
        : color;

      const evacKm = Math.max(ev.publicAdvisory?.evacuationZoneKm || 15, 6);

      if (ev.hazardAreaPolygon && ev.hazardAreaPolygon.length >= 3) {
        const hazardPoly = L.polygon(ev.hazardAreaPolygon, {
          color: hazardColor,
          weight: isSelectedEvent ? 2.5 : 1.5,
          fillColor: hazardColor,
          fillOpacity: isSelectedEvent ? 0.30 : 0.15,
          dashArray: ev.type === 'cyclone' ? '4, 4' : undefined,
        });
        hazardPoly.on('click', () => handleSelectEventWithHaptic(ev));
        markersGroup.addLayer(hazardPoly);
      } else {
        const areaCircle = L.circle([ev.coordinates.lat, ev.coordinates.lng], {
          radius: evacKm * 1000,
          color: hazardColor,
          weight: isSelectedEvent ? 2.5 : 1.5,
          fillColor: hazardColor,
          fillOpacity: isSelectedEvent ? 0.22 : 0.10,
          dashArray: '5, 5',
        });
        areaCircle.on('click', () => handleSelectEventWithHaptic(ev));
        markersGroup.addLayer(areaCircle);
      }

      markersGroup.addLayer(marker);
      markersMapRef.current.set(ev.id, marker);
    });
  }, [currentVisibleEvents, showDateTimeTags, selectedEvent, activeUserLocation, searchedLocationInfo, onSelectEvent, isColorblindMode]);

  // Generate simulated emergency resources for the current visible viewport
  const updateViewportResources = useCallback(() => {
    if (!mapInstanceRef.current || !showResources) return;
    const map = mapInstanceRef.current;
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    const poolEvents = (allEvents && allEvents.length > 0) ? allEvents : events;
    const generated = generateViewportEmergencyResources(
      {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      zoom,
      poolEvents
    );
    setViewportResources(generated);
  }, [showResources, allEvents, events]);

  // Sync resources whenever showResources is toggled or map moves
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (showResources) {
      updateViewportResources();

      const handleViewportChange = () => {
        updateViewportResources();
      };

      map.on('moveend', handleViewportChange);
      return () => {
        map.off('moveend', handleViewportChange);
      };
    } else {
      setViewportResources([]);
      if (resourcesLayerRef.current) {
        resourcesLayerRef.current.clearLayers();
      }
    }
  }, [showResources, updateViewportResources]);

  // Render Emergency Relief Resources (Shelters, Water Stations, Medical Facilities)
  useEffect(() => {
    if (!mapInstanceRef.current || !resourcesLayerRef.current) return;
    const resGroup = resourcesLayerRef.current;
    resGroup.clearLayers();

    if (!showResources) return;

    const filteredList = resourceTypeFilter === 'all'
      ? viewportResources
      : viewportResources.filter(r => r.type === resourceTypeFilter);

    filteredList.forEach(res => {
      let iconEmoji = '⛺';
      let bgColor = '#10b981';
      let typeLabel = 'Emergency Shelter';
      let metricBadge = `${res.capacityTotal - res.capacityCurrent} beds open`;

      if (res.type === 'water') {
        iconEmoji = '💧';
        bgColor = '#0284c7';
        typeLabel = 'Water Station';
        metricBadge = `${(res.capacityTotal / 1000).toFixed(0)}k L/day`;
      } else if (res.type === 'medical') {
        iconEmoji = '🏥';
        bgColor = '#e11d48';
        typeLabel = 'Medical Facility';
        metricBadge = `${res.capacityTotal - res.capacityCurrent} ICU open`;
      }

      const statusDotColor = 
        res.status === 'OPERATIONAL' ? '#10b981' :
        res.status === 'LIMITED_CAPACITY' ? '#f59e0b' :
        res.status === 'CRITICAL_SHORTAGE' ? '#f43f5e' : '#a855f7';

      const isSelected = selectedResource?.id === res.id;

      const resourceIcon = L.divIcon({
        className: 'custom-resource-pin',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer group">
            <span class="absolute top-0 inline-flex h-8 w-8 rounded-full opacity-60 animate-ping pointer-events-none" style="background-color: ${bgColor};"></span>
            
            <span class="relative inline-flex items-center justify-center rounded-full text-xs font-bold text-white shadow-xl transition-transform ${isSelected ? 'scale-125 ring-4 ring-white' : 'scale-100 ring-2 ring-slate-950'}" style="background-color: ${bgColor}; width: 28px; height: 28px;">
              ${iconEmoji}
              <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950" style="background-color: ${statusDotColor};"></span>
            </span>

            <div class="mt-1 whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-950/95 border border-slate-700/80 shadow-2xl text-[9px] font-mono font-bold text-white flex items-center gap-1 backdrop-blur-sm pointer-events-none">
              <span>${iconEmoji}</span>
              <span class="truncate max-w-[80px]">${res.name.split(' ')[0]}</span>
              <span class="text-slate-500">•</span>
              <span class="text-amber-300">${metricBadge}</span>
            </div>
          </div>
        `,
        iconSize: [96, 56],
        iconAnchor: [48, 14],
      });

      const marker = L.marker([res.coordinates.lat, res.coordinates.lng], {
        icon: resourceIcon,
        title: `${res.name} • ${typeLabel} (${res.statusLabel})`,
      });

      const popupHtml = `
        <div class="p-3 text-xs max-w-xs font-sans bg-slate-950 text-slate-100 rounded-lg">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800 gap-2">
            <div class="flex items-center gap-1.5">
              <span class="text-base">${iconEmoji}</span>
              <span class="font-bold text-xs uppercase" style="color: ${bgColor};">${typeLabel}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-black border ${
              res.status === 'OPERATIONAL' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
              res.status === 'LIMITED_CAPACITY' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
              res.status === 'CRITICAL_SHORTAGE' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' :
              'bg-purple-500/20 text-purple-300 border-purple-500/40'
            }">
              ${res.statusLabel}
            </span>
          </div>

          <div class="font-bold text-sm text-white mt-2 leading-tight">${res.name}</div>
          <div class="text-[11px] text-slate-400 mt-0.5 font-mono">
            🏛️ ${res.organization}
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">
            📍 ${res.address}
          </div>

          <div class="mt-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px]">
            <div class="flex items-center justify-between text-slate-300">
              <span>Capacity Utilization:</span>
              <span class="font-bold text-white">${res.percentageUsed}%</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div class="h-2 rounded-full transition-all" style="width: ${res.percentageUsed}%; background-color: ${
                res.percentageUsed > 85 ? '#f43f5e' : res.percentageUsed > 70 ? '#f59e0b' : '#10b981'
              };"></div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
              <span>${res.capacityCurrent.toLocaleString()} In Use</span>
              <span>${res.capacityTotal.toLocaleString()} ${res.capacityUnit}</span>
            </div>
          </div>

          <div class="mt-2 space-y-1">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logistics & Amenities:</span>
            <div class="flex flex-wrap gap-1">
              ${res.supplies.map(s => `
                <span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                  ✓ ${s}
                </span>
              `).join('')}
            </div>
          </div>

          <div class="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-400">
            <div>
              <span>Comms:</span>
              <div class="text-cyan-400 font-bold">${res.radioFrequency}</div>
            </div>
            <div>
              <span>Est. Queue:</span>
              <div class="text-amber-400 font-bold">~${res.waitTimeMinutes || 10} mins</div>
            </div>
          </div>

          <div class="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <a
              href="https://www.google.com/maps?q=${res.coordinates.lat},${res.coordinates.lng}"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono text-[10px] text-center transition-colors"
            >
              Directions ↗
            </a>
            <button
              onclick="window.__copyGpsCoordinates ? window.__copyGpsCoordinates('${res.coordinates.lat}, ${res.coordinates.lng}') : null"
              class="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors cursor-pointer"
              title="Copy GPS coordinates"
            >
              📋 Copy GPS
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'leaflet-popup-dark',
        maxWidth: 320,
      });

      marker.bindTooltip(`
        <div class="p-1 text-xs font-sans">
          <div class="font-bold text-white flex items-center gap-1">
            <span>${iconEmoji}</span>
            <span>${res.name}</span>
          </div>
          <div class="text-[10px] text-slate-300 font-mono mt-0.5">
            ${res.statusLabel} • ${metricBadge}
          </div>
        </div>
      `, {
        className: 'leaflet-tooltip-dark',
        direction: 'top',
        offset: [0, -18],
      });

      marker.on('click', () => {
        triggerResourceMarkerHaptic();
        setSelectedResource(res);
      });

      resGroup.addLayer(marker);
    });
  }, [showResources, viewportResources, resourceTypeFilter, selectedResource]);

  const resourceSummary = useMemo(() => {
    return calculateViewportResourceSummary(viewportResources);
  }, [viewportResources]);

  const displayedResources = useMemo(() => {
    if (resourceTypeFilter === 'all') return viewportResources;
    return viewportResources.filter(r => r.type === resourceTypeFilter);
  }, [viewportResources, resourceTypeFilter]);

  // Master locator function: smooth flyTo, opens disaster popup, triggers animated tactical radar ping, and ensures visibility
  const triggerLocateHighlight = useCallback((target: CalamityEvent, zoomLevel = 8.5) => {
    if (!mapInstanceRef.current || !target.coordinates) return;
    const map = mapInstanceRef.current;
    const lat = target.coordinates.lat;
    const lng = target.coordinates.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // If target type is filtered out, reset filter so marker is rendered
    if (filteredType !== 'all' && filteredType !== target.type && onResetTypeFilter) {
      onResetTypeFilter();
    }

    // 1. Smoothly fly map to target coordinates
    safeFlyTo(map, lat, lng, zoomLevel, { duration: 1.2 });

    // 2. Open the Leaflet popup for this disaster marker
    setTimeout(() => {
      const marker = markersMapRef.current.get(target.id);
      if (marker && mapInstanceRef.current) {
        try {
          marker.openPopup();
        } catch (err) {
          console.warn('Could not open marker popup:', err);
        }
      }
    }, 380);

    // 3. Render animated radar ping ring on locatePulseLayerRef
    if (locatePulseLayerRef.current) {
      locatePulseLayerRef.current.clearLayers();
      const pingIcon = L.divIcon({
        className: 'locate-ping-icon',
        html: `
          <div class="relative flex items-center justify-center w-28 h-28 -ml-14 -mt-14 pointer-events-none select-none">
            <div class="absolute w-28 h-28 rounded-full bg-amber-400/30 animate-ping"></div>
            <div class="absolute w-18 h-18 rounded-full border-2 border-amber-400 animate-pulse"></div>
            <div class="absolute w-8 h-8 rounded-full bg-amber-500/40"></div>
            <div class="w-3.5 h-3.5 rounded-full bg-amber-300 ring-4 ring-amber-500/80 shadow-[0_0_16px_#f59e0b]"></div>
          </div>
        `,
        iconSize: [0, 0],
      });
      const pingMarker = L.marker([lat, lng], { icon: pingIcon, interactive: false });
      locatePulseLayerRef.current.addLayer(pingMarker);

      // Auto-remove ping pulse after 5 seconds
      setTimeout(() => {
        if (locatePulseLayerRef.current && locatePulseLayerRef.current.hasLayer(pingMarker)) {
          locatePulseLayerRef.current.removeLayer(pingMarker);
        }
      }, 5000);
    }
  }, [filteredType, onResetTypeFilter]);

  // Register window helpers for popup buttons (event selection & GPS clipboard copy)
  useEffect(() => {
    (window as any).__selectDisasterEvent = (id: string) => {
      const pool = allEvents && allEvents.length > 0 ? allEvents : events;
      const target = pool.find(e => e.id === id);
      if (target) {
        handleSelectEventWithHaptic(target);
      }
    };
    (window as any).__locateDisasterEvent = (idOrEvent: string | CalamityEvent) => {
      triggerActionHaptic();
      const pool = allEvents && allEvents.length > 0 ? allEvents : events;
      const target = typeof idOrEvent === 'string'
        ? pool.find(e => e.id === idOrEvent)
        : idOrEvent;
      if (target && target.coordinates) {
        onSelectEvent(target);
        triggerLocateHighlight(target, 8.5);
      }
    };
    const handleCustomLocate = (e: Event) => {
      const customEv = e as CustomEvent<CalamityEvent>;
      const target = customEv.detail;
      if (target && target.coordinates) {
        triggerLocateHighlight(target, 8.5);
      }
    };
    window.addEventListener('disaster:locate', handleCustomLocate);
    (window as any).__copyGpsCoordinates = (coords: string) => {
      copyToClipboard(coords);
    };
    (window as any).__fitHazardRadius = (lat: number, lng: number) => {
      triggerActionHaptic();
      if (mapInstanceRef.current && Number.isFinite(lat) && Number.isFinite(lng)) {
        try {
          const circle = L.circle([lat, lng], { radius: 50000 });
          mapInstanceRef.current.fitBounds(circle.getBounds(), { padding: [60, 60], maxZoom: 10, animate: true });
        } catch {
          safeFlyTo(mapInstanceRef.current, lat, lng, 8.5);
        }
      }
    };
    (window as any).__closeMapPopup = () => {
      triggerActionHaptic();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.closePopup();
      }
      if (onClearSelectedEvent) {
        onClearSelectedEvent();
      }
    };
    return () => {
      delete (window as any).__selectDisasterEvent;
      delete (window as any).__locateDisasterEvent;
      delete (window as any).__copyGpsCoordinates;
      delete (window as any).__fitHazardRadius;
      delete (window as any).__closeMapPopup;
      window.removeEventListener('disaster:locate', handleCustomLocate);
    };
  }, [allEvents, events, onSelectEvent, onClearSelectedEvent, triggerLocateHighlight]);

  // Track previous selected event to prevent redundant flyTo transitions
  const prevSelectedEventIdRef = useRef<string | null>(null);

  // Pan to selected event smoothly, or close popup if unselected
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (selectedEvent) {
      if (prevSelectedEventIdRef.current === selectedEvent.id) {
        return;
      }
      prevSelectedEventIdRef.current = selectedEvent.id;

      const lat = selectedEvent.coordinates?.lat;
      const lng = selectedEvent.coordinates?.lng;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        // Defer with requestAnimationFrame to ensure container dimensions are computed
        requestAnimationFrame(() => {
          triggerLocateHighlight(selectedEvent, 8.0);
        });
      }
    } else {
      prevSelectedEventIdRef.current = null;
      map.closePopup();
    }
  }, [selectedEvent, triggerLocateHighlight]);

  // When live feeds refresh, preserve the active selection if it still exists in the dataset.
  // If the currently selected event is no longer in the events list, cleanly clear the selection.
  useEffect(() => {
    if (feedStats?.lastUpdatedTimestamp && selectedEvent) {
      const pool = allEvents && allEvents.length > 0 ? allEvents : events;
      const stillExists = pool.some(e => e.id === selectedEvent.id);
      if (!stillExists && onClearSelectedEvent) {
        onClearSelectedEvent();
        if (mapInstanceRef.current) {
          mapInstanceRef.current.closePopup();
        }
      }
    }
  }, [feedStats?.lastUpdatedTimestamp, selectedEvent, events, allEvents, onClearSelectedEvent]);

  // Calamities pool count for header badge
  const activePoolEvents = (showAllCalamities && allEvents && allEvents.length > 0) ? allEvents : events;

  return (
    <div id="disaster-map-container" className="relative w-full h-full min-h-[460px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col">
      {/* Stale Data Warning Banner System at top of Map */}
      <StaleDataBanner
        feedStats={feedStats}
        lastUpdatedTimestamp={feedStats?.lastUpdatedTimestamp}
        isLoadingLive={isLoadingLive}
        onRefreshFeeds={onRefreshFeeds}
        staleThresholdMinutes={staleThresholdMinutes}
        onResizeMap={() => {
          setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
          }, 150);
        }}
      />

      {/* Map Viewport and Floating Tactical HUD */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        {/* Map Target */}
        <div ref={mapContainerRef} className="w-full h-full min-h-[460px]" />

        {/* Top Map Floating Bar: Search Box, Layer Switcher, All Hazards, Date/Time Tags, & Radar */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[95%]">
        {/* Interactive Map Location & Calamity Search Box */}
        <div ref={searchContainerRef} className="relative">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/90 hover:border-amber-500/50 focus-within:border-amber-400 rounded-lg p-1 shadow-lg text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1.5 mr-1" />
            <input
              type="text"
              placeholder="Search location or live event (e.g. Tokyo, Valencia)..."
              value={mapSearchQuery}
              onFocus={() => {
                if (mapSearchQuery.trim().length >= 2 || searchResults.length > 0) {
                  setIsSearchOpen(true);
                }
              }}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="bg-transparent text-xs text-slate-100 placeholder-slate-400 focus:outline-none w-44 sm:w-60 px-1 py-0.5"
            />
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin mr-1.5" />
            ) : mapSearchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setMapSearchQuery('');
                  setSearchResults([]);
                  setSearchedLocationInfo(null);
                  if (onSearchQueryChange) onSearchQueryChange('');
                }}
                className="text-slate-400 hover:text-slate-200 mr-1 p-0.5 cursor-pointer"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              type="submit"
              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer"
              title="Go to location"
            >
              Go
            </button>
          </form>

          {/* Inline Not Found Toast/Banner */}
          {searchNotFoundMessage && (
            <div className="absolute top-full left-0 mt-1.5 w-80 max-w-[90vw] bg-rose-950/98 border border-rose-500 rounded-xl p-2.5 text-xs text-rose-200 shadow-2xl z-[1600] flex items-start justify-between gap-2 animate-fadeIn">
              <span className="leading-snug">{searchNotFoundMessage}</span>
              <button
                type="button"
                onClick={() => setSearchNotFoundMessage(null)}
                className="text-rose-400 hover:text-white shrink-0 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Auto-complete / Search Results Dropdown */}
          {isSearchOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-80 max-w-[90vw] bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-xl p-2 shadow-2xl z-[1500] text-xs space-y-1 animate-fadeIn">
              <div className="flex items-center justify-between pb-1.5 px-1 border-b border-slate-800 text-[11px] font-bold text-slate-400">
                <span>Search Suggestions</span>
                <span className="font-mono text-[10px]">
                  {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                </span>
              </div>

              {searchResults.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {searchResults.map((res) => {
                    const isLive = res.type === 'live_event';
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => handleSelectLocation(res)}
                        className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                          isLive
                            ? 'bg-rose-950/40 border-rose-500/40 hover:bg-rose-900/50 text-slate-100'
                            : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <span className="text-sm shrink-0 mt-0.5">
                          {isLive ? '🚨' : '📍'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate text-xs flex items-center justify-between gap-1">
                            <span className="truncate">{res.displayName}</span>
                            {res.nearbyEventsCount !== undefined && res.nearbyEventsCount > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono shrink-0">
                                {res.nearbyEventsCount} {res.nearbyEventsCount === 1 ? 'event' : 'events'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {res.lat.toFixed(3)}°N, {res.lng.toFixed(3)}°E {res.country ? `• ${res.country}` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 text-xs">
                  {mapSearchQuery.trim().length < 2
                    ? 'Type at least 2 characters to search worldwide locations...'
                    : 'No matches found. Try searching Tokyo, San Francisco, Valencia, Istanbul, etc.'}
                </div>
              )}

              {/* Quick suggestion tags */}
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 px-1">
                  Active Hazard Hotspots:
                </div>
                <div className="flex flex-wrap gap-1">
                  {['Tokyo', 'San Francisco', 'Izmir', 'Valencia', 'Padang', 'Miami', 'Reykjavik'].map(city => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSearchInputChange(city)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* COMPREHENSIVE GIS LAYER CONTROL & OVERLAYS SYSTEM        */}
        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* DEDICATED MAP LAYERS COMPONENT (TERRAIN, SATELLITE, DARK) */}
        {/* ======================================================== */}
        <MapLayers
          activeLayer={activeLayerKey as MapLayerKey}
          onSelectLayer={(key) => {
            triggerActionHaptic();
            setActiveLayerKey(key);
          }}
          currentDisasterType={selectedEvent?.type || (filteredType !== 'all' ? filteredType : null)}
          isPowerSaverMode={isPowerSaverMode}
        />

        {/* Hazard Heatmap & GIS Stackable Overlays Control */}
        <div className="relative" ref={layerControlRef}>
          <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 shadow-lg gap-1">
            {/* Quick Toggle: Hazard Intensity Heatmap Overlay */}
            <button
              type="button"
              onClick={() => {
                triggerActionHaptic();
                setShowHeatmap(!showHeatmap);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showHeatmap
                  ? 'bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 text-white shadow-md shadow-rose-950/40 ring-1 ring-rose-400 font-extrabold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Real-Time Hazard Intensity Heatmap Overlays (Concentric Thermal/Seismic Envelopes)"
            >
              <Flame className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Hazard Heatmap</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showHeatmap ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {showHeatmap ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Expandable Layer Control Popover Trigger */}
            <button
              type="button"
              onClick={() => {
                triggerActionHaptic();
                setIsLayerControlOpen(!isLayerControlOpen);
              }}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-md transition-all cursor-pointer border ${
                isLayerControlOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                  : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:border-slate-600'
              }`}
              title="Open full Layer Control: Manage basemaps, hazard intensity heatmap, opacity, and tactical overlays"
              aria-label="Open full GIS Layer Control"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Layers</span>
              <SlidersHorizontal className="w-3 h-3 text-amber-400" />
            </button>
          </div>

          {/* Full GIS Layer Control Popover Panel */}
          {isLayerControlOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] max-h-[75vh] overflow-y-auto bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl z-[1500] text-xs space-y-4 animate-fadeIn">
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm">GIS Layer Control</h4>
                    <p className="text-[10px] text-slate-400">Configure basemaps & hazard intensity overlays</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLayerControlOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close layer control"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Section 1: Base Map Layers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <span>Base Map</span>
                  <span className="text-[10px] font-mono text-amber-400">Mutually Exclusive</span>
                </div>

                <div className="space-y-1.5">
                  {[
                    {
                      key: 'terrain',
                      icon: Mountain,
                      emoji: '⛰️',
                      name: 'Topographic Relief & Elevation',
                      desc: 'Contour elevation lines, hillshade, terrain gradients & valleys (OpenTopoMap)',
                    },
                    {
                      key: 'satellite',
                      icon: Satellite,
                      emoji: '🛰️',
                      name: 'Satellite Reconnaissance',
                      desc: 'High-resolution true-color global orbital optical imagery (Esri World Imagery)',
                    },
                    {
                      key: 'dark',
                      icon: Radio,
                      emoji: '🌑',
                      name: 'Dark Tactical Canvas',
                      desc: 'High-contrast nocturnal operations canvas optimized for bright hazard beacons (CartoDB)',
                    },
                  ].map(layer => {
                    const isSelected = activeLayerKey === layer.key;
                    const IconComp = layer.icon;
                    return (
                      <button
                        key={layer.key}
                        type="button"
                        onClick={() => {
                          triggerActionHaptic();
                          setActiveLayerKey(layer.key as keyof typeof TILE_LAYERS);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-md ring-1 ring-amber-500/30'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                        }`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-100 flex items-center gap-1.5">
                              <span>{layer.emoji}</span>
                              <span>{layer.name}</span>
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                            {layer.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Overlays */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  <span>Hazard Overlays</span>
                  <span className="text-[10px] font-mono text-emerald-400">Stackable</span>
                </div>

                {/* Primary Requested Overlay: Hazard Intensity Heatmap */}
                <div className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                  showHeatmap
                    ? 'bg-rose-950/30 border-rose-500/60 shadow-lg ring-1 ring-rose-500/20'
                    : 'bg-slate-950/70 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>Hazard Intensity Heatmap</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300">
                            {activePoolEvents.length} Zones
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Thermal diffusion and energy attenuation envelopes
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerActionHaptic();
                        setShowHeatmap(!showHeatmap);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        showHeatmap ? 'bg-rose-600' : 'bg-slate-800'
                      }`}
                      aria-label="Toggle Hazard Heatmap"
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          showHeatmap ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Sub-controls when Hazard Heatmap is ON */}
                  {showHeatmap && (
                    <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px]">
                      {/* Heatmap Mode Selector */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                          Heatmap Rendering Mode:
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'hazard_intensity', label: '🌋 Intensity', title: 'Pure physical hazard energy & attenuation' },
                            { id: 'blended', label: '⚡ Blended', title: 'Hazard intensity blended with urban population hubs' },
                            { id: 'population_only', label: '👥 Population', title: 'Global population exposure hubs only' },
                          ].map(mode => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                triggerActionHaptic();
                                setHeatmapMode(mode.id as 'hazard_intensity' | 'blended' | 'catastrophe_only' | 'population_only');
                              }}
                              className={`py-1 px-1.5 rounded-lg border text-[10px] font-semibold transition-all cursor-pointer text-center truncate ${
                                heatmapMode === mode.id
                                  ? 'bg-rose-600 text-white border-rose-400 font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                              title={mode.title}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Opacity Slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Heatmap Opacity:</span>
                          <span className="text-amber-300 font-bold">{Math.round(heatmapOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="1.0"
                          step="0.05"
                          value={heatmapOpacity}
                          onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      {/* Visual Gradient Scale */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                          <span>Minor / Felt</span>
                          <span>Moderate</span>
                          <span>Severe</span>
                          <span>Catastrophic</span>
                        </div>
                        <div className="h-2 rounded-full w-full bg-gradient-to-r from-yellow-400 via-orange-500 via-rose-600 to-purple-800 shadow-inner" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Other Overlays */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {/* Weather Doppler Radar */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      setShowWeatherRadar(!showWeatherRadar);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      showWeatherRadar
                        ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-bold text-[11px]">Weather Radar</span>
                    </div>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${showWeatherRadar ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-800'}`}>
                      {showWeatherRadar ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Emergency Relief Resources */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      setShowResources(!showResources);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      showResources
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-bold text-[11px]">Resources</span>
                    </div>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${showResources ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800'}`}>
                      {showResources ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* ML Forecast Hotspots */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      setShowForecastHotspots(!showForecastHotspots);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      showForecastHotspots
                        ? 'bg-purple-950/60 border-purple-500/80 text-purple-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="font-bold text-[11px]">ML Forecast</span>
                    </div>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${showForecastHotspots ? 'bg-purple-500/30 text-purple-300' : 'bg-slate-800'}`}>
                      {showForecastHotspots ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Occurrence Time Tags on Pins */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      setShowDateTimeTags(!showDateTimeTags);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      showDateTimeTags
                        ? 'bg-amber-950/60 border-amber-500/80 text-amber-200'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-bold text-[11px]">Pin Clocks</span>
                    </div>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${showDateTimeTags ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800'}`}>
                      {showDateTimeTags ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Near-Real-Time Weather Satellite Cloud & Storm Overlay */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      const next = !showWeatherSatellite;
                      setShowWeatherSatellite(next);
                      if (next) setIsSatelliteHUDOpen(true);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between col-span-2 ${
                      showWeatherSatellite
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Satellite className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-bold text-[11px]">Weather Satellite (NASA NRT Clouds)</span>
                    </div>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${showWeatherSatellite ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800'}`}>
                      {showWeatherSatellite ? (satelliteProduct === 'viirs' ? 'VIIRS NRT' : 'MODIS NRT') : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-[10px]">
                <span className="text-slate-400 font-mono">
                  Base: <strong className="text-white capitalize">{activeLayerKey}</strong> • Overlays:{' '}
                  <strong className="text-amber-400">
                    {[showHeatmap && 'Heatmap', showWeatherRadar && 'Radar', showWeatherSatellite && 'Satellite', showResources && 'Resources', showForecastHotspots && 'Forecast'].filter(Boolean).length} Active
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={() => setIsLayerControlOpen(false)}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Display Every Calamity Toggle Button */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 shadow-lg">
          <button
            onClick={() => {
              setShowAllCalamities(!showAllCalamities);
              if (!showAllCalamities && onResetTypeFilter) {
                onResetTypeFilter();
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              showAllCalamities
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Display every calamity across all 14 categories on the map"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All 14 Hazards ({activePoolEvents.length})</span>
          </button>
        </div>

        {/* Date & Time Tags on Map Pins Toggle */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 shadow-lg">
          <button
            onClick={() => setShowDateTimeTags(!showDateTimeTags)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              showDateTimeTags
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Toggle Date & Time of Occurrence labels on map pins"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Date/Time Tags: {showDateTimeTags ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* 'Zoom to All' Control Button: Automatically pans and zooms map to fit all currently visible disaster event markers */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 shadow-lg">
          <button
            onClick={handleZoomToAll}
            disabled={currentVisibleEvents.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              currentVisibleEvents.length > 0
                ? 'bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-cyan-100 border border-cyan-500/40 hover:border-cyan-300 shadow-sm active:scale-95'
                : 'bg-slate-850 text-slate-500 cursor-not-allowed border border-transparent opacity-60'
            }`}
            title="Zoom to All: Automatically pans and zooms the map to fit all currently visible disaster event markers"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zoom to All</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-700/60 font-bold">
              {currentVisibleEvents.length}
            </span>
          </button>
        </div>

        {/* 500km Geolocation Radar Control Button & Dropdown */}
        <div className="relative">
          <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setIsRadarDropdownOpen(!isRadarDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                activeUserLocation
                  ? localCriticalHazards.length > 0
                    ? 'bg-rose-600 text-white shadow-md animate-pulse ring-1 ring-rose-400'
                    : 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
              }`}
              title="Geolocation Hazard Radar: Detects CRITICAL disasters within 500km radius"
            >
              <Locate className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>
                {activeUserLocation ? '500km Radar: Active' : '500km Radar'}
              </span>
              {activeUserLocation && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                  localCriticalHazards.length > 0 ? 'bg-white text-rose-600' : 'bg-black/30 text-white'
                }`}>
                  {localCriticalHazards.length > 0 ? `🚨 ${localCriticalHazards.length} ALERT` : 'CLEAR'}
                </span>
              )}
            </button>
          </div>

          {/* Radar Dropdown Menu */}
          {isRadarDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-3 shadow-2xl z-[1500] text-xs space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <RadarIcon className="w-4 h-4 text-rose-400" />
                  <span>500km Geolocation Hazard Radar</span>
                </div>
                <button
                  onClick={() => setIsRadarDropdownOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Calculates live distance to active disasters. Highlights any <strong>CRITICAL</strong> severity calamities occurring within a <strong>500km radius</strong> on the map.
              </p>

              {/* Action 1: Acquire Live Browser Geolocation */}
              <button
                onClick={handleAcquireBrowserLocation}
                disabled={isLocating}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold transition-all shadow-md cursor-pointer"
              >
                <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Acquiring Browser Location...' : 'Use My Live Browser Location'}</span>
              </button>

              {locationError && (
                <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-800 text-[11px] text-rose-300">
                  {locationError}
                </div>
              )}

              {/* Action 2: Test Location Presets Near Known Hazards */}
              <div className="space-y-1 pt-1 border-t border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Test / Simulate Near Active Hazards:
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {TEST_LOCATION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPreset(preset)}
                      className="w-full text-left p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group"
                    >
                      <div className="font-semibold text-slate-200 group-hover:text-amber-400 truncate">
                        📍 {preset.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Location if Active */}
              {activeUserLocation && (
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 truncate max-w-[170px]">
                    Active: {activeUserLocation.name}
                  </span>
                  <button
                    onClick={handleClearLocation}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    Clear Radar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Emergency Resources Overlay Toggle Button */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                const nextState = !showResources;
                setShowResources(nextState);
                if (nextState) {
                  setIsResourcesFilterOpen(true);
                } else {
                  setIsResourcesFilterOpen(false);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showResources
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Emergency Relief Resources overlay (Shelters, Water Stations, Medical Facilities)"
            >
              <Package className="w-3.5 h-3.5 text-emerald-300" />
              <span>Resources</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${showResources ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {showResources ? `${displayedResources.length} Sites` : 'OFF'}
              </span>
            </button>

            {showResources && (
              <button
                onClick={() => setIsResourcesFilterOpen(!isResourcesFilterOpen)}
                className={`p-1 rounded text-slate-300 hover:text-white transition-colors cursor-pointer ${
                  isResourcesFilterOpen ? 'bg-slate-800 text-emerald-400' : 'hover:bg-slate-800'
                }`}
                title="Filter resource types (Shelters, Water, Medical)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Menu Dropdown if open */}
          {showResources && isResourcesFilterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-2.5 shadow-2xl z-[1500] text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-100 flex items-center gap-1.5 text-[11px]">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Viewport Relief Facilities</span>
                </span>
                <button
                  onClick={() => setIsResourcesFilterOpen(false)}
                  className="p-0.5 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter chips */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setResourceTypeFilter('all')}
                  className={`p-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                    resourceTypeFilter === 'all'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>All Types</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal">{viewportResources.length} Sites</div>
                </button>
                <button
                  onClick={() => setResourceTypeFilter('shelter')}
                  className={`p-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                    resourceTypeFilter === 'shelter'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>⛺ Shelters</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal">{resourceSummary.sheltersCount} Sites</div>
                </button>
                <button
                  onClick={() => setResourceTypeFilter('water')}
                  className={`p-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                    resourceTypeFilter === 'water'
                      ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>💧 Water Points</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal">{resourceSummary.waterStationsCount} Sites</div>
                </button>
                <button
                  onClick={() => setResourceTypeFilter('medical')}
                  className={`p-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer ${
                    resourceTypeFilter === 'medical'
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div>🏥 Medical</div>
                  <div className="text-[10px] font-mono text-slate-400 font-normal">{resourceSummary.medicalCount} Sites</div>
                </button>
              </div>

              {/* Refresh / Re-scan button */}
              <button
                onClick={updateViewportResources}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Re-scan Viewport Coordinates</span>
              </button>
            </div>
          )}
        </div>

        {/* Interactive Distance Measurement & Evacuation Path Calculator Button */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                const next = !isMeasuring;
                setIsMeasuring(next);
                if (next) {
                  setIsMeasurePanelOpen(true);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                isMeasuring
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/40 ring-1 ring-cyan-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Interactive Distance Measurement Tool: Click two points on the map to calculate distance in km for assessing evacuation paths"
            >
              <Ruler className="w-3.5 h-3.5 text-cyan-300" />
              <span>Measure Path</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                isMeasuring ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {isMeasuring ? (calculatedDistanceKm !== null ? `${calculatedDistanceKm} km` : 'Active') : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Real-time Weather Radar Layer Toggle */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setShowWeatherRadar(!showWeatherRadar)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showWeatherRadar
                  ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-900/40 ring-1 ring-sky-400'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle real-time RainViewer weather precipitation & wind radar overlay"
            >
              <CloudRain className="w-3.5 h-3.5 text-sky-300" />
              <span>Weather Radar</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showWeatherRadar ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {showWeatherRadar ? 'LIVE' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Near-Real-Time Weather Satellite Cloud & Storm Layer Toggle (NASA EOSDIS GIBS) */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                triggerActionHaptic();
                if (!showWeatherSatellite) {
                  setShowWeatherSatellite(true);
                  setIsSatelliteHUDOpen(true);
                } else {
                  setShowWeatherSatellite(false);
                  setIsSatelliteHUDOpen(false);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showWeatherSatellite
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle NASA Near-Real-Time Weather Satellite Cloud Cover & Storm Systems (VIIRS / MODIS EOSDIS)"
            >
              <CloudSun className={`w-3.5 h-3.5 ${showWeatherSatellite ? 'text-emerald-200 animate-pulse' : 'text-emerald-400'}`} />
              <span>Cloud Coverage</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showWeatherSatellite ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {showWeatherSatellite ? (satelliteProduct === 'viirs' ? 'VIIRS NRT' : 'MODIS NRT') : 'OFF'}
              </span>
            </button>
            {showWeatherSatellite && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSatelliteHUDOpen(!isSatelliteHUDOpen);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isSatelliteHUDOpen ? 'bg-emerald-500/30 text-emerald-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Configure satellite sensor, date, and cloud opacity"
                >
                  <Sliders className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWeatherSatellite(false);
                    setIsSatelliteHUDOpen(false);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Hide Cloud Coverage Layer"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Real-time Satellite Thermal Anomalies & Wildfire Radiance Toggle (NASA FIRMS) */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                triggerActionHaptic();
                const next = !showThermalAnomalies;
                setShowThermalAnomalies(next);
                if (next) setIsThermalHUDOpen(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showThermalAnomalies
                  ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-md shadow-orange-900/40 ring-1 ring-orange-400 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle real-time satellite thermal anomaly detections and wildfire radiance from NASA FIRMS & VIIRS/MODIS"
            >
              <Flame className={`w-3.5 h-3.5 ${showThermalAnomalies ? 'text-orange-200 animate-pulse' : 'text-orange-400'}`} />
              <span>Thermal Anomalies</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showThermalAnomalies ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {showThermalAnomalies ? `${thermalSummary.totalHotspots} HOTSPOTS` : 'OFF'}
              </span>
            </button>
            {showThermalAnomalies && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsThermalHUDOpen(!isThermalHUDOpen);
                  }}
                  className={`p-1 rounded transition-colors cursor-pointer ${
                    isThermalHUDOpen ? 'bg-orange-500/30 text-orange-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Configure thermal anomaly filters, minimum FRP threshold, and sensor"
                >
                  <Sliders className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowThermalAnomalies(false);
                    setIsThermalHUDOpen(false);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Hide Thermal Anomaly Layer"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Machine Learning Hazard Forecasting Toggle & HUD Button */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                if (!showForecastHotspots) {
                  setShowForecastHotspots(true);
                  setIsForecastHUDOpen(true);
                } else {
                  setIsForecastHUDOpen(!isForecastHUDOpen);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showForecastHotspots
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-900/40 ring-1 ring-purple-400 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Machine Learning Predictive Hazard Hotspots: Spatio-temporal forecasting of emerging calamity zones with probability markers"
            >
              <Brain className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span>ML Forecast Hotspots</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-black ${
                showForecastHotspots ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {showForecastHotspots ? `${currentForecastHotspots.length} HOTSPOTS` : 'OFF'}
              </span>
            </button>
            {showForecastHotspots && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowForecastHotspots(false);
                  setIsForecastHUDOpen(false);
                }}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Hide ML Forecast Markers"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 50km Visual Hazard Radius Impact Zone Toggle */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => {
                triggerActionHaptic();
                if (selectedEvent) {
                  setShowHazardRadius(!showHazardRadius);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                showHazardRadius && selectedEvent
                  ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md shadow-rose-900/40 ring-1 ring-amber-400 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={selectedEvent ? "Toggle 50km hazard radius impact circle around selected event" : "50km Hazard Radius: Select any disaster marker on the map to visualize its impact zone"}
            >
              <Target className={`w-3.5 h-3.5 ${showHazardRadius && selectedEvent ? 'text-amber-200 animate-pulse' : 'text-amber-400'}`} />
              <span>50km Hazard Radius</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                showHazardRadius && selectedEvent ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {selectedEvent ? (showHazardRadius ? '50 KM' : 'OFF') : 'AUTO'}
              </span>
            </button>
            {selectedEvent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerActionHaptic();
                  handleFitHazardRadius();
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white transition-colors cursor-pointer"
                title="Fit 50km hazard radius impact zone in viewport"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Map Legend Toggle Button */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setIsLegendOpen(!isLegendOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                isLegendOpen || filteredType !== 'all' || legendSeverityFilter !== 'all'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-900/40 ring-1 ring-amber-300 font-black'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Open Interactive Map Legend: Explains visual markers for all 14 disaster types, severity levels, pin halos, and tactical symbols"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>Map Legend</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                isLegendOpen 
                  ? 'bg-black/20 text-slate-950' 
                  : (filteredType !== 'all' || legendSeverityFilter !== 'all')
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {filteredType !== 'all' ? filteredType.toUpperCase() : legendSeverityFilter !== 'all' ? legendSeverityFilter : isLegendOpen ? 'OPEN' : 'GUIDE'}
              </span>
            </button>
          </div>
        </div>

        {/* Time Replay / Chronological Window Slider Controls */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
          <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-[11px] hidden sm:inline">Time Window:</span>
            <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px] font-mono">
              {(['24h', '48h', '7d', '30d', 'all'] as const).map((win) => (
                <button
                  key={win}
                  type="button"
                  onClick={() => setTimeReplayWindow(win)}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    timeReplayWindow === win
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Show calamities recorded in the ${win === 'all' ? 'entire catalog' : 'past ' + win}`}
                >
                  {win === 'all' ? 'All' : win}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colorblind-Safe Palette Toggle */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
          <button
            type="button"
            onClick={() => setIsColorblindMode(!isColorblindMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
              isColorblindMode
                ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-300 font-black'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Colorblind-Friendly Accessible Palette (Okabe-Ito Universal Scale)"
          >
            <Eye className="w-3.5 h-3.5 text-sky-300" />
            <span className="hidden sm:inline">Colorblind Mode:</span>
            <span>{isColorblindMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Data Sources & Attribution Reference */}
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-lg p-1 shadow-lg">
          <button
            type="button"
            onClick={() => setIsAttributionModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Official Data Providers, Feeds & Attribution Notice"
          >
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Data Sources</span>
          </button>
        </div>
      </div>

      {/* Interactive Measurement Guide Banner (When Measurement Mode Active) */}
      {isMeasuring && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-full bg-slate-950/95 border-2 border-cyan-400 shadow-2xl backdrop-blur-md flex items-center gap-3 text-xs text-slate-100 max-w-[92vw] animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <Ruler className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-mono hidden sm:inline uppercase tracking-wider text-[11px]">Distance Ruler</span>
          </div>

          <div className="text-xs truncate">
            {!measurePointA ? (
              <span className="text-emerald-300 font-semibold">
                👉 Click any point on the map to set <strong>Point A (Origin)</strong>
              </span>
            ) : !measurePointB ? (
              <span className="text-cyan-300 font-semibold">
                👉 Origin A set! Now click the map to set <strong>Point B (Refuge / Target)</strong>
              </span>
            ) : (
              <span className="text-white">
                ✅ Path length: <strong className="text-cyan-300 font-mono text-sm">{calculatedDistanceKm} km</strong> ({calculatedDistanceMiles} mi). Click map to measure a new route.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {(measurePointA || measurePointB) && (
              <button
                type="button"
                onClick={handleResetMeasurement}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold cursor-pointer"
                title="Reset points"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMeasuring(false)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              title="Close measurement mode"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FLOATING HUD: LIVE EVENTS IN SEARCHED LOCATION */}
      {searchedLocationInfo && (
        <div className="absolute top-14 left-3 right-3 sm:right-auto sm:max-w-md z-[1050] p-3.5 rounded-xl bg-slate-900/98 backdrop-blur-md border-2 border-amber-500/80 shadow-2xl space-y-2.5 animate-fadeIn">
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 font-bold">
                📍
              </div>
              <div>
                <h4 className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                  <span>Live Events in {searchedLocationInfo.name}</span>
                </h4>
                <div className="text-[10px] text-slate-400 font-mono">
                  Coordinates: {searchedLocationInfo.lat.toFixed(4)}°N, {searchedLocationInfo.lng.toFixed(4)}°E
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {searchedLocationInfo.events.length > 1 && (
                <button
                  type="button"
                  onClick={handleFitLocationEvents}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 font-semibold cursor-pointer border border-slate-700"
                  title="Fit all live events in this location on map"
                >
                  <Maximize2 className="w-3 h-3 text-amber-400" />
                  <span>Fit All</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearSearchedLocation}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Dismiss location view"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status summary */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200">
              {searchedLocationInfo.events.length > 0
                ? `⚡ ${searchedLocationInfo.events.length} Live Event(s) within 450 km:`
                : '🛡️ No active disasters detected within 450 km'}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Tracking
            </span>
          </div>

          {/* List of live events in this location */}
          {searchedLocationInfo.events.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {searchedLocationInfo.events.map(({ event: ev, distanceKm }) => {
                const isSelected = selectedEvent?.id === ev.id;
                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">
                        {CALAMITY_MAP_ICONS[ev.type]?.emoji || '⚠️'}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5">
                          <span className="truncate">{ev.name}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
                            ev.severity === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {ev.severity}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {ev.city}, {ev.country} • <strong className="text-amber-400">{distanceKm} km</strong> away
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                        if (mapInstanceRef.current) {
                          safeFlyTo(mapInstanceRef.current, ev.coordinates?.lat, ev.coordinates?.lng, 8.5, { duration: 1.2 });
                        }
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 shrink-0 cursor-pointer"
                    >
                      Focus
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                🛡️ No active disasters detected within 450 km of <strong className="text-amber-300">{searchedLocationInfo.name}</strong>. Real-time satellite & seismic feeds confirm sector status is clear.
              </p>
              {searchedLocationInfo.nearestEvent && (
                <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Closest Active Calamity:</div>
                    <div className="text-xs font-bold text-amber-300 truncate">
                      {searchedLocationInfo.nearestEvent.event.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {searchedLocationInfo.nearestEvent.event.city}, {searchedLocationInfo.nearestEvent.event.country} • {searchedLocationInfo.nearestEvent.distanceKm.toLocaleString()} km away
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nearestEv = searchedLocationInfo.nearestEvent?.event;
                      if (nearestEv) {
                        onSelectEvent(nearestEv);
                        if (mapInstanceRef.current) {
                          safeFlyTo(
                            mapInstanceRef.current,
                            nearestEv.coordinates?.lat,
                            nearestEv.coordinates?.lng,
                            8.0,
                            { duration: 1.5 }
                          );
                        }
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    View ↗
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FLOATING LOCAL HAZARD ALERT BANNER ON MAP */}
      {!searchedLocationInfo && localCriticalHazards.length > 0 && (
        <div className="absolute top-14 left-3 right-3 sm:right-auto sm:max-w-md z-[1000] p-3 rounded-xl bg-gradient-to-r from-rose-950/95 via-slate-900/95 to-slate-950/95 border-2 border-rose-500 shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-white animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider border border-white">
                    🚨 LOCAL HAZARD ALERT
                  </span>
                  <span className="text-[11px] text-rose-300 font-mono font-bold">
                    Within 500 km
                  </span>
                </div>

                <h4 className="text-sm font-black text-white mt-1">
                  {localCriticalHazards[0].event.name}
                </h4>
                
                <p className="text-[11px] text-slate-300 mt-0.5">
                  <strong className="text-rose-400 font-mono">{localCriticalHazards[0].distanceKm} km</strong> from your location ({localCriticalHazards[0].event.city}, {localCriticalHazards[0].event.country}).
                </p>

                <p className="text-[10px] text-amber-300 mt-1 font-mono">
                  Directive: {localCriticalHazards[0].event.publicAdvisory.immediateAction}
                </p>
              </div>
            </div>

            <button
              onClick={() => onSelectEvent(localCriticalHazards[0].event)}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer self-start"
            >
              Focus Hazard
            </button>
          </div>
        </div>
      )}

      {/* Floating Zoom to All Visible Markers Shortcut on Map (when no event card is expanded) */}
      {!selectedEvent && (
        <div className="absolute top-14 right-3 z-[990]">
          <button
            onClick={handleZoomToAll}
            disabled={currentVisibleEvents.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/95 backdrop-blur-md border shadow-lg transition-all cursor-pointer ${
              currentVisibleEvents.length > 0
                ? 'border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-white hover:bg-slate-800 active:scale-95'
                : 'border-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
            title="Zoom to All: Automatically pans and zooms the map to fit all currently visible disaster event markers"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-bold">Zoom to All</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-extrabold">
              {currentVisibleEvents.length}
            </span>
          </button>
        </div>
      )}

      {/* Selected Disaster Location & Occurrence Badge (Closeable on Map) */}
      {selectedEvent && (
        <div className="absolute top-14 sm:top-16 right-3 z-[1000] max-w-sm w-full sm:w-[350px] bg-slate-900/98 backdrop-blur-md border border-slate-700/90 rounded-2xl p-3.5 shadow-2xl text-xs animate-fade-in space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{selectedEvent.city}, {selectedEvent.country}</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5 font-mono">
                {selectedEvent.coordinates.lat.toFixed(4)}°N, {selectedEvent.coordinates.lng.toFixed(4)}°E
                {activeUserLocation && (
                  <span className="text-cyan-400 font-bold ml-1.5">
                    • {calculateDistanceKm(activeUserLocation.lat, activeUserLocation.lng, selectedEvent.coordinates.lat, selectedEvent.coordinates.lng)} km away
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                selectedEvent.severity === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : selectedEvent.severity === 'HIGH'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              }`}>
                {selectedEvent.severity}
              </span>

              {/* Requirement: Cross (X) close button on right-hand side */}
              <button
                onClick={() => {
                  triggerActionHaptic();
                  if (onClearSelectedEvent) {
                    onClearSelectedEvent();
                  }
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.closePopup();
                  }
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500/50 transition-all cursor-pointer shadow-sm group"
                title="Close notification on map (See map clearly)"
                aria-label="Close alert notification"
              >
                <X className="w-4 h-4 text-slate-300 group-hover:text-rose-300 transition-colors" />
              </button>
            </div>
          </div>

          {/* Incident Clock, Source, and Age */}
          {(() => {
            const selClock = resolveDisasterLocalClock(
              selectedEvent.occurredAt || selectedEvent.updatedAt,
              selectedEvent.coordinates.lat,
              selectedEvent.coordinates.lng,
              selectedEvent.country,
              selectedEvent.city,
              selectedEvent.occurrenceTimeLocal
            );
            const now = Date.now();
            const evTime = selectedEvent.occurredAt ? new Date(selectedEvent.occurredAt).getTime() : now;
            const ageMinutes = Math.floor(Math.max(0, now - evTime) / 60000);
            const isStale = ageMinutes >= 60;

            return (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
                <div className="flex items-center justify-between text-amber-300 font-bold">
                  <span className="flex items-center gap-1 font-sans">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Epicenter Clock:</span>
                  </span>
                  <span className="text-white bg-slate-900 px-1.5 py-0.2 rounded border border-slate-700">
                    {selClock.localTime12h}
                  </span>
                </div>

                <div className="text-[10px] text-slate-300">
                  📅 {selClock.localDayOfWeek}, {selClock.localDateFormatted} ({selClock.timezoneName})
                </div>

                <div className="pt-1 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Source: <strong className="text-slate-300">{selectedEvent.source || 'USGS/NASA'}</strong></span>
                  <span className="font-bold text-white">
                    {ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`}
                  </span>
                </div>

                {isStale && (
                  <div className="pt-1 border-t border-slate-900 flex items-center gap-1 text-[10px] text-amber-300 font-bold font-sans">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>⚠️ Data may be out of date (&gt;1 hr old)</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Official Agency Warning (Word-for-Word) */}
          {selectedEvent.publicAdvisory && (
            <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[11px] space-y-1">
              <div className="font-bold text-rose-300 text-[10px] uppercase">
                Official Agency Warning (Word-for-Word):
              </div>
              <p className="text-slate-200 line-clamp-2">
                "{selectedEvent.publicAdvisory.headline}"
              </p>
            </div>
          )}

          {/* Visual 50km Hazard Radius Zone Details & Fit Action */}
          <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 text-[11px] font-mono space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-amber-300 font-bold font-sans">
                <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>50 km Hazard Impact Radius</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                ~7,854 km² Area
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-300">
              <span className="text-slate-400 font-sans">Impact Status:</span>
              {activeUserLocation ? (
                calculateDistanceKm(activeUserLocation.lat, activeUserLocation.lng, selectedEvent.coordinates.lat, selectedEvent.coordinates.lng) <= 50 ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1 font-sans">
                    <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" /> Inside 50km Danger Zone!
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 font-sans">
                    <ShieldAlert className="w-3 h-3 text-emerald-400 shrink-0" /> Safe ({Math.round(calculateDistanceKm(activeUserLocation.lat, activeUserLocation.lng, selectedEvent.coordinates.lat, selectedEvent.coordinates.lng))} km away)
                  </span>
                )
              ) : (
                <span className="text-slate-300 font-sans">50km Visual Circle Active</span>
              )}
            </div>

            <div className="pt-1.5 flex items-center justify-between border-t border-slate-900 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  triggerActionHaptic();
                  handleFitHazardRadius();
                }}
                className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-white border border-amber-500/40 transition-colors flex items-center gap-1 font-sans font-bold cursor-pointer"
                title="Fit entire 50km hazard radius circle smoothly inside the map viewport"
              >
                <Maximize2 className="w-3 h-3 text-amber-400" />
                <span>Fit 50km Zone</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerActionHaptic();
                  setShowHazardRadius(!showHazardRadius);
                }}
                className={`px-2 py-1 rounded text-[10px] font-sans font-bold transition-colors cursor-pointer border ${
                  showHazardRadius
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Toggle 50km hazard radius circle on the map"
              >
                Circle: {showHazardRadius ? 'VISIBLE' : 'HIDDEN'}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <div className="text-[11px]">
              <span className="text-slate-400">Intensity: </span>
              <span className="font-semibold text-amber-400">{selectedEvent.intensity.value}</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.google.com/maps?q=${selectedEvent.coordinates.lat},${selectedEvent.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline"
              >
                Maps <ExternalLink className="w-3 h-3" />
              </a>

              <button
                onClick={() => {
                  triggerActionHaptic();
                  if (onClearSelectedEvent) onClearSelectedEvent();
                  if (mapInstanceRef.current) mapInstanceRef.current.closePopup();
                }}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 cursor-pointer font-semibold"
              >
                Close [×]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Humanitarian Exposure Inspector HUD (Collapsible) */}
      {showHeatmap && (
        <div className="absolute bottom-3 right-3 z-[1000] max-w-sm w-full sm:w-[320px] bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl text-xs overflow-hidden">
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/80 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <Users className="w-4 h-4 text-rose-400 shrink-0" />
              <span>HUMANITARIAN IMPACT HUD</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHudCollapsed(!isHudCollapsed)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={isHudCollapsed ? 'Expand Humanitarian HUD' : 'Collapse Humanitarian HUD'}
              >
                {isHudCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!isHudCollapsed && (
            <div className="p-3 space-y-2.5 max-h-[220px] overflow-y-auto">
              <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/50 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Exposed Population</div>
                  <div className="text-base font-black text-rose-400 font-mono">
                    {(totalExposedPopulation / 1000000).toFixed(1)} Million
                  </div>
                </div>
                <HeartPulse className="w-6 h-6 text-rose-500 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Critical Impact Epicenters:
                </div>
                {topImpactCatastrophes.map(h => {
                  const ev = events.find(e => e.id === h.eventId);
                  return (
                    <div
                      key={h.eventId}
                      onClick={() => {
                        if (ev) onSelectEvent(ev);
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-slate-200 truncate">{h.eventName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{h.severity} • {h.eventType}</div>
                      </div>
                      <span className="font-mono text-amber-400 font-bold shrink-0">
                        {(h.totalExposedPopulation / 1000).toFixed(0)}k pop
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Relief Resources Viewport HUD */}
      {showResources && (
        <div className="absolute bottom-3 left-3 z-[1000] max-w-sm w-full sm:w-[320px] bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl text-xs overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <Package className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>RELIEF RESOURCES HUD</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                {displayedResources.length} Sites
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsResourcesHudOpen(!isResourcesHudOpen)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={isResourcesHudOpen ? 'Collapse Resources HUD' : 'Expand Resources HUD'}
              >
                {isResourcesHudOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {isResourcesHudOpen && (
            <div className="p-3 space-y-2.5 max-h-[250px] overflow-y-auto">
              {/* Aggregate KPI Grid */}
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-center">
                  <div className="text-slate-400">⛺ Shelters</div>
                  <div className="text-xs font-black text-emerald-400 mt-0.5">
                    {resourceSummary.availableShelterBeds.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-slate-400">open beds</div>
                </div>

                <div className="p-1.5 rounded-lg bg-sky-950/40 border border-sky-900/60 text-center">
                  <div className="text-slate-400">💧 Water</div>
                  <div className="text-xs font-black text-sky-400 mt-0.5">
                    {(resourceSummary.dailyWaterOutputLiters / 1000).toFixed(0)}k
                  </div>
                  <div className="text-[9px] text-slate-400">L / day</div>
                </div>

                <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-center">
                  <div className="text-slate-400">🏥 Medical</div>
                  <div className="text-xs font-black text-rose-400 mt-0.5">
                    {resourceSummary.availableMedicalBeds}
                  </div>
                  <div className="text-[9px] text-slate-400">open beds</div>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  onClick={() => setResourceTypeFilter('all')}
                  className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer text-center ${
                    resourceTypeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({viewportResources.length})
                </button>
                <button
                  onClick={() => setResourceTypeFilter('shelter')}
                  className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer text-center ${
                    resourceTypeFilter === 'shelter' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⛺ {resourceSummary.sheltersCount}
                </button>
                <button
                  onClick={() => setResourceTypeFilter('water')}
                  className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer text-center ${
                    resourceTypeFilter === 'water' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  💧 {resourceSummary.waterStationsCount}
                </button>
                <button
                  onClick={() => setResourceTypeFilter('medical')}
                  className={`flex-1 py-1 rounded font-bold transition-all cursor-pointer text-center ${
                    resourceTypeFilter === 'medical' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🏥 {resourceSummary.medicalCount}
                </button>
              </div>

              {/* Scrollable List of Facilities with click-to-fly */}
              <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
                {displayedResources.map(res => (
                  <div
                    key={res.id}
                    onClick={() => {
                      setSelectedResource(res);
                      if (mapInstanceRef.current) {
                        safeFlyTo(mapInstanceRef.current, res.coordinates?.lat, res.coordinates?.lng, 11, { duration: 1.0 });
                      }
                    }}
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-[11px] ${
                      selectedResource?.id === res.id
                        ? 'bg-slate-800 border-emerald-500 shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                        <span>{res.type === 'shelter' ? '⛺' : res.type === 'water' ? '💧' : '🏥'}</span>
                        <span className="truncate">{res.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {res.statusLabel} • {res.percentageUsed}% used
                      </div>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold text-[10px] shrink-0">
                      {res.type === 'shelter' ? `${res.capacityTotal - res.capacityCurrent} beds` :
                       res.type === 'water' ? `${(res.capacityTotal / 1000).toFixed(0)}k L` :
                       `${res.capacityTotal - res.capacityCurrent} beds`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLOATING EVACUATION PATH DISTANCE ASSESSMENT HUD */}
      {isMeasuring && (
        <div className={`absolute bottom-3 ${showResources ? 'sm:left-[335px]' : 'left-3'} left-3 z-[1050] max-w-sm w-[92vw] sm:w-[350px] bg-slate-950/98 backdrop-blur-md border-2 border-cyan-500/80 rounded-xl shadow-2xl text-xs overflow-hidden animate-fadeIn`}>
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-cyan-950/90 via-slate-900 to-blue-950/90 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-cyan-300">
              <Ruler className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>EVACUATION PATH CALCULATOR</span>
              {calculatedDistanceKm !== null && (
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono font-bold">
                  {calculatedDistanceKm} km
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMeasurePanelOpen(!isMeasurePanelOpen)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={isMeasurePanelOpen ? 'Collapse Distance Panel' : 'Expand Distance Panel'}
              >
                {isMeasurePanelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMeasuring(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Exit distance measurement mode"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isMeasurePanelOpen && (
            <div className="p-3 space-y-2.5 max-h-[340px] overflow-y-auto">
              {/* Primary Distance Readout Card */}
              <div className="p-2.5 rounded-lg bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-500/40">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total Evacuation Path Length
                </div>
                {calculatedDistanceKm !== null ? (
                  <div className="flex items-baseline justify-between mt-1">
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-2xl font-black text-cyan-300 tracking-tight">
                        {calculatedDistanceKm.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-cyan-400">km</span>
                      <span className="text-xs text-slate-400 font-semibold ml-2">
                        ({calculatedDistanceMiles?.toLocaleString()} mi)
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                      Animated Great Circle
                    </span>
                  </div>
                ) : (
                  <div className="text-amber-400 font-medium text-xs mt-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>
                      {!measurePointA 
                        ? 'Click origin point on map to start' 
                        : 'Click destination point on map to complete'}
                    </span>
                  </div>
                )}
              </div>

              {/* Waypoint Coordinates & Quick Sets */}
              <div className="space-y-1.5 text-[11px]">
                {/* Point A */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-emerald-500/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                      A
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-slate-200 truncate">
                        {measurePointA ? 'Origin Set' : 'Origin (Point A)'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">
                        {measurePointA 
                          ? `${measurePointA.lat.toFixed(4)}°N, ${measurePointA.lng.toFixed(4)}°E` 
                          : 'Not set (click map)'}
                      </div>
                    </div>
                  </div>
                  {activeUserLocation && (!measurePointA || measurePointA.source !== 'user_location') && (
                    <button
                      type="button"
                      onClick={handleSetPointAToUserLocation}
                      className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 text-[10px] font-semibold border border-emerald-500/50 cursor-pointer shrink-0"
                      title="Set Point A to your GPS location"
                    >
                      Use GPS
                    </button>
                  )}
                </div>

                {/* Point B */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                      B
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-slate-200 truncate">
                        {measurePointB ? 'Destination Set' : 'Refuge / Target (Point B)'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 truncate">
                        {measurePointB 
                          ? `${measurePointB.lat.toFixed(4)}°N, ${measurePointB.lng.toFixed(4)}°E` 
                          : 'Not set (click map)'}
                      </div>
                    </div>
                  </div>
                  {selectedEvent && (!measurePointB || measurePointB.source !== 'calamity') && (
                    <button
                      type="button"
                      onClick={handleSetPointBToSelectedEvent}
                      className="px-2 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-[10px] font-semibold border border-cyan-500/50 cursor-pointer shrink-0"
                      title="Set Point B to selected calamity epicenter"
                    >
                      Use Hazard
                    </button>
                  )}
                </div>
              </div>

              {/* Evacuation Mobility Duration Diagnostics */}
              {evacuationEstimates && (
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Evacuation Travel Diagnostics:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>🚶</span> <span>Walking (4.5k)</span>
                      </span>
                      <span className="font-bold text-emerald-400">{evacuationEstimates.walking}</span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>🚴</span> <span>Bicycle (16k)</span>
                      </span>
                      <span className="font-bold text-sky-400">{evacuationEstimates.bicycle}</span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>🚗</span> <span>Vehicle (45k)</span>
                      </span>
                      <span className="font-bold text-amber-400">{evacuationEstimates.vehicle}</span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <span>🚁</span> <span>Aero-med (220k)</span>
                      </span>
                      <span className="font-bold text-rose-400">{evacuationEstimates.helicopter}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Evacuation Corridor Hazard Clearance Check */}
              {(() => {
                if (!corridorHazardDiagnostics || !corridorHazardDiagnostics.closestHazard) return null;
                const closest = corridorHazardDiagnostics.closestHazard;
                return (
                  <div className={`p-2 rounded-lg border text-[11px] ${
                    corridorHazardDiagnostics.isDangerZone
                      ? 'bg-rose-950/40 border-rose-500/70 text-rose-200'
                      : corridorHazardDiagnostics.isCautionZone
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>
                        {corridorHazardDiagnostics.isDangerZone ? '🚨' : corridorHazardDiagnostics.isCautionZone ? '⚠️' : '🛡️'}
                      </span>
                      <span>
                        {corridorHazardDiagnostics.isDangerZone
                          ? 'Hazard In Path Proximity!'
                          : corridorHazardDiagnostics.isCautionZone
                          ? 'Caution: Disaster Nearby'
                          : 'Evacuation Corridor Clearance'}
                      </span>
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-90 leading-tight">
                      {closest.name} is{' '}
                      <strong className="font-mono">{corridorHazardDiagnostics.distanceToClosestKm} km</strong> from this evacuation route.
                    </div>
                  </div>
                );
              })()}

              {/* Action Toolbar */}
              <div className={`pt-2 border-t border-slate-800 grid ${measurePointA && measurePointB ? 'grid-cols-4' : 'grid-cols-1'} gap-1`}>
                {measurePointA && measurePointB && (
                  <>
                    <button
                      type="button"
                      onClick={handleFitMeasurement}
                      className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      title="Fit entire evacuation path on the map"
                    >
                      <Maximize2 className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>Fit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeasureAnimationTrigger((prev) => prev + 1)}
                      className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer hover:text-emerald-300"
                      title="Replay animated polyline evacuation transition"
                    >
                      <Play className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Trace</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSwapMeasurementPoints}
                      className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      title="Swap Origin and Destination (A ⇄ B)"
                    >
                      <ArrowRightLeft className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Swap</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleResetMeasurement}
                  className="py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  title="Clear both measurement points"
                >
                  <RefreshCw className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FLOATING MACHINE LEARNING PREDICTIVE FORECAST HUD */}
      {isForecastHUDOpen && showForecastHotspots && (
        <div className={`absolute bottom-3 ${isMeasuring ? 'sm:left-[365px]' : 'left-3'} left-3 z-[1050] max-w-sm w-[92vw] sm:w-[360px] bg-slate-950/98 backdrop-blur-md border-2 border-purple-500/80 rounded-xl shadow-2xl text-xs overflow-hidden animate-fadeIn`}>
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-purple-300">
              <Brain className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
              <span>ML HAZARD HOTSPOT FORECASTER</span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {forecastHorizon.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onNavigateToForecast && (
                <button
                  type="button"
                  onClick={onNavigateToForecast}
                  className="px-1.5 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800 text-[10px] font-bold text-purple-200 border border-purple-500/40 cursor-pointer"
                  title="Open Full Screen ML Forecasting Analytics Hub"
                >
                  Full Hub
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsForecastHUDOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close Forecast HUD"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto">
            {/* Horizon & Probability Controls */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Horizon:</span>
                <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                  {(['24h', '72h', '7d', '30d'] as ForecastHorizon[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setForecastHorizon(h)}
                      className={`px-2 py-0.5 rounded font-mono font-bold transition-all cursor-pointer ${
                        forecastHorizon === h
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">
                  Min Prob: <strong className="text-purple-300 font-mono">{forecastMinProbability}%</strong>
                </span>
                <div className="flex items-center gap-1">
                  {[40, 60, 75, 85].map((thresh) => (
                    <button
                      key={thresh}
                      type="button"
                      onClick={() => setForecastMinProbability(thresh)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-colors ${
                        forecastMinProbability === thresh
                          ? 'bg-purple-500 text-slate-950'
                          : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      ≥{thresh}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Hotspot Spotlight Card */}
            {selectedForecastHotspot ? (
              <div className="p-2.5 rounded-lg bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/60 space-y-1.5 animate-fadeIn">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate">
                    <span className="text-[9px] uppercase font-bold text-purple-400 tracking-wider">
                      Selected Hotspot Spotlight
                    </span>
                    <h4 className="font-bold text-slate-100 text-xs truncate">
                      {selectedForecastHotspot.name}
                    </h4>
                    <div className="text-[10px] text-slate-400 truncate">
                      {selectedForecastHotspot.region}, {selectedForecastHotspot.country}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {selectedForecastHotspot.probability}% Prob
                    </span>
                  </div>
                </div>

                <div className="p-1.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] space-y-1">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Impact Footprint:</span>
                    <strong className="font-mono text-cyan-300">±{selectedForecastHotspot.estimatedImpactRadiusKm} km</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Civilian Exposure:</span>
                    <strong className="font-mono text-amber-300">{(selectedForecastHotspot.populationAtRisk / 1000).toFixed(0)}k people</strong>
                  </div>
                  {selectedForecastHotspot.predictiveFactors[0] && (
                    <div className="text-[9px] text-purple-200/90 pt-1 border-t border-slate-800/80">
                      Top Driver: <strong>{selectedForecastHotspot.predictiveFactors[0].factor}</strong> (+{selectedForecastHotspot.predictiveFactors[0].weight}%)
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (mapInstanceRef.current && selectedForecastHotspot) {
                        safeFlyTo(
                          mapInstanceRef.current,
                          selectedForecastHotspot.coordinates?.lat,
                          selectedForecastHotspot.coordinates?.lng,
                          7.5,
                          { duration: 1.2 }
                        );
                      }
                    }}
                    className="flex-1 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Center Hotspot</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedForecastHotspot(null)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {/* Quick Hotspots Explorer List */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-0.5">
                <span>Active Forecast Hotspots ({currentForecastHotspots.length})</span>
                <span className="text-slate-500 font-normal">Click to pan</span>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {currentForecastHotspots.map((h) => {
                  const isSelected = selectedForecastHotspot?.id === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        setSelectedForecastHotspot(h);
                        if (mapInstanceRef.current) {
                          safeFlyTo(mapInstanceRef.current, h.coordinates?.lat, h.coordinates?.lng, 7, { duration: 1 });
                        }
                      }}
                      className={`w-full text-left p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-purple-950/70 border-purple-500 text-purple-100 shadow-sm'
                          : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <div className="font-bold text-[11px] truncate flex items-center gap-1">
                          <span>{h.country}:</span>
                          <span className="text-slate-200">{h.name.replace(/^Predicted [A-Z]+ Hotspot: /, '')}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          {h.hazardType.toUpperCase()} • ±{h.estimatedImpactRadiusKm}km footprint
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                        h.probability >= 85 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                        h.probability >= 70 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}>
                        {h.probability}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Provenance Footer */}
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>AUC-ROC: 0.934 • Brier: 0.082</span>
              <span>14.2k Training Catalogs</span>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING NEAR-REAL-TIME WEATHER SATELLITE HUD */}
      {isSatelliteHUDOpen && showWeatherSatellite && (
        <div className="absolute top-16 right-3 sm:right-6 z-[1100] max-w-sm w-[92vw] sm:w-[360px] bg-slate-950/98 backdrop-blur-md border-2 border-emerald-500/80 rounded-xl shadow-2xl text-xs overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <Satellite className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
              <span>WEATHER SATELLITE HUD</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-bold">
                {satelliteProduct === 'viirs' ? 'VIIRS 250m' : 'MODIS 250m'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-emerald-400 font-mono font-bold hidden sm:inline">
                NASA EOSDIS
              </span>
              <button
                type="button"
                onClick={() => setIsSatelliteHUDOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize Satellite HUD"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">
            {/* Sensor Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                <span>Satellite Sensor Instrument:</span>
                <span className="text-emerald-400 font-mono">TrueColor 250m</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setSatelliteProduct('viirs');
                  }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    satelliteProduct === 'viirs'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center justify-between">
                    <span>Suomi-NPP VIIRS</span>
                    {satelliteProduct === 'viirs' && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                    Flagship NRT cloud tops, storm eyewalls & smoke
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setSatelliteProduct('modis');
                  }}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    satelliteProduct === 'modis'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 ring-1 ring-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-[11px] flex items-center justify-between">
                    <span>Terra MODIS</span>
                    {satelliteProduct === 'modis' && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                    Multi-spectral synoptic storm systems & fronts
                  </div>
                </button>
              </div>
            </div>

            {/* Orbit Observation Date (Today NRT vs Yesterday Composite) */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Orbit Pass Date:</span>
                <span className="text-[10px] font-mono text-emerald-300 font-bold">
                  {getSatelliteDateString(satelliteDateOffset)} (UTC)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setSatelliteDateOffset(0);
                  }}
                  className={`py-1 px-2 rounded text-[11px] font-bold transition-all cursor-pointer text-center ${
                    satelliteDateOffset === 0
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Today (Near-Real-Time)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setSatelliteDateOffset(1);
                  }}
                  className={`py-1 px-2 rounded text-[11px] font-bold transition-all cursor-pointer text-center ${
                    satelliteDateOffset === 1
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Yesterday (-24h Full Pass)
                </button>
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Satellite orbits refresh continuously as NASA polar orbiters cross Earth meridians.
              </div>
            </div>

            {/* Cloud Layer Opacity Slider */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cloud Layer Opacity:</span>
                <span className="text-[10px] font-mono font-bold text-white">
                  {Math.round(satelliteOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={satelliteOpacity}
                onChange={(e) => setSatelliteOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex items-center justify-between gap-1 pt-1">
                {[0.4, 0.6, 0.75, 0.9, 1.0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSatelliteOpacity(val)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-colors ${
                      satelliteOpacity === val
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {Math.round(val * 100)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Scientific Geoinformatics Context */}
            <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-[10px] text-emerald-200/90 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                <span>🌀</span>
                <span>Storm & Cloud System Diagnostics</span>
              </div>
              <p className="leading-relaxed">
                Optical true-color reflectance visualizes atmospheric convective storms, spiraling cyclonic eyewalls, frontal boundaries, and wildfire smoke plumes with 250m spatial ground resolution.
              </p>
            </div>

            {/* Quick Actions & Correlation with Active Storms */}
            {(() => {
              const activeStorms = (allEvents && allEvents.length > 0 ? allEvents : events).filter(
                (ev) => ev.type === 'cyclone' || ev.type === 'tornado' || ev.type === 'flood'
              );
              if (activeStorms.length === 0) return null;
              return (
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold">
                    <span>Active Storm Incidents ({activeStorms.length})</span>
                    <span className="text-slate-500 font-normal">Center storm</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {activeStorms.slice(0, 3).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          triggerActionHaptic();
                          safeFlyTo(mapInstanceRef.current, st.coordinates.lat, st.coordinates.lng, 7);
                          onSelectEvent(st);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-950 hover:bg-emerald-950 hover:border-emerald-500 border border-slate-800 text-[10px] text-emerald-300 font-semibold cursor-pointer truncate max-w-[150px]"
                        title={`Pan to ${st.name} (${st.country})`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* FLOATING REAL-TIME THERMAL ANOMALIES & WILDFIRE RADIANCE HUD */}
      {isThermalHUDOpen && showThermalAnomalies && (
        <div className="absolute top-16 right-3 sm:right-6 z-[1100] max-w-sm w-[92vw] sm:w-[370px] bg-slate-950/98 backdrop-blur-md border-2 border-orange-500/80 rounded-xl shadow-2xl text-xs overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-rose-950/90 via-slate-900 to-orange-950/90 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-orange-300">
              <Flame className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
              <span>SATELLITE THERMAL HUD</span>
              <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.2 rounded font-mono font-bold">
                NASA FIRMS
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-orange-400 font-mono font-bold hidden sm:inline">
                {thermalSummary.totalHotspots} Hotspots
              </span>
              <button
                type="button"
                onClick={() => setIsThermalHUDOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize Thermal HUD"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3 max-h-[440px] overflow-y-auto">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <div className="p-2 rounded-lg bg-slate-900/90 border border-orange-500/30 text-center">
                <div className="text-slate-400 text-[9px]">Peak Radiant Flux</div>
                <div className="text-xs font-black text-orange-400 mt-0.5">
                  {thermalSummary.peakFRP_MW} MW
                </div>
                <div className="text-[9px] text-slate-500">radiative power</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/90 border border-rose-500/30 text-center">
                <div className="text-slate-400 text-[9px]">Max Temp (4μm)</div>
                <div className="text-xs font-black text-rose-300 mt-0.5">
                  {thermalSummary.maxBrightnessTempCelsius}°C
                </div>
                <div className="text-[9px] text-slate-500">{thermalSummary.maxBrightnessTempKelvin} K</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-500/30 text-center">
                <div className="text-slate-400 text-[9px]">High Conf</div>
                <div className="text-xs font-black text-amber-300 mt-0.5">
                  {thermalSummary.highConfidenceCount}
                </div>
                <div className="text-[9px] text-slate-500">&gt;80% certainty</div>
              </div>
            </div>

            {/* Sensor Instrument Filter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                <span>Satellite Radiometer Sensor:</span>
                <span className="text-orange-400 font-mono">
                  {thermalSensorFilter === 'all' ? 'VIIRS + MODIS' : thermalSensorFilter === 'viirs' ? 'VIIRS 375m' : 'MODIS 1km'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setThermalSensorFilter('all');
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                    thermalSensorFilter === 'all'
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({thermalSummary.totalHotspots})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setThermalSensorFilter('viirs');
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                    thermalSensorFilter === 'viirs'
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  VIIRS ({thermalSummary.viirsCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerActionHaptic();
                    setThermalSensorFilter('modis');
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center font-bold transition-all cursor-pointer ${
                    thermalSensorFilter === 'modis'
                      ? 'bg-orange-600 text-white border-orange-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  MODIS ({thermalSummary.modisCount})
                </button>
              </div>
            </div>

            {/* Minimum Fire Radiative Power (MW) Threshold */}
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Min Radiative Power Filter:</span>
                <span className="text-[10px] font-mono font-bold text-orange-400">
                  {thermalMinFRP > 0 ? `≥ ${thermalMinFRP} MW` : 'All Detections (0+ MW)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                step="25"
                value={thermalMinFRP}
                onChange={(e) => setThermalMinFRP(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>0 MW (All)</span>
                <span>100 MW (Intense)</span>
                <span>250+ MW (Extreme)</span>
              </div>
            </div>

            {/* Active Thermal Detections List with Click-to-Pan */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 px-0.5">
                <span>Active Detections ({currentThermalAnomalies.length})</span>
                <span className="text-slate-500 font-normal">Click to pan</span>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {currentThermalAnomalies.slice(0, 15).map((a) => {
                  const isSelected = selectedThermalAnomaly?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        triggerActionHaptic();
                        setSelectedThermalAnomaly(a);
                        if (mapInstanceRef.current) {
                          safeFlyTo(mapInstanceRef.current, a.lat, a.lng, 8.5, { duration: 1.0 });
                        }
                      }}
                      className={`w-full p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-orange-950/80 border-orange-500 shadow-md ring-1 ring-orange-400'
                          : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div className="truncate mr-2">
                        <div className="font-bold text-slate-200 text-[11px] truncate flex items-center gap-1">
                          <span>🔥</span>
                          <span className="truncate">{a.locationName}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                          {a.country} • {a.satelliteSensor} • {a.brightnessTempCelsius}°C
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xs font-black text-orange-400">
                          {a.fireRadiativePowerMW} MW
                        </div>
                        <div className="text-[9px] text-emerald-400 font-bold">
                          {a.confidencePercent}%
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scientific Geoinformatics Note */}
            <div className="p-2 rounded-lg bg-orange-950/20 border border-orange-500/30 text-[9px] text-orange-200/90 leading-relaxed">
              🛰️ <strong>Radiometric Calibration:</strong> Sourced from NASA FIRMS VIIRS 375m I-Band (3.74μm) and MODIS (3.96μm/11μm) mid-wave infrared channels. Quantifies instantaneous fire radiative power (MW) and sub-pixel thermal front kinetics.
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE MAP LEGEND COMPONENT */}
      <MapLegend
        isOpen={isLegendOpen}
        onClose={() => setIsLegendOpen(false)}
        activeEvents={allEvents && allEvents.length > 0 ? allEvents : events}
        filteredType={filteredType}
        onSelectTypeFilter={(type) => {
          if (type === 'all') {
            setShowAllCalamities(true);
            if (onResetTypeFilter) onResetTypeFilter();
            if (onTypeFilterChange) onTypeFilterChange('all');
          } else {
            setShowAllCalamities(false);
            if (onTypeFilterChange) onTypeFilterChange(type);
          }
        }}
        severityFilter={legendSeverityFilter}
        onSelectSeverityFilter={(sev) => setLegendSeverityFilter(sev)}
        showWeatherRadar={showWeatherRadar}
        onToggleWeatherRadar={() => setShowWeatherRadar(!showWeatherRadar)}
        showWeatherSatellite={showWeatherSatellite}
        onToggleWeatherSatellite={() => {
          const next = !showWeatherSatellite;
          setShowWeatherSatellite(next);
          if (next) setIsSatelliteHUDOpen(true);
        }}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
        showResources={showResources}
        onToggleResources={() => setShowResources(!showResources)}
        showDateTimeTags={showDateTimeTags}
        onToggleDateTimeTags={() => setShowDateTimeTags(!showDateTimeTags)}
        showHazardRadius={showHazardRadius}
        onToggleHazardRadius={() => setShowHazardRadius(!showHazardRadius)}
        showThermalAnomalies={showThermalAnomalies}
        onToggleThermalAnomalies={() => setShowThermalAnomalies(!showThermalAnomalies)}
        activeLayerKey={activeLayerKey as 'terrain' | 'satellite' | 'dark'}
        onChangeLayerKey={(key) => {
          triggerActionHaptic();
          setActiveLayerKey(key);
        }}
      />

      {/* DATA SOURCES & ATTRIBUTION MODAL */}
      {isAttributionModalOpen && (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Official Data Sources, Attribution & Latency Transparency</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAttributionModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>USGS Earthquake Hazards Program (NEIC)</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Latency: ~2-8 mins</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Global Seismographic Network automated hypocenter solutions and ShakeMap instrumental ground motion data. Public domain data under U.S. Geological Survey Open Data Policy.
                </p>
                <a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-mono text-[10px] inline-flex items-center gap-1">
                  earthquake.usgs.gov <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>NASA Earth Observatory (EONET) & FIRMS VIIRS/MODIS</span>
                  <span className="text-amber-400 font-mono text-[10px]">Latency: ~3-6 hours (Orbital pass dependent)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Satellite thermal radiance and active fire detection pixels (375m VIIRS on Suomi-NPP / NOAA-20 and 1km MODIS on Terra/Aqua). Thermal data is not instantaneous; latency reflects satellite overpass orbits.
                </p>
                <a href="https://firms.modaps.eosdis.nasa.gov" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-mono text-[10px] inline-flex items-center gap-1">
                  firms.modaps.eosdis.nasa.gov <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>GDACS (Global Disaster Alert & Coordination System)</span>
                  <span className="text-cyan-400 font-mono text-[10px]">Latency: ~15-60 mins</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Joint initiative of the United Nations Office for the Coordination of Humanitarian Affairs (UN OCHA) and European Commission Joint Research Centre (JRC).
                </p>
                <a href="https://www.gdacs.org" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-mono text-[10px] inline-flex items-center gap-1">
                  gdacs.org <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>RainViewer Doppler Precipitation Radar</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Refresh: Every 10 mins</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Composite national radar mosaic tiles covering North America, Europe, East Asia, and Australia.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>NASA Earth Observing System (EOSDIS GIBS)</span>
                  <span className="text-emerald-400 font-mono text-[10px]">TrueColor 250m NRT</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Near-real-time optical weather satellite cloud cover and cyclonic storm structures from Suomi-NPP VIIRS and Terra MODIS radiometers via NASA Global Imagery Browse Services (GIBS).
                </p>
                <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline font-mono text-[10px] inline-flex items-center gap-1">
                  earthdata.nasa.gov/gibs <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-[11px] text-amber-200">
                <strong>Fair Use & Caching Architecture:</strong> To prevent overwhelming upstream humanitarian APIs, live feeds are proxied and cached through our backend server with an automated in-memory TTL cache.
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAttributionModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Real-time Cartographic & Spatial Geodetic Readout HUD (WGS-84 / UTM / Scale / Zoom) */}
      <div className="absolute bottom-2 left-2 sm:left-24 z-[900] pointer-events-auto">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 backdrop-blur-md border border-slate-800 text-[10px] font-mono text-slate-300 shadow-xl select-none">
          <Globe className="w-3 h-3 text-cyan-400 shrink-0" />
          {cursorCoords ? (
            (() => {
              const gis = formatGisCoordinates(cursorCoords.lat, cursorCoords.lng);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{gis.decimal}</span>
                  <span className="hidden md:inline text-amber-300 font-semibold">• {gis.utm}</span>
                  <span className="text-slate-400 hidden lg:inline">({gis.dms})</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      copyToClipboard(gis.copyText);
                    }}
                    className="p-0.5 hover:text-white text-slate-400 hover:bg-slate-850 rounded transition-colors cursor-pointer"
                    title={`Copy coordinates: ${gis.copyText}`}
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })()
          ) : selectedEvent ? (
            (() => {
              const gis = formatGisCoordinates(selectedEvent.coordinates.lat, selectedEvent.coordinates.lng);
              return (
                <div className="flex items-center gap-2">
                  <span className="text-amber-300 font-bold">{selectedEvent.city}:</span>
                  <span className="text-white">{gis.decimal}</span>
                  <span className="hidden md:inline text-cyan-300">• {gis.utm}</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerActionHaptic();
                      copyToClipboard(gis.copyText);
                    }}
                    className="p-0.5 hover:text-white text-slate-400 hover:bg-slate-850 rounded transition-colors cursor-pointer"
                    title={`Copy coordinates: ${gis.copyText}`}
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })()
          ) : (
            <span className="text-slate-400">EPSG:4326 (WGS 84) • Web Mercator</span>
          )}
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-cyan-400 font-bold hidden sm:inline">Z: {currentZoom}</span>
        </div>
      </div>
      </div>
    </div>
  );
};

// Helper icon component
function RadarIcon(props: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={props.className}
    >
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0" />
      <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M12 3v9l6 3" />
    </svg>
  );
}
