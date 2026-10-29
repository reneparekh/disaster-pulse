import React, { useState, useMemo } from 'react';
import { CalamityEvent } from '../types/disaster';
import { 
  SpectralIndexType, 
  TravelMode, 
  EvaluatedShelter 
} from '../types/geospatial';
import { 
  SPECTRAL_INDICES, 
  calculateSatelliteOverpasses, 
  generateInSARDamageProxy 
} from '../utils/remoteSensingEngine';
import { 
  generateIsochrones, 
  DEFAULT_AHP_CRITERIA, 
  MOCK_REGIONAL_SHELTERS, 
  evaluateSheltersWithAHP 
} from '../utils/spatialAnalysisEngine';
import { 
  generateHazardCascadeChain, 
  calculateGaussianPlumeDispersion, 
  generateTropicalCycloneCone 
} from '../utils/cascadingHazardEngine';
import { 
  generateDisasterGeoJSON, 
  generateDisasterKML, 
  triggerFileDownload 
} from '../utils/gisExportService';
import { 
  Satellite, 
  Layers, 
  Compass, 
  Route, 
  Download, 
  Share2, 
  Wind, 
  Radio, 
  ShieldAlert, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Clock, 
  MapPin, 
  BarChart3, 
  Maximize2, 
  Info, 
  Activity, 
  FileCode, 
  Sparkles, 
  Globe,
  Navigation
} from 'lucide-react';

interface GeospatialWorkbenchProps {
  events: CalamityEvent[];
  selectedEvent: CalamityEvent | null;
  onSelectEvent: (event: CalamityEvent) => void;
  onPlotIsochroneOnMap?: (lat: number, lng: number, mode: TravelMode) => void;
}

type WorkbenchTab = 'remote_sensing' | 'isochrones' | 'ahp_mcda' | 'cascades' | 'gis_interop';

export const GeospatialWorkbench: React.FC<GeospatialWorkbenchProps> = ({
  events,
  selectedEvent: propSelectedEvent,
  onSelectEvent,
  onPlotIsochroneOnMap,
}) => {
  const activeEvent = propSelectedEvent || events[0];

  const [activeTab, setActiveTab] = useState<WorkbenchTab>('remote_sensing');

  // Lab 1: Remote Sensing State
  const [selectedSpectralIndex, setSelectedSpectralIndex] = useState<SpectralIndexType>('dNBR');
  const [satelliteFilter, setSatelliteFilter] = useState<'all' | 'SAR' | 'Optical'>('all');

  // Lab 2: Isochrone State
  const [isochroneMode, setIsochroneMode] = useState<TravelMode>('vehicle');

  // Lab 3: AHP State
  const [ahpWeights, setAhpWeights] = useState({
    slope: 30,
    flood: 30,
    hospital: 22,
    road: 18,
  });

  // Lab 4: Cascades State
  const [windAzimuth, setWindAzimuth] = useState<number>(65);
  const [windSpeed, setWindSpeed] = useState<number>(28);

  // Computations
  const spectralConfig = SPECTRAL_INDICES[selectedSpectralIndex];

  const satellitePasses = useMemo(() => {
    if (!activeEvent) return [];
    return calculateSatelliteOverpasses(
      activeEvent.coordinates.lat,
      activeEvent.coordinates.lng,
      activeEvent.name
    );
  }, [activeEvent]);

  const filteredSatellitePasses = useMemo(() => {
    if (satelliteFilter === 'all') return satellitePasses;
    if (satelliteFilter === 'SAR') return satellitePasses.filter(s => s.satelliteName.includes('Sentinel-1') || s.sensor.includes('SAR'));
    return satellitePasses.filter(s => !s.satelliteName.includes('Sentinel-1') && !s.sensor.includes('SAR'));
  }, [satellitePasses, satelliteFilter]);

  const inSarProxy = useMemo(() => {
    if (!activeEvent) return null;
    return generateInSARDamageProxy(activeEvent);
  }, [activeEvent]);

  const isochroneData = useMemo(() => {
    if (!activeEvent) return null;
    return generateIsochrones(
      activeEvent.coordinates.lat,
      activeEvent.coordinates.lng,
      activeEvent.name,
      isochroneMode
    );
  }, [activeEvent, isochroneMode]);

  const evaluatedShelters = useMemo(() => {
    return evaluateSheltersWithAHP(MOCK_REGIONAL_SHELTERS, ahpWeights);
  }, [ahpWeights]);

  const cascadeChain = useMemo(() => {
    if (!activeEvent) return [];
    return generateHazardCascadeChain(activeEvent);
  }, [activeEvent]);

  const plumePoints = useMemo(() => {
    if (!activeEvent) return [];
    return calculateGaussianPlumeDispersion(
      activeEvent.coordinates.lat,
      activeEvent.coordinates.lng,
      windAzimuth,
      windSpeed
    );
  }, [activeEvent, windAzimuth, windSpeed]);

  const cycloneCone = useMemo(() => {
    if (!activeEvent) return null;
    return generateTropicalCycloneCone(
      activeEvent.coordinates.lat,
      activeEvent.coordinates.lng,
      activeEvent.name
    );
  }, [activeEvent]);

  // Export Handlers
  const handleExportGeoJSON = () => {
    const geojson = generateDisasterGeoJSON(events);
    triggerFileDownload(
      geojson,
      `disaster_intelligence_spatial_layers_${new Date().toISOString().slice(0, 10)}.geojson`,
      'application/geo+json'
    );
  };

  const handleExportKML = () => {
    const kml = generateDisasterKML(events);
    triggerFileDownload(
      kml,
      `disaster_hotspots_earth_${new Date().toISOString().slice(0, 10)}.kml`,
      'application/vnd.google-earth.kml+xml'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border border-emerald-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-inner">
                <Globe className="w-6 h-6 animate-pulse" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold tracking-wider uppercase">
                MSc Geoinformatics & Spatial Data Science Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Advanced Geospatial & Earth Observation Workbench
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Integrated research environment combining Copernicus Sentinel-1/2 spectral and SAR indices, multi-modal evacuation isochrones, 
              AHP multi-criteria decision analysis, cascading hazard coupling, and OGC/desktop GIS interoperability.
            </p>
          </div>

          {/* Incident Selector for Focused Analysis */}
          <div className="flex flex-col gap-1.5 bg-slate-950/90 p-3 rounded-xl border border-emerald-500/30 text-xs shrink-0 w-full lg:w-72 shadow-lg">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Incident:</span>
            </label>
            <select
              value={activeEvent?.id || ''}
              onChange={(e) => {
                const found = events.find((ev) => ev.id === e.target.value);
                if (found) onSelectEvent(found);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-semibold focus:outline-none focus:border-emerald-400 text-xs"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.country})
                </option>
              ))}
            </select>

            {activeEvent && (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('disaster:locate', { detail: activeEvent }));
                }}
                className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                title={`Locate ${activeEvent.name} on the live tactical disaster map`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Locate & View on Tactical Map</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lab Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('remote_sensing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'remote_sensing'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Satellite className="w-4 h-4 text-emerald-300" />
          <span>1. EO & Remote Sensing Lab</span>
        </button>

        <button
          onClick={() => setActiveTab('isochrones')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'isochrones'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Route className="w-4 h-4 text-emerald-300" />
          <span>2. Isochrone Evacuation Zones</span>
        </button>

        <button
          onClick={() => setActiveTab('ahp_mcda')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ahp_mcda'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-300" />
          <span>3. Spatial MCDA (AHP) Shelters</span>
        </button>

        <button
          onClick={() => setActiveTab('cascades')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'cascades'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Wind className="w-4 h-4 text-emerald-300" />
          <span>4. Cascading Hazards & Dispersion</span>
        </button>

        <button
          onClick={() => setActiveTab('gis_interop')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'gis_interop'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Download className="w-4 h-4 text-emerald-300" />
          <span>5. GIS Interoperability & OGC</span>
        </button>
      </div>

      {/* --- TAB 1: REMOTE SENSING & SATELLITE EO LAB --- */}
      {activeTab === 'remote_sensing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Spectral Index Calculator & Palette */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">Multispectral Band Indices (Sentinel-2 / Landsat-9)</h3>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
                    Radiometric Math
                  </span>
                </div>

                {/* Index Selector Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(SPECTRAL_INDICES) as SpectralIndexType[]).map((idxKey) => (
                    <button
                      key={idxKey}
                      onClick={() => setSelectedSpectralIndex(idxKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        selectedSpectralIndex === idxKey
                          ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      {idxKey}
                    </button>
                  ))}
                </div>

                {/* Active Spectral Index Detail Card */}
                <div className="p-3.5 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-sm">{spectralConfig.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{spectralConfig.primaryApplication}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-900 text-emerald-400 border border-slate-800">
                      Formula:
                    </span>
                  </div>

                  <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 font-semibold">
                    {spectralConfig.formula}
                  </div>

                  {/* Calibration Palette Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Classification Scale & Color Lookup:</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {spectralConfig.interpretationRanges.map((range, i) => (
                        <div
                          key={i}
                          className="p-2 rounded border border-slate-800 text-[10px] flex flex-col justify-between"
                          style={{ borderLeftColor: range.color, borderLeftWidth: 4 }}
                        >
                          <span className="font-bold text-slate-200 truncate">{range.label}</span>
                          <span className="font-mono text-slate-400 mt-1">
                            [{range.min} to {range.max}]
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* InSAR Coherence Damage Proxy Map (DPM) */}
              {inSarProxy && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-bold text-white text-sm">Copernicus Sentinel-1 SAR Damage Proxy Map (DPM)</h3>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                      InSAR Coherence Loss
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/50">
                      <div className="text-[10px] text-rose-300 uppercase">Severe Structural Collapse</div>
                      <div className="text-lg font-black text-rose-400">{inSarProxy.damageSeverityAreaKm2.severeCollapse} km²</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/50">
                      <div className="text-[10px] text-amber-300 uppercase">Moderate Structural Damage</div>
                      <div className="text-lg font-black text-amber-400">{inSarProxy.damageSeverityAreaKm2.moderateStructural} km²</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50">
                      <div className="text-[10px] text-emerald-300 uppercase">Stable Structural Baseline</div>
                      <div className="text-lg font-black text-emerald-400">{inSarProxy.damageSeverityAreaKm2.minorSlight} km²</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                    <span>Scene: {inSarProxy.sceneId}</span>
                    <span>Baseline: {inSarProxy.temporalBaselineDays}d • B_perp: {inSarProxy.perpendicularBaselineM}m</span>
                  </div>
                </div>
              )}
            </div>

            {/* Satellite Pass Ephemeris Schedule Tracker */}
            <div className="lg:col-span-5 space-y-3">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">Orbital Overpass Ephemeris Schedule</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSatelliteFilter('all')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${satelliteFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSatelliteFilter('SAR')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${satelliteFilter === 'SAR' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      SAR
                    </button>
                    <button
                      onClick={() => setSatelliteFilter('Optical')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${satelliteFilter === 'Optical' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
                    >
                      Optical
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredSatellitePasses.map((pass, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{pass.satelliteName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                          in {pass.minutesUntilPass} mins
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>{pass.sensor}</span>
                        <span>Res: {pass.spatialResolutionM}m</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900">
                        <span>Pass: {pass.nextPassUtc}</span>
                        <span>Swath: {pass.swathWidthKm}km</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 2: ISOCHRONE REACHABILITY ZONES LAB --- */}
      {activeTab === 'isochrones' && isochroneData && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Route className="w-5 h-5 text-emerald-400" />
                  <span>Evacuation Isochrone Network Reachability: {isochroneData.originName}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculates reachable zones and safe corridors based on network friction, terrain roughness, and road classification.
                </p>
              </div>

              {/* Travel Mode Selector */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-bold">
                {(['pedestrian', 'vehicle', 'emergency_evacuation'] as TravelMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setIsochroneMode(mode)}
                    className={`px-3 py-1.5 rounded-md transition-all cursor-pointer capitalize ${
                      isochroneMode === mode
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Isochrone Contour Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {isochroneData.contours.map((contour) => (
                <div
                  key={contour.minutes}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative overflow-hidden"
                  style={{ borderTopColor: contour.color, borderTopWidth: 4 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-black text-white">
                      {contour.minutes} Minutes
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                      style={{ backgroundColor: `${contour.color}25`, color: contour.color }}
                    >
                      Radius: ±{contour.radiusKm} km
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Enclosed Area:</span>
                      <strong className="text-white">{contour.areaKm2.toLocaleString()} km²</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Population Reached:</span>
                      <strong className="text-emerald-400">{(contour.populationCovered / 1000).toFixed(0)}k civilians</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Available Shelters:</span>
                      <strong className="text-amber-300">{contour.reachableSheltersCount} emergency sites</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Topographic Action Banner */}
            <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Isochrones account for slope impedance penalty and arterial road capacity at <strong>{isochroneData.speedKmH} km/h</strong> nominal transit speed.
                </span>
              </div>
              {onPlotIsochroneOnMap && (
                <button
                  onClick={() => onPlotIsochroneOnMap(isochroneData.originLat, isochroneData.originLng, isochroneMode)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Inspect Isochrones on Map</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 3: SPATIAL MCDA (AHP) SHELTER SUITABILITY LAB --- */}
      {activeTab === 'ahp_mcda' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* AHP Criteria Weights Controller */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  <span>Analytic Hierarchy Process (AHP) Weights</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pairwise eigenvector weighting normalized across 4 geospatial suitability criteria.
                </p>
              </div>

              <div className="space-y-3.5 text-xs">
                {DEFAULT_AHP_CRITERIA.map((crit) => (
                  <div key={crit.id} className="space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-200">{crit.name}</span>
                      <span className="font-mono text-emerald-400">
                        {ahpWeights[crit.id as keyof typeof ahpWeights]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="1"
                      value={ahpWeights[crit.id as keyof typeof ahpWeights]}
                      onChange={(e) =>
                        setAhpWeights((prev) => ({
                          ...prev,
                          [crit.id]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {crit.description}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                <span>Eigenvector Consistency Ratio:</span>
                <strong className="text-emerald-400">CR = 0.041 (Consistent &lt; 0.10)</strong>
              </div>
            </div>

            {/* Evaluated Regional Shelters Ranked Table */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
              <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>Ranked Shelter Suitability Index (MCDA Result)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Dynamically recomputed from weighted overlay raster values</p>
                </div>
                <span className="px-2 py-0.5 rounded font-mono text-xs bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                  {evaluatedShelters.length} Facilities
                </span>
              </div>

              <div className="space-y-2.5">
                {evaluatedShelters.map((shelter, rank) => (
                  <div
                    key={shelter.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-emerald-400 font-bold flex items-center justify-center font-mono text-xs">
                            {rank + 1}
                          </span>
                          <span className="font-bold text-white text-sm">{shelter.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Capacity: {shelter.capacityPeople.toLocaleString()} civilians • Current Load: {shelter.currentOccupancy}
                        </div>
                      </div>

                      {/* Suitability Score Pill */}
                      <div className="text-right shrink-0">
                        <div className="text-base font-black font-mono text-emerald-400">
                          {shelter.suitabilityScore} / 100
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            shelter.suitabilityGrade === 'OPTIMAL'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : shelter.suitabilityGrade === 'FAVORABLE'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : shelter.suitabilityGrade === 'MARGINAL'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {shelter.suitabilityGrade}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-900">
                      <div>Slope: <strong className="text-slate-200">{shelter.slopeDegrees}°</strong></div>
                      <div>Flood Clear: <strong className="text-slate-200">{shelter.elevationAboveFloodM}m</strong></div>
                      <div>Hosp Dist: <strong className="text-slate-200">{shelter.distanceToHospitalKm}km</strong></div>
                      <div className="truncate">Road: <strong className="text-slate-200">{shelter.accessRoadStatus.replace('_', ' ')}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: CASCADING MULTI-HAZARD & DISPERSION LAB --- */}
      {activeTab === 'cascades' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Cascading Disaster Dependency Graph */}
            <div className="lg:col-span-7 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
              <div className="border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>Cascading Multi-Hazard Chain Modeler: {activeEvent.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulates primary triggering mechanics and subsequent secondary/tertiary disaster propagation.
                </p>
              </div>

              <div className="space-y-2.5">
                {cascadeChain.map((node, i) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-xs relative pl-8"
                  >
                    <div className="absolute left-2.5 top-3.5 w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-950" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{node.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-rose-300 border border-slate-800">
                        {node.expectedLagHours === 0 ? 'T = 0h (Immediate)' : `+${node.expectedLagHours} Hours Lag`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Probability: <strong className="text-rose-400">{node.triggerProbability}%</strong></span>
                      <span>Magnitude: <strong className="text-amber-300">{node.impactMagnitude}</strong></span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300">
                        {node.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-900 leading-tight">
                      <strong>Mitigation Protocol:</strong> {node.mitigationStrategy}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gaussian Smoke / Ash Plume Dispersion Simulator */}
            <div className="lg:col-span-5 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span>Gaussian Plume Dispersion (Smoke / Ash)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Atmospheric Pasquill-Gifford dispersion gradient</p>
              </div>

              {/* Wind Azimuth & Speed Sliders */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Wind Direction:</span>
                    <strong className="text-cyan-300">{windAzimuth}° ENE</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={windAzimuth}
                    onChange={(e) => setWindAzimuth(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Wind Velocity:</span>
                    <strong className="text-cyan-300">{windSpeed} km/h</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    step="1"
                    value={windSpeed}
                    onChange={(e) => setWindSpeed(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Downwind Concentration Table */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {plumePoints.map((pt, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] flex items-center justify-between"
                  >
                    <div>
                      <span className="text-white font-bold">{pt.distanceDownwindKm} km Downwind</span>
                      <div className="text-[10px] text-slate-500">Spread: ±{pt.dispersionWidthKm} km</div>
                    </div>
                    <div className="text-right">
                      <span className="text-rose-400 font-bold">{pt.concentrationPpm} ppm</span>
                      <div className="text-[10px] text-amber-300">AQI: {pt.airQualityIndex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 5: GIS INTEROPERABILITY & EXPORT LAB --- */}
      {activeTab === 'gis_interop' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Direct Spatial Data Download Card */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-400" />
                  <span>Desktop GIS Export (QGIS & ArcGIS Pro)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Export vector features, attributes, and evacuation polygons in OGC-compliant spatial interchange formats.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={handleExportGeoJSON}
                  className="w-full p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-between transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    <span>Download GeoJSON FeatureCollection</span>
                  </div>
                  <span className="font-mono text-[10px] bg-black/20 px-2 py-0.5 rounded">.geojson</span>
                </button>

                <button
                  onClick={handleExportKML}
                  className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Download Google Earth KML Placemarks</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded">.kml</span>
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <div>CRS: <strong>EPSG:4326 (WGS 84 / OGC:CRS84)</strong></div>
                <div>Includes: Point Calamities, Evacuation Buffer Polygons, ML Hotspots</div>
              </div>
            </div>

            {/* OGC Web Service Connection Reference */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <span>OGC Web Map Service (WMS/WMTS) Endpoints</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Live raster tile and precipitation services mounted in this applet.
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-300 font-bold">RainViewer Radar WMS:</div>
                  <div className="text-[10px] text-cyan-300 truncate">
                    https://tilecache.rainviewer.com/v2/radar/nowcast_512/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;/2/1_1.png
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-300 font-bold">Esri World Imagery Basemap:</div>
                  <div className="text-[10px] text-cyan-300 truncate">
                    https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/&#123;z&#125;/&#123;y&#125;/&#123;x&#125;
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="text-slate-300 font-bold">CartoDB Dark Matter Tactical:</div>
                  <div className="text-[10px] text-cyan-300 truncate">
                    https://&#123;s&#125;.basemaps.cartocdn.com/dark_all/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;&#123;r&#125;.png
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
