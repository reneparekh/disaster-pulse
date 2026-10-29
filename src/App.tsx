import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CalamityEvent, CalamityType } from './types/disaster';
import { INITIAL_DISASTER_EVENTS, CALAMITY_METADATA_LIST } from './data/disastersData';
import { fetchAllLiveDisasters, LiveFeedStats } from './services/liveFeedService';
import { UserGeoLocation, requestBrowserLocation } from './utils/geolocationUtils';
import { DisasterMap } from './components/DisasterMap';
import { CalamityFilter } from './components/CalamityFilter';
import { DisasterList } from './components/DisasterList';
import { DisasterDetailModal } from './components/DisasterDetailModal';
import { IntensityCalculator } from './components/IntensityCalculator';
import { AdvisoryBanner } from './components/AdvisoryBanner';
import { LiveFeedControls } from './components/LiveFeedControls';
import { DesktopAlertToast } from './components/DesktopAlertToast';
import { DisasterAnalytics } from './components/DisasterAnalytics';
import { DisasterAiAssistant } from './components/DisasterAiAssistant';
import { EmergencyDispatchHub } from './components/EmergencyDispatchHub';
import { ChronologicalTimeline } from './components/ChronologicalTimeline';
import { MLHazardForecaster } from './components/MLHazardForecaster';
import { GeospatialWorkbench } from './components/GeospatialWorkbench';
import { DisastersNearMeHero } from './components/DisastersNearMeHero';
import { NaturalLanguageSearchBar } from './components/NaturalLanguageSearchBar';
import { ReportProblemModal } from './components/ReportProblemModal';
import { DisasterEventCard } from './components/DisasterEventCard';
import { TimeSeriesSlider } from './components/TimeSeriesSlider';
import { AppStoreReadinessModal } from './components/AppStoreReadinessModal';
import { 
  sendDesktopNotification, 
  requestDesktopNotificationPermission, 
  getNotificationPermissionStatus, 
  playEmergencyAudioChime 
} from './utils/notificationService';
import { 
  Globe2, 
  Map as MapIcon, 
  Calculator, 
  RefreshCw, 
  Search, 
  Radio, 
  ShieldAlert, 
  Satellite, 
  Layers, 
  Activity, 
  BellRing, 
  Volume2, 
  VolumeX, 
  Zap, 
  BarChart3, 
  Bot, 
  FileText, 
  Sparkles, 
  Clock, 
  Maximize2, 
  Brain,
  Compass,
  Smartphone,
  Vibrate,
  VibrateOff,
  MessageSquare,
  AlertCircle,
  X,
  Menu,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Locate,
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
  Check,
  Info,
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryCharging,
  ZapOff,
  Moon
} from 'lucide-react';
import { 
  triggerCriticalAlertHaptic, 
  isHapticsEnabled, 
  setHapticsEnabled, 
  triggerActionHaptic,
  triggerLocationLockHaptic
} from './utils/hapticsService';
import { executeNaturalLanguageSearch } from './utils/naturalLanguageQueryParser';
import { calculatePreciseDistanceKm } from './utils/geolocationUtils';

export type TabView = 
  | 'map' 
  | 'feed' 
  | 'forecast' 
  | 'geoworkbench' 
  | 'safety' 
  | 'analytics'
  // Legacy aliases for internal deep-links & event handlers
  | 'dashboard' 
  | 'assistant' 
  | 'dispatch' 
  | 'calculator';

const CALAMITY_CHIP_ICONS: Record<string, React.ElementType> = {
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

export default function App() {
  const [events, setEvents] = useState<CalamityEvent[]>(INITIAL_DISASTER_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CalamityEvent | null>(INITIAL_DISASTER_EVENTS[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStoreReadinessOpen, setIsStoreReadinessOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('map');
  const [safetySubTab, setSafetySubTab] = useState<'assistant' | 'dispatch' | 'calculator'>('assistant');
  const [filterType, setFilterType] = useState<CalamityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'CRITICAL' | 'HIGH'>('all');
  const [liveOnlyFilter, setLiveOnlyFilter] = useState(false);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [userLocation, setUserLocation] = useState<UserGeoLocation | null>(null);

  // App-Centric Map Overlay Sheet State (Drawer that sits gracefully over the map)
  const [isMapSheetOpen, setIsMapSheetOpen] = useState(true);
  const [mapSheetTab, setMapSheetTab] = useState<'cards' | 'near_me' | 'timeline'>('cards');
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);

  // User-Centric Natural Language & Quick Filter State
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'near_me' | '24h' | 'biggest' | 'all'>('all');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalEventName, setReportModalEventName] = useState<string | undefined>(undefined);

  // Real-time Notification System State
  const [desktopAlerts, setDesktopAlerts] = useState<CalamityEvent[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isHapticsActive, setIsHapticsActive] = useState<boolean>(() => isHapticsEnabled());
  const knownEventIdsRef = useRef<Set<string>>(new Set(INITIAL_DISASTER_EVENTS.map(e => e.id)));

  // Time-Series Progression Slider & Animation State (7 to 30 Days)
  const [timeWindowDays, setTimeWindowDays] = useState<number>(30);
  const [sliderTimestamp, setSliderTimestamp] = useState<number>(() => Date.now());
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [timelineCumulativeMode, setTimelineCumulativeMode] = useState<boolean>(true);
  const [timelinePlaybackSpeed, setTimelinePlaybackSpeed] = useState<number>(2);

  // Field Responder Power Saver Mode State
  const [isPowerSaverMode, setIsPowerSaverMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('crisis_power_saver_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [autoPowerSaverOnLowBattery, setAutoPowerSaverOnLowBattery] = useState<boolean>(() => {
    try {
      return localStorage.getItem('crisis_auto_power_saver_low_batt') !== 'false';
    } catch {
      return true;
    }
  });

  const [batteryState, setBatteryState] = useState<{
    supported: boolean;
    level: number | null;
    charging: boolean | null;
  }>({
    supported: false,
    level: null,
    charging: null,
  });

  const previousRefreshIntervalRef = useRef<number>(30);

  // Live Feed Stats & Auto-Sync
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    try {
      if (localStorage.getItem('crisis_power_saver_mode') === 'true') {
        return 180;
      }
    } catch {}
    return 30;
  });
  const [countdown, setCountdown] = useState<number>(30);
  const [feedStats, setFeedStats] = useState<LiveFeedStats>({
    usgsCount: 0,
    nasaCount: 0,
    weatherCount: 0,
    lastUpdated: 'Initializing...',
    lastUpdatedTimestamp: Date.now(),
    latencyMs: 0,
    isLiveActive: true,
  });

  const countdownRef = useRef<number>(30);

  // Sync document root class for Power Saver styling and animations
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isPowerSaverMode) {
        document.documentElement.classList.add('power-saver-active');
      } else {
        document.documentElement.classList.remove('power-saver-active');
      }
    }
  }, [isPowerSaverMode]);

  // Handle Power Saver mode toggle
  const handleTogglePowerSaver = (enabled: boolean) => {
    triggerActionHaptic();
    setIsPowerSaverMode(enabled);
    try {
      localStorage.setItem('crisis_power_saver_mode', enabled ? 'true' : 'false');
    } catch {}

    if (enabled) {
      if (autoRefreshInterval < 180 && autoRefreshInterval > 0) {
        previousRefreshIntervalRef.current = autoRefreshInterval;
      }
      setAutoRefreshInterval(180);
      setIsPlayingTimeline(false); // Stop GPU/CPU timeline rendering
    } else {
      setAutoRefreshInterval(previousRefreshIntervalRef.current || 30);
    }
  };

  // Battery Status API (standard browser battery telemetry for field devices)
  useEffect(() => {
    let batteryObj: any = null;
    let isMounted = true;

    const updateBattery = (battery: any) => {
      if (!isMounted) return;
      setBatteryState({
        supported: true,
        level: typeof battery.level === 'number' ? battery.level : null,
        charging: typeof battery.charging === 'boolean' ? battery.charging : null,
      });

      // Automatically engage Power Saver if battery is <= 20% and discharging
      if (
        autoPowerSaverOnLowBattery &&
        typeof battery.level === 'number' &&
        battery.level <= 0.2 &&
        !battery.charging &&
        !isPowerSaverMode
      ) {
        handleTogglePowerSaver(true);
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery()
        .then((battery: any) => {
          if (!isMounted) return;
          batteryObj = battery;
          updateBattery(battery);
          battery.addEventListener('levelchange', () => updateBattery(battery));
          battery.addEventListener('chargingchange', () => updateBattery(battery));
        })
        .catch(() => {
          if (isMounted) {
            setBatteryState({ supported: false, level: null, charging: null });
          }
        });
    }

    return () => {
      isMounted = false;
      if (batteryObj) {
        try {
          batteryObj.removeEventListener('levelchange', () => {});
          batteryObj.removeEventListener('chargingchange', () => {});
        } catch {}
      }
    };
  }, [autoPowerSaverOnLowBattery, isPowerSaverMode]);

  // Sync notification permission status on mount
  useEffect(() => {
    setPermissionStatus(getNotificationPermissionStatus());
  }, []);

  // Time machine animation loop
  useEffect(() => {
    if (!isPlayingTimeline) return;

    const intervalMs = 100;
    const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;
    const baseStepPerSec = windowMs / 30;
    const stepMs = (baseStepPerSec * timelinePlaybackSpeed * (intervalMs / 1000));

    const interval = setInterval(() => {
      setSliderTimestamp(prev => {
        const now = Date.now();
        const minTime = now - windowMs;
        const next = prev + stepMs;
        if (next >= now) {
          return minTime;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlayingTimeline, timeWindowDays, timelinePlaybackSpeed]);

  const handleTimeWindowDaysChange = (days: number) => {
    setTimeWindowDays(days);
    const now = Date.now();
    const minTime = now - days * 24 * 60 * 60 * 1000;
    if (sliderTimestamp < minTime) {
      setSliderTimestamp(minTime);
    }
  };

  // Real-time notification dispatcher when a new CRITICAL calamity is ingested
  const notifyCriticalIngestion = (newCriticalEvents: CalamityEvent[]) => {
    if (newCriticalEvents.length === 0) return;

    newCriticalEvents.forEach(crit => {
      sendDesktopNotification(crit, () => {
        setSelectedEvent(crit);
        setIsModalOpen(true);
      });
    });

    if (isSoundEnabled) {
      playEmergencyAudioChime();
    }

    triggerCriticalAlertHaptic();
    setDesktopAlerts(prev => [...newCriticalEvents, ...prev].slice(0, 3));
  };

  // Ingest live USGS earthquakes & NASA EONET events
  const refreshLiveFeeds = async () => {
    setIsLoadingLive(true);
    try {
      const { events: mergedEvents, stats } = await fetchAllLiveDisasters();

      const incomingCriticals: CalamityEvent[] = [];
      mergedEvents.forEach(ev => {
        if (!knownEventIdsRef.current.has(ev.id)) {
          knownEventIdsRef.current.add(ev.id);
          if (ev.severity === 'CRITICAL') {
            incomingCriticals.push(ev);
          }
        }
      });

      if (incomingCriticals.length > 0) {
        notifyCriticalIngestion(incomingCriticals);
      }

      setEvents(mergedEvents);
      setFeedStats(stats);
      countdownRef.current = autoRefreshInterval;
      setCountdown(autoRefreshInterval);
    } catch (e) {
      console.error('Error syncing live disaster feeds:', e);
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    refreshLiveFeeds();
  }, []);

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    countdownRef.current = autoRefreshInterval;
    setCountdown(autoRefreshInterval);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refreshLiveFeeds();
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  useEffect(() => {
    if (desktopAlerts.length === 0) return;
    const timer = setTimeout(() => {
      setDesktopAlerts(prev => prev.slice(0, prev.length - 1));
    }, 9000);
    return () => clearTimeout(timer);
  }, [desktopAlerts]);

  // Global listener for disaster:locate events dispatched from anywhere in the app
  useEffect(() => {
    const handleGlobalDisasterLocate = (e: Event) => {
      const customEv = e as CustomEvent<CalamityEvent>;
      const target = customEv.detail;
      if (target) {
        setSelectedEvent(target);
        setIsModalOpen(false);
        setActiveTab('map');
        if (filterType !== 'all' && filterType !== target.type) {
          setFilterType('all');
        }
        // Ensure Leaflet map refits cleanly
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    };

    window.addEventListener('disaster:locate', handleGlobalDisasterLocate);
    return () => window.removeEventListener('disaster:locate', handleGlobalDisasterLocate);
  }, [filterType]);

  const handleSelectEvent = (event: CalamityEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleLocateOnMap = (event: CalamityEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(false);
    setActiveTab('map');
    if (filterType !== 'all' && filterType !== event.type) {
      setFilterType('all');
    }
    window.dispatchEvent(new CustomEvent('disaster:locate', { detail: event }));
    // On small screens, close the map drawer so user can immediately see the focused pin
    if (window.innerWidth < 768) {
      setIsMapSheetOpen(false);
    }
  };

  const handleDismissAlert = (id: string) => {
    setDesktopAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleRequestPermission = async () => {
    const result = await requestDesktopNotificationPermission();
    setPermissionStatus(result);
    if (result === 'granted') {
      if (isSoundEnabled) playEmergencyAudioChime();
      if ('Notification' in window) {
        new Notification('🚨 Disaster Monitor: Desktop Alerts Active', {
          body: 'You will receive instant desktop alerts whenever a new CRITICAL severity calamity is ingested.',
        });
      }
    }
  };

  const simulateCriticalIngestion = () => {
    triggerActionHaptic();
    const testId = `live-crit-${Date.now()}`;
    const nowUtc = new Date().toISOString();
    const testSamples = [
      { city: 'Tokyo Offshore Trench', country: 'Japan', lat: 35.6762, lng: 139.6503, name: 'M7.9 Megathrust Seismic Slip', type: 'earthquake' as CalamityType, intensity: '7.9 Mw', scale: 'Moment Magnitude' },
      { city: 'Naples Coastal Caldera', country: 'Italy', lat: 40.8518, lng: 14.2681, name: 'Phlegraean Fields Explosive Plume', type: 'volcano' as CalamityType, intensity: 'VEI 5', scale: 'Volcanic Explosivity' },
      { city: 'Manila Bay & Luzon', country: 'Philippines', lat: 14.5995, lng: 120.9842, name: 'Super Typhoon Hagupit II Eyewall Landfall', type: 'cyclone' as CalamityType, intensity: 'Cat 5 (290 km/h)', scale: 'Saffir-Simpson' },
      { city: 'Valencia Basin', country: 'Spain', lat: 39.4287, lng: -0.4184, name: 'Catastrophic Flash Flood Wave Surge', type: 'flood' as CalamityType, intensity: '520 mm / 6 hrs', scale: 'Hydrograph Peak' },
    ];
    const sample = testSamples[Math.floor(Math.random() * testSamples.length)];

    const simulatedEvent: CalamityEvent = {
      id: testId,
      name: `${sample.name} [LIVE STREAM]`,
      type: sample.type,
      country: sample.country,
      city: sample.city,
      coordinates: { lat: sample.lat, lng: sample.lng },
      severity: 'CRITICAL',
      intensity: {
        scaleName: sample.scale,
        value: sample.intensity,
        unit: 'Critical Magnitude',
        interpretation: 'Direct hazard impact in populated area. Civil defense evacuations underway.',
      },
      satelliteTelemetry: {
        satellite: 'Sentinel-1 SAR / Himawari-9 Multispectral',
        sensor: 'High-Cadence Ingestion Stream',
        lastPassTime: 'Just now',
        confidence: 99,
      },
      medicalEmergency: {
        isMedicalAlert: true,
        affectedPopulation: 850000,
        casualtiesEstimated: 35,
        hospitalPressure: 'CRITICAL_OVERWHELMED',
        pathogenOrCondition: 'Acute Structural Trauma, Severe Hypothermia & Crush Injuries',
        bloodAndMedicalSuppliesNeeded: ['Universal Donor O- Blood Units', 'Field Thoracic Surgery Kits', 'Portable Emergency Hemodialysis'],
      },
      publicAdvisory: {
        headline: `CIVIL DEFENSE LEVEL RED EMERGENCY: ${sample.city}`,
        immediateAction: 'Evacuate low structures immediately. Move to designated municipal high-ground stadiums or deep bunkers.',
        evacuationZoneKm: 25.0,
        safeCorridors: ['Designated Municipal Multi-Agency Civil Protection Corridors'],
        emergencyContact: 'Emergency Civil Defense Dispatch: 911 / 112',
      },
      occurredAt: nowUtc,
      occurrenceTimeLocal: `${new Date().toLocaleTimeString()} (Just Now)`,
      updatedAt: nowUtc,
      source: 'Global Disaster Command Real-Time Telemetry Stream',
      isLiveFeed: true,
      liveFeedSource: 'USGS',
      liveIngestionTime: new Date().toLocaleTimeString(),
    };

    knownEventIdsRef.current.add(simulatedEvent.id);
    setEvents(prev => [simulatedEvent, ...prev]);
    notifyCriticalIngestion([simulatedEvent]);
    setSelectedEvent(simulatedEvent);
  };

  const totalLiveEvents = useMemo(() => {
    return events.filter(e => e.isLiveFeed).length;
  }, [events]);

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    const now = Date.now();
    const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;
    const minTimestamp = now - windowMs;

    events.forEach(e => {
      if (liveOnlyFilter && !e.isLiveFeed) return;
      
      if (e.occurredAt) {
        const evTime = new Date(e.occurredAt).getTime();
        if (evTime < minTimestamp) return;
        if (timelineCumulativeMode) {
          if (evTime > sliderTimestamp) return;
        } else {
          const sliceToleranceMs = 24 * 60 * 60 * 1000;
          if (Math.abs(evTime - sliderTimestamp) > sliceToleranceMs) return;
        }
      }

      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [events, liveOnlyFilter, timeWindowDays, sliderTimestamp, timelineCumulativeMode]);

  const nlQueryResult = useMemo(() => {
    return executeNaturalLanguageSearch(events, naturalLanguageQuery, userLocation);
  }, [events, naturalLanguageQuery, userLocation]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;
    const minTimestamp = now - windowMs;
    const sliceToleranceMs = 24 * 60 * 60 * 1000;

    let baseList = naturalLanguageQuery.trim().length > 0 
      ? nlQueryResult.matchedEvents 
      : events;

    if (quickFilter === 'near_me' && userLocation) {
      baseList = baseList.filter(e => {
        const dist = calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, e.coordinates.lat, e.coordinates.lng);
        return dist <= 500;
      }).sort((a, b) => {
        const distA = calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, a.coordinates.lat, a.coordinates.lng);
        const distB = calculatePreciseDistanceKm(userLocation.lat, userLocation.lng, b.coordinates.lat, b.coordinates.lng);
        return distA - distB;
      });
    } else if (quickFilter === '24h') {
      baseList = baseList.filter(e => {
        if (!e.occurredAt) return true;
        const evTime = new Date(e.occurredAt).getTime();
        return (now - evTime) <= 24 * 60 * 60 * 1000;
      });
    } else if (quickFilter === 'biggest') {
      baseList = baseList.filter(e => e.severity === 'CRITICAL' || e.severity === 'HIGH').sort((a, b) => {
        const scoreA = a.severity === 'CRITICAL' ? 3 : 2;
        const scoreB = b.severity === 'CRITICAL' ? 3 : 2;
        return scoreB - scoreA;
      });
    }

    return baseList.filter(e => {
      if (liveOnlyFilter && !e.isLiveFeed) return false;

      if (e.occurredAt) {
        const evTime = new Date(e.occurredAt).getTime();
        if (evTime < minTimestamp) return false;

        if (timelineCumulativeMode) {
          if (evTime > sliderTimestamp) return false;
        } else {
          if (Math.abs(evTime - sliderTimestamp) > sliceToleranceMs) return false;
        }
      }

      const matchType = filterType === 'all' || e.type === filterType;
      const matchSeverity = severityFilter === 'all' || e.severity === severityFilter;
      const matchSearch =
        searchQuery.trim() === '' ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.type.toLowerCase().includes(searchQuery.toLowerCase());

      return matchType && matchSeverity && matchSearch;
    });
  }, [
    events, 
    naturalLanguageQuery, 
    nlQueryResult, 
    quickFilter, 
    userLocation, 
    filterType, 
    severityFilter, 
    searchQuery, 
    liveOnlyFilter, 
    timeWindowDays, 
    sliderTimestamp, 
    timelineCumulativeMode
  ]);

  // Handle GPS location acquisition from floating FAB
  const handleQuickLocate = async () => {
    triggerLocationLockHaptic();
    try {
      const loc = await requestBrowserLocation();
      setUserLocation(loc);
      setQuickFilter('near_me');
      setIsMapSheetOpen(true);
      setMapSheetTab('near_me');
    } catch (err: any) {
      console.warn('Geolocation unavailable:', err);
      setIsMapSheetOpen(true);
      setMapSheetTab('near_me');
    }
  };

  // Map view alias check
  const isMapTab = activeTab === 'map' || activeTab === 'dashboard';
  const isSafetyTab = activeTab === 'safety' || activeTab === 'assistant' || activeTab === 'dispatch' || activeTab === 'calculator';

  return (
    <div className={`h-screen w-screen overflow-hidden ${isPowerSaverMode ? 'power-saver-active bg-black' : 'bg-slate-950'} text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950`}>
      {/* Real-time Desktop Alert Toast Notifications */}
      <DesktopAlertToast
        alerts={desktopAlerts}
        onDismiss={handleDismissAlert}
        onSelectEvent={handleSelectEvent}
        permissionStatus={permissionStatus}
        onRequestPermission={handleRequestPermission}
      />

      {/* Floating Modern Native App Header Bar */}
      <header className={`h-14 ${isPowerSaverMode ? 'bg-black border-slate-900' : 'bg-slate-950/85 backdrop-blur-xl border-slate-800/80'} border-b px-3 sm:px-4 flex items-center justify-between z-50 shrink-0 select-none`}>
        {/* Brand Pill & Live Status Pulse */}
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl ${isPowerSaverMode ? 'bg-slate-900 border border-slate-800' : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-400 p-0.5 shadow-lg shadow-amber-500/20'} flex items-center justify-center`}>
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Globe2 className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-black text-sm tracking-tight ${isPowerSaverMode ? 'text-white' : 'bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-400 bg-clip-text text-transparent'}`}>
                DISASTER PULSE
              </span>
              <span className="inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 items-center gap-1">
                {!isPowerSaverMode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              USGS & NASA Streams • {events.length} Monitored
            </p>
          </div>
        </div>

        {/* Center: Live Sync Capsule / Quick Search Bar */}
        <div className="flex items-center gap-2">
          {/* Live Ingestion Ticker & Quick Sync */}
          <button
            onClick={refreshLiveFeeds}
            disabled={isLoadingLive}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            title="Auto-sync cadence countdown. Click to sync live USGS and NASA telemetry now."
          >
            <RefreshCw className={`w-3 h-3 text-amber-400 ${isLoadingLive ? 'animate-spin' : ''}`} />
            <span className="font-mono text-amber-300 font-bold">{countdown}s</span>
            <span className="text-slate-500 hidden md:inline">Sync</span>
          </button>

          {/* Quick Power Saver Indicator Pill */}
          {isPowerSaverMode && (
            <button
              onClick={() => {
                triggerActionHaptic();
                setIsAppSettingsOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Power Saver is active (Polling throttled to 180s, animations paused, display dimmed). Tap to configure."
            >
              <ZapOff className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Power Saver</span>
              <span className="font-mono text-amber-400 text-[10px]">180s</span>
            </button>
          )}

          {/* Quick NL Query / Incident Search Trigger on Mobile/Desktop */}
          <div className="relative hidden lg:block w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search city, hazard, or query..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-full pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/80 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Toolbelt: Quick Toggles & App Flyout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Field Responder Power Saver Mode Quick Toggle */}
          <button
            onClick={() => handleTogglePowerSaver(!isPowerSaverMode)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isPowerSaverMode 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' 
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title={isPowerSaverMode ? 'Power Saver Mode is ACTIVE (180s polling, animations paused). Click to disable.' : 'Enable Power Saver Mode (Extend field battery life)'}
          >
            {isPowerSaverMode ? <ZapOff className="w-3.5 h-3.5" /> : <BatteryMedium className="w-3.5 h-3.5" />}
          </button>

          {/* Sound Alarm Toggle */}
          <button
            onClick={() => {
              triggerActionHaptic();
              setIsSoundEnabled(!isSoundEnabled);
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isSoundEnabled 
                ? 'bg-slate-900 text-amber-400 border-amber-500/30 hover:border-amber-400' 
                : 'bg-slate-900 text-slate-600 border-slate-800 hover:text-slate-400'
            }`}
            title={isSoundEnabled ? 'Emergency siren audio enabled (Click to mute)' : 'Emergency audio muted'}
          >
            {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Tactile Haptics Toggle */}
          <button
            onClick={() => {
              const next = !isHapticsActive;
              setIsHapticsActive(next);
              setHapticsEnabled(next);
              if (next) triggerCriticalAlertHaptic();
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isHapticsActive 
                ? 'bg-slate-900 text-amber-400 border-amber-500/30 hover:border-amber-400' 
                : 'bg-slate-900 text-slate-600 border-slate-800 hover:text-slate-400'
            }`}
            title={isHapticsActive ? 'Haptic vibrations enabled' : 'Haptics muted'}
          >
            {isHapticsActive ? <Vibrate className="w-3.5 h-3.5" /> : <VibrateOff className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Simulation / Test Alert */}
          <button
            onClick={simulateCriticalIngestion}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-black bg-rose-600/90 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-950/40 cursor-pointer active:scale-95"
            title="Simulate a real-time CRITICAL hazard alert"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-300 ${isPowerSaverMode ? '' : 'animate-pulse'}`} />
            <span className="hidden sm:inline">Test Alert</span>
          </button>

          {/* Settings / App Menu Flyout Trigger */}
          <button
            onClick={() => {
              triggerActionHaptic();
              setIsAppSettingsOpen(true);
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
            title="App Settings, Store Readiness & Emergency Tools"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </header>

      {/* Main Viewport Container (Edge-to-Edge Spatial App Stage) */}
      <main className="flex-1 relative w-full h-full overflow-hidden">
        {/* ======================================================== */}
        {/* VIEW 1: MAP TAB (EDGE-TO-EDGE PRIMARY APP EXPERIENCE)     */}
        {/* ======================================================== */}
        {isMapTab && (
          <div className="relative w-full h-full flex flex-col overflow-hidden">
            {/* The Underlying Edge-to-Edge Leaflet GIS Canvas */}
            <div className="absolute inset-0 z-0">
              <DisasterMap
                events={filteredEvents}
                allEvents={events}
                selectedEvent={selectedEvent}
                onSelectEvent={handleSelectEvent}
                onClearSelectedEvent={() => setSelectedEvent(null)}
                filteredType={filterType}
                onResetTypeFilter={() => setFilterType('all')}
                onTypeFilterChange={setFilterType}
                userLocation={userLocation}
                onUserLocationChange={setUserLocation}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onNavigateToForecast={() => setActiveTab('forecast')}
                feedStats={feedStats}
                isLoadingLive={isLoadingLive}
                onRefreshFeeds={refreshLiveFeeds}
                isPowerSaverMode={isPowerSaverMode}
              />
            </div>

            {/* Floating Top Category Pill Filter Bar (Glassmorphic) */}
            <div className="absolute top-3 left-3 right-16 sm:right-auto z-[800] pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-1.5 max-w-full sm:max-w-xl md:max-w-3xl bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-slate-800/90 shadow-2xl">
                <button
                  onClick={() => {
                    triggerActionHaptic();
                    setFilterType('all');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>All Hazards</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${filterType === 'all' ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    {filteredEvents.length}
                  </span>
                </button>

                {CALAMITY_METADATA_LIST.map(meta => {
                  const IconComp = CALAMITY_CHIP_ICONS[meta.id] || Activity;
                  const isSelected = filterType === meta.id;
                  const count = countsByType[meta.id] || 0;
                  return (
                    <button
                      key={meta.id}
                      onClick={() => {
                        triggerActionHaptic();
                        setFilterType(meta.id as CalamityType);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                          : count > 0 
                          ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                          : 'text-slate-500 opacity-60 hover:opacity-100 hover:bg-slate-800/40'
                      }`}
                    >
                      <IconComp className="w-3 h-3" />
                      <span>{meta.title}</span>
                      {count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-amber-400'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floating Action Buttons (FABs) on Map */}
            <div className="absolute right-3 bottom-20 z-[800] flex flex-col gap-2 pointer-events-auto">
              {/* GPS Near Me FAB */}
              <button
                onClick={handleQuickLocate}
                className="w-10 h-10 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-sky-400 border border-slate-700/80 shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-90"
                title="Detect GPS & Find Incidents Near Me"
              >
                <Locate className="w-5 h-5" />
              </button>

              {/* Time Machine Toggle FAB */}
              <button
                onClick={() => {
                  triggerActionHaptic();
                  setIsTimeMachineOpen(!isTimeMachineOpen);
                }}
                className={`w-10 h-10 rounded-2xl border shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-90 ${
                  isTimeMachineOpen 
                    ? 'bg-purple-600 text-white border-purple-400 shadow-purple-600/40' 
                    : 'bg-slate-900/90 hover:bg-slate-800 text-purple-400 border-slate-700/80'
                }`}
                title="Toggle Historical Time-Series Progression Slider"
              >
                <Clock className="w-5 h-5" />
              </button>

              {/* Toggle App Drawer FAB */}
              <button
                onClick={() => {
                  triggerActionHaptic();
                  setIsMapSheetOpen(!isMapSheetOpen);
                }}
                className={`w-10 h-10 rounded-2xl border shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-90 relative ${
                  isMapSheetOpen 
                    ? 'bg-amber-500 text-slate-950 border-amber-300' 
                    : 'bg-slate-900/90 hover:bg-slate-800 text-amber-400 border-slate-700/80'
                }`}
                title="Toggle Incident Feed & Proximity Sheet"
              >
                <Layers className="w-5 h-5" />
                {!isMapSheetOpen && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {filteredEvents.length}
                  </span>
                )}
              </button>
            </div>

            {/* Floating Map App Sheet (Drawer / Bottom Sheet that leaves map active) */}
            {isMapSheetOpen ? (
              <div className="absolute top-16 left-3 bottom-20 z-[850] w-[calc(100vw-24px)] sm:w-96 md:w-[410px] bg-slate-950/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn transition-all">
                {/* Sheet Header & View Switcher */}
                <div className="p-3 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
                    <button
                      onClick={() => {
                        triggerActionHaptic();
                        setMapSheetTab('cards');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mapSheetTab === 'cards'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Feed ({filteredEvents.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerActionHaptic();
                        setMapSheetTab('near_me');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mapSheetTab === 'near_me'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Locate className="w-3.5 h-3.5" />
                      <span>Near Me</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerActionHaptic();
                        setMapSheetTab('timeline');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mapSheetTab === 'timeline'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Timeline</span>
                    </button>
                  </div>

                  {/* Collapse Sheet Button */}
                  <button
                    onClick={() => {
                      triggerActionHaptic();
                      setIsMapSheetOpen(false);
                    }}
                    className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Minimize Drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sheet Body Content with Custom Scroll */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  {mapSheetTab === 'near_me' && (
                    <div className="space-y-3">
                      <DisastersNearMeHero
                        events={events}
                        userLocation={userLocation}
                        onUserLocationChange={setUserLocation}
                        onSelectEvent={handleSelectEvent}
                        activeQuickFilter={quickFilter}
                        onQuickFilterChange={setQuickFilter}
                        onRefreshFeeds={refreshLiveFeeds}
                        isLoadingLive={isLoadingLive}
                      />
                      <NaturalLanguageSearchBar
                        query={naturalLanguageQuery}
                        onQueryChange={setNaturalLanguageQuery}
                        appliedSummary={nlQueryResult.appliedFiltersSummary}
                        noDataMessage={nlQueryResult.noDataMessage}
                        totalResultsCount={filteredEvents.length}
                      />
                    </div>
                  )}

                  {mapSheetTab === 'cards' && (
                    <div className="space-y-2.5">
                      {/* Search & Severity quick pills */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Filter in drawer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
                          />
                        </div>
                        <button
                          onClick={() => setSeverityFilter(severityFilter === 'CRITICAL' ? 'all' : 'CRITICAL')}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                            severityFilter === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          Crit Only
                        </button>
                      </div>

                      {filteredEvents.length > 0 ? (
                        filteredEvents.map(ev => (
                          <DisasterEventCard
                            key={ev.id}
                            event={ev}
                            userLocation={userLocation}
                            isSelected={selectedEvent?.id === ev.id}
                            onSelectEvent={handleSelectEvent}
                            onLocateOnMap={handleLocateOnMap}
                            onOpenReportModal={(eventName) => {
                              setReportModalEventName(eventName);
                              setIsReportModalOpen(true);
                            }}
                          />
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400 space-y-2">
                          <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
                          <p className="text-xs font-bold text-slate-300">No matching incidents</p>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setFilterType('all');
                              setSeverityFilter('all');
                              setNaturalLanguageQuery('');
                            }}
                            className="text-[11px] text-amber-400 underline font-semibold cursor-pointer"
                          >
                            Reset filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {mapSheetTab === 'timeline' && (
                    <div className="h-full min-h-[400px]">
                      <ChronologicalTimeline
                        events={filteredEvents}
                        selectedEvent={selectedEvent}
                        onSelectEvent={handleSelectEvent}
                        userLocation={userLocation}
                        isFullWidth={false}
                        className="border-0 rounded-none shadow-none h-full bg-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Minimized Floating Drawer Capsule */
              <div className="absolute bottom-20 left-3 z-[850] pointer-events-auto">
                <button
                  onClick={() => {
                    triggerActionHaptic();
                    setIsMapSheetOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-slate-800 text-slate-200 hover:text-white shadow-2xl hover:border-amber-500/50 transition-all cursor-pointer group"
                >
                  <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">
                    {filteredEvents.length} Active Hazards
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}

            {/* Floating Time Machine Player HUD (Overlay directly on Map) */}
            {isTimeMachineOpen && (
              <div className="absolute bottom-20 left-3 right-3 sm:left-auto sm:right-16 sm:w-[500px] z-[850] bg-slate-950/95 backdrop-blur-2xl border border-purple-500/40 rounded-3xl p-3 shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white">Historical Time Machine</span>
                  </div>
                  <button
                    onClick={() => setIsTimeMachineOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <TimeSeriesSlider
                  events={events}
                  timeWindowDays={timeWindowDays}
                  onChangeTimeWindowDays={handleTimeWindowDaysChange}
                  currentTimestamp={sliderTimestamp}
                  onChangeTimestamp={setSliderTimestamp}
                  isPlaying={isPlayingTimeline}
                  onTogglePlay={() => setIsPlayingTimeline(!isPlayingTimeline)}
                  cumulativeMode={timelineCumulativeMode}
                  onToggleCumulativeMode={() => setTimelineCumulativeMode(!timelineCumulativeMode)}
                  playbackSpeed={timelinePlaybackSpeed}
                  onChangePlaybackSpeed={setTimelinePlaybackSpeed}
                  filteredCount={filteredEvents.length}
                  totalCount={events.length}
                  onSelectEvent={handleSelectEvent}
                />
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: DEDICATED INCIDENTS & PROXIMITY FEED TAB         */}
        {/* ======================================================== */}
        {activeTab === 'feed' && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-28 max-w-4xl mx-auto space-y-4">
            <AdvisoryBanner
              events={events}
              filteredEvents={filteredEvents}
              liveOnlyFilter={liveOnlyFilter}
              onToggleLiveOnly={setLiveOnlyFilter}
              totalLiveCount={totalLiveEvents}
              isLoadingLive={isLoadingLive}
              lastUpdated={feedStats.lastUpdated}
              onSelectEvent={handleSelectEvent}
            />

            <DisastersNearMeHero
              events={events}
              userLocation={userLocation}
              onUserLocationChange={setUserLocation}
              onSelectEvent={handleSelectEvent}
              activeQuickFilter={quickFilter}
              onQuickFilterChange={setQuickFilter}
              onRefreshFeeds={refreshLiveFeeds}
              isLoadingLive={isLoadingLive}
            />

            <NaturalLanguageSearchBar
              query={naturalLanguageQuery}
              onQueryChange={setNaturalLanguageQuery}
              appliedSummary={nlQueryResult.appliedFiltersSummary}
              noDataMessage={nlQueryResult.noDataMessage}
              totalResultsCount={filteredEvents.length}
            />

            <CalamityFilter
              selectedType={filterType}
              onSelectType={setFilterType}
              countsByType={countsByType}
              totalCount={filteredEvents.length}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                <span className="font-bold">Active Live Stream ({filteredEvents.length} Incidents)</span>
                <span className="font-mono text-[11px] text-amber-400">Tap card to focus on map</span>
              </div>
              {filteredEvents.map(ev => (
                <DisasterEventCard
                  key={ev.id}
                  event={ev}
                  userLocation={userLocation}
                  isSelected={selectedEvent?.id === ev.id}
                  onSelectEvent={handleSelectEvent}
                  onLocateOnMap={handleLocateOnMap}
                  onOpenReportModal={(eventName) => {
                    setReportModalEventName(eventName);
                    setIsReportModalOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: ML HAZARD FORECASTER TAB                        */}
        {/* ======================================================== */}
        {activeTab === 'forecast' && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-28 max-w-6xl mx-auto">
            <MLHazardForecaster
              events={events}
              onInspectHotspotOnMap={(hotspot) => {
                setActiveTab('map');
                setSearchQuery(hotspot.country);
              }}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: GEOSPATIAL LAB / REMOTE SENSING WORKBENCH       */}
        {/* ======================================================== */}
        {activeTab === 'geoworkbench' && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-28 max-w-6xl mx-auto">
            <GeospatialWorkbench
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={handleSelectEvent}
              onPlotIsochroneOnMap={() => {
                setActiveTab('map');
              }}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: DISASTER ANALYTICS                              */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-28 max-w-6xl mx-auto">
            <DisasterAnalytics
              events={liveOnlyFilter ? events.filter(e => e.isLiveFeed) : events}
              filteredEvents={filteredEvents}
              liveOnlyFilter={liveOnlyFilter}
              onToggleLiveOnly={setLiveOnlyFilter}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 6: SAFETY & EMERGENCY TOOLS (AI, DISPATCH, CALC)   */}
        {/* ======================================================== */}
        {isSafetyTab && (
          <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pb-28 max-w-5xl mx-auto space-y-4">
            {/* Safety Sub-Navigation Bar */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 max-w-md mx-auto">
              <button
                onClick={() => setSafetySubTab('assistant')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  safetySubTab === 'assistant'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Assistant</span>
              </button>
              <button
                onClick={() => setSafetySubTab('dispatch')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  safetySubTab === 'dispatch'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Field Dispatch</span>
              </button>
              <button
                onClick={() => setSafetySubTab('calculator')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  safetySubTab === 'calculator'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculator</span>
              </button>
            </div>

            {safetySubTab === 'assistant' && <DisasterAiAssistant />}
            {safetySubTab === 'dispatch' && <EmergencyDispatchHub events={events} />}
            {safetySubTab === 'calculator' && <IntensityCalculator />}
          </div>
        )}
      </main>

      {/* Floating Modern Native App Bottom Dock (iOS/Android Style) */}
      <nav className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-[1000] px-2 py-1.5 rounded-2xl ${isPowerSaverMode ? 'bg-black border-slate-900 shadow-none' : 'bg-slate-950/90 backdrop-blur-2xl border-slate-800/90 shadow-2xl'} border flex items-center gap-1 sm:gap-2`}>
        {/* Tab 1: Live Radar Map */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('map');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isMapTab
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Radar Map</span>
        </button>

        {/* Tab 2: Incident Feed */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('feed');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'feed'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Incidents</span>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        </button>

        {/* Tab 3: Machine Learning Hazard Forecast */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('forecast');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'forecast'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-purple-300/80 hover:text-purple-200 hover:bg-slate-900/60'
          }`}
        >
          <Brain className="w-4 h-4" />
          <span className="hidden sm:inline">Predict ML</span>
          <span className="sm:hidden">ML</span>
        </button>

        {/* Tab 4: GeoSpatial Lab */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('geoworkbench');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'geoworkbench'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-slate-900/60'
          }`}
        >
          <Satellite className="w-4 h-4" />
          <span className="hidden sm:inline">GeoLab</span>
          <span className="sm:hidden">Lab</span>
        </button>

        {/* Tab 5: Analytics */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('analytics');
          }}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </button>

        {/* Tab 6: Safety & Emergency AI */}
        <button
          onClick={() => {
            triggerActionHaptic();
            setActiveTab('safety');
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isSafetyTab
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-400" />
          <span>Safety</span>
        </button>
      </nav>

      {/* Slide-Over App Settings & Utilities Sheet */}
      {isAppSettingsOpen && (
        <div className="fixed inset-0 z-[1500] bg-slate-950/70 backdrop-blur-md flex justify-end animate-fadeIn ps-oled-surface">
          <div className="w-full max-w-sm h-full bg-slate-900 border-l border-slate-800 p-5 flex flex-col justify-between overflow-y-auto ps-oled-surface">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span className="font-black text-sm text-white">App Settings & Tools</span>
                </div>
                <button
                  onClick={() => setIsAppSettingsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Field Responder Power Saver Mode Card */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isPowerSaverMode 
                  ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/50' 
                  : 'bg-slate-950/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isPowerSaverMode 
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' 
                        : 'bg-slate-850 text-slate-400 border border-slate-800'
                    }`}>
                      {isPowerSaverMode ? <ZapOff className="w-4 h-4" /> : <BatteryMedium className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white">Power Saver Mode</span>
                        {isPowerSaverMode && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {isPowerSaverMode ? 'Throttled polling, paused animations, dimmed chrome' : 'Extend field responder battery life'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPowerSaverMode}
                    onClick={() => handleTogglePowerSaver(!isPowerSaverMode)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPowerSaverMode ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isPowerSaverMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Real-time Battery Telemetry if supported */}
                {batteryState.supported && batteryState.level !== null && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      {batteryState.charging ? (
                        <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (batteryState.level <= 0.2) ? (
                        <BatteryLow className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                      ) : (
                        <BatteryMedium className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Battery:</span>
                      <span className="font-mono font-bold text-white">
                        {Math.round(batteryState.level * 100)}%
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({batteryState.charging ? 'Charging' : 'On Battery'})
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        const next = !autoPowerSaverOnLowBattery;
                        setAutoPowerSaverOnLowBattery(next);
                        try {
                          localStorage.setItem('crisis_auto_power_saver_low_batt', next ? 'true' : 'false');
                        } catch {}
                      }}
                      className={`text-[9px] px-2 py-0.5 rounded cursor-pointer border ${
                        autoPowerSaverOnLowBattery 
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                      title="Automatically switch to Power Saver when device battery drops to 20%"
                    >
                      Auto ≤20%: {autoPowerSaverOnLowBattery ? 'ON' : 'OFF'}
                    </button>
                  </div>
                )}

                {/* Active Power Saving Optimizations Checklist */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Telemetry Polling:</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300">
                      {isPowerSaverMode ? 'Throttled to 180s (Eco)' : `${autoRefreshInterval}s (Normal)`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3 h-3 text-purple-400" />
                      <span>Animations & Keyframes:</span>
                    </span>
                    <span className={`font-semibold ${isPowerSaverMode ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isPowerSaverMode ? 'Paused (0% GPU draw)' : 'Active (60 FPS)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Moon className="w-3 h-3 text-cyan-400" />
                      <span>Display & Chrome Dimming:</span>
                    </span>
                    <span className={`font-semibold ${isPowerSaverMode ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isPowerSaverMode ? 'AMOLED True Black' : 'Glassmorphic'}
                    </span>
                  </div>
                </div>
              </div>

              {/* App Status Card */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs ps-dim-subtle">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>Feed Engine Status</span>
                  <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    {!isPowerSaverMode && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>}
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ingesting USGS Seismics, GDACS Alerts & NASA EONET. Auto-refresh: {autoRefreshInterval}s
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setIsAppSettingsOpen(false);
                    setIsStoreReadinessOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>App Store Readiness Audit</span>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </button>

                <button
                  onClick={() => {
                    setIsAppSettingsOpen(false);
                    setIsReportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-amber-500/30 text-amber-300 font-bold text-xs transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    <span>Report Data Issue / Feedback</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-amber-400 -rotate-90" />
                </button>

                <button
                  onClick={handleRequestPermission}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-sky-400" />
                    <span>Desktop Notifications</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${permissionStatus === 'granted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'}`}>
                    {permissionStatus}
                  </span>
                </button>
              </div>

              {/* Feed Controls */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Live Stream Controls</span>
                <LiveFeedControls
                  stats={feedStats}
                  isLoading={isLoadingLive}
                  onRefresh={refreshLiveFeeds}
                  autoRefreshInterval={autoRefreshInterval}
                  onChangeAutoRefresh={setAutoRefreshInterval}
                  countdown={countdown}
                  liveOnlyFilter={liveOnlyFilter}
                  onToggleLiveOnly={setLiveOnlyFilter}
                  totalLiveCount={totalLiveEvents}
                  isPowerSaverMode={isPowerSaverMode}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 space-y-1">
              <p>DISASTER PULSE • MSc Geoinformatics Web App</p>
              <p>USGS Earthquake Hazards • NASA EONET • GDACS</p>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Detail & Advisory Modal */}
      {isModalOpen && (
        <DisasterDetailModal
          event={selectedEvent}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* App Store Launch & Mobile Readiness Audit Modal */}
      <AppStoreReadinessModal
        isOpen={isStoreReadinessOpen}
        onClose={() => setIsStoreReadinessOpen(false)}
      />

      {/* Report a Problem Modal */}
      <ReportProblemModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedEventName={reportModalEventName}
      />
    </div>
  );
}
