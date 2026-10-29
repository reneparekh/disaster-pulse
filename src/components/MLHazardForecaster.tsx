import React, { useState, useMemo } from 'react';
import { CalamityEvent, CalamityType } from '../types/disaster';
import { 
  ForecastHorizon, 
  PredictiveHotspot, 
  ProbabilityTier 
} from '../types/mlForecasting';
import { 
  generateMLHazardHotspots, 
  filterPredictiveHotspots, 
  computeForecastSummary, 
  getMLModelEvaluationMetrics 
} from '../services/mlHazardForecastService';
import { 
  Brain, 
  Sparkles, 
  SlidersHorizontal, 
  MapPin, 
  ShieldAlert, 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Users, 
  Layers, 
  CheckCircle2, 
  Compass, 
  Eye, 
  RefreshCw, 
  Maximize2, 
  ChevronRight, 
  Info, 
  Radar, 
  Cpu, 
  BarChart2, 
  Radio 
} from 'lucide-react';

interface MLHazardForecasterProps {
  events: CalamityEvent[];
  onInspectHotspotOnMap?: (hotspot: PredictiveHotspot) => void;
}

export const MLHazardForecaster: React.FC<MLHazardForecasterProps> = ({
  events,
  onInspectHotspotOnMap,
}) => {
  const [horizon, setHorizon] = useState<ForecastHorizon>('72h');
  const [minProbability, setMinProbability] = useState<number>(50);
  const [selectedCategory, setSelectedCategory] = useState<CalamityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);

  // Model Evaluation Benchmark Metrics
  const modelMetrics = useMemo(() => getMLModelEvaluationMetrics(), []);

  // Compute all hotspots for active horizon
  const allHotspots = useMemo(() => {
    return generateMLHazardHotspots(events, horizon);
  }, [events, horizon]);

  // Filtered hotspots based on user controls
  const filteredHotspots = useMemo(() => {
    let result = filterPredictiveHotspots(allHotspots, minProbability, horizon, selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.region.toLowerCase().includes(q) ||
          h.country.toLowerCase().includes(q) ||
          h.hazardType.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allHotspots, minProbability, horizon, selectedCategory, searchQuery]);

  // High-level forecast summary
  const summary = useMemo(() => computeForecastSummary(filteredHotspots), [filteredHotspots]);

  // Selected hotspot for deep dive
  const activeDetailHotspot = useMemo(() => {
    if (selectedHotspotId) {
      const found = filteredHotspots.find((h) => h.id === selectedHotspotId);
      if (found) return found;
    }
    return filteredHotspots.length > 0 ? filteredHotspots[0] : null;
  }, [selectedHotspotId, filteredHotspots]);

  // Helper styling for probability tiers
  const getTierBadge = (tier: ProbabilityTier, prob: number) => {
    switch (tier) {
      case 'VERY_HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            {prob}% Very High Probability
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {prob}% High Probability
          </span>
        );
      case 'ELEVATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
            {prob}% Elevated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            {prob}% Moderate
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-inner">
                <Brain className="w-6 h-6 animate-pulse" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-xs font-bold tracking-wider uppercase">
                Machine Learning Spatio-Temporal Core
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Predictive Hazard Hotspot Forecaster
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Ensemble Random Forest and spatio-temporal Poisson kernel density modeling trained on 14,280 historical disaster catalogs. 
              Synthesizes fault convergence rates, seasonal atmospheric oscillations, and real-time precursor anomalies to forecast emerging calamity zones.
            </p>
          </div>

          {/* Model Status Card */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-purple-500/30 font-mono text-xs text-slate-300 shrink-0 shadow-lg">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Model Accuracy (AUC-ROC)</div>
                <div className="text-base font-black text-emerald-400">{modelMetrics.aucRoc.toFixed(3)}</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-800" />
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Grid Resolution</div>
                <div className="text-base font-black text-cyan-300">{modelMetrics.spatialResolutionKm} km</div>
              </div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-800" />
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Training Events</div>
                <div className="text-base font-black text-amber-300">{modelMetrics.trainingHistoricalEventsCount.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Forecasted Hotspots</span>
            <Radar className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.totalHotspots}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Horizon: <strong className="text-purple-300 font-mono">{horizon.toUpperCase()}</strong>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Very High / Critical (≥85%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">{summary.veryHighCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            High Severity: <strong className="text-amber-400 font-mono">{summary.highCount}</strong>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Projected Population Exposure</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-cyan-300 font-mono">
            {(summary.totalPopulationAtRisk / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Civil defense evacuation zones</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Mean Predictive Propensity</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {summary.averageProbability}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Brier Calibration: <strong className="text-slate-300 font-mono">{modelMetrics.brierScore}</strong>
          </div>
        </div>
      </div>

      {/* Control Ribbons: Horizon, Probability Slider, & Category Filter */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Horizon Selection Buttons */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Forecast Horizon:
            </span>
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              {(['24h', '72h', '7d', '30d'] as ForecastHorizon[]).map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1 rounded font-mono font-bold transition-all cursor-pointer ${
                    horizon === h
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h === '24h' ? '24 Hours' : h === '72h' ? '72 Hours' : h === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Probability Cutoff Slider */}
          <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-800">
            <span className="font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              Min Probability: <strong className="text-cyan-300 font-mono">{minProbability}%</strong>
            </span>
            <input
              type="range"
              min="40"
              max="90"
              step="5"
              value={minProbability}
              onChange={(e) => setMinProbability(Number(e.target.value))}
              className="w-28 sm:w-36 accent-purple-500 cursor-pointer"
            />
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search hotspot or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-slate-200 placeholder-slate-500 focus:outline-none text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Hotspot List (Left 7 cols) + Selected Hotspot Deep Dive (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Hotspot Matrix */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
            <span>IDENTIFIED PROBABILITY HOTSPOTS ({filteredHotspots.length})</span>
            <span className="text-slate-500 font-normal">Ranked by propensity score</span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredHotspots.length > 0 ? (
              filteredHotspots.map((hotspot) => {
                const isSelected = activeDetailHotspot?.id === hotspot.id;
                return (
                  <div
                    key={hotspot.id}
                    onClick={() => setSelectedHotspotId(hotspot.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-950/60 to-slate-900 border-purple-500 shadow-xl'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                            {hotspot.country} • {hotspot.region}
                          </span>
                          {getTierBadge(hotspot.probabilityTier, hotspot.probability)}
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">
                          {hotspot.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {hotspot.geomorphicSetting}
                        </p>
                      </div>

                      {/* Probability Score Pill */}
                      <div className="text-right shrink-0">
                        <div className="text-xl font-black font-mono text-purple-300">
                          {hotspot.probability}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          95% CI: [{hotspot.confidenceInterval.low}-{hotspot.confidenceInterval.high}%]
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar of Probability */}
                    <div className="mt-2.5 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          hotspot.probability >= 85
                            ? 'bg-rose-500'
                            : hotspot.probability >= 70
                            ? 'bg-amber-500'
                            : 'bg-cyan-500'
                        }`}
                        style={{ width: `${hotspot.probability}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                      <span>👥 Risk Pop: {(hotspot.populationAtRisk / 1000).toFixed(0)}k</span>
                      <span>🔄 Return Period: {hotspot.meanRecurrenceYears} yrs</span>
                      <span className="text-purple-400 font-semibold flex items-center gap-1">
                        Details <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 space-y-2">
                <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-300">No hotspots meet the filter threshold</p>
                <p className="text-xs text-slate-500">Lower the minimum probability slider or reset filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Detailed Deep Dive on Selected Hotspot */}
        <div className="lg:col-span-5 xl:col-span-5">
          {activeDetailHotspot ? (
            <div className="p-4 sm:p-5 rounded-xl bg-slate-900 border border-purple-500/40 shadow-2xl space-y-4 sticky top-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>{activeDetailHotspot.coordinates.lat.toFixed(4)}°N, {activeDetailHotspot.coordinates.lng.toFixed(4)}°E</span>
                  </div>
                  <h2 className="text-base font-bold text-white mt-1">
                    {activeDetailHotspot.name}
                  </h2>
                  <div className="text-xs text-slate-400">
                    {activeDetailHotspot.region}, {activeDetailHotspot.country}
                  </div>
                </div>

                {onInspectHotspotOnMap && (
                  <button
                    onClick={() => onInspectHotspotOnMap(activeDetailHotspot)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer shrink-0"
                    title="Plot and zoom to this predictive marker on the satellite map"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Map View</span>
                  </button>
                )}
              </div>

              {/* Probability & Horizon Status */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Predictive Probability</div>
                  <div className="text-2xl font-black font-mono text-purple-300">
                    {activeDetailHotspot.probability}%
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    95% Credible Interval: [{activeDetailHotspot.confidenceInterval.low}% - {activeDetailHotspot.confidenceInterval.high}%]
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Impact Radius</div>
                  <div className="text-base font-bold text-cyan-300 font-mono">
                    ±{activeDetailHotspot.estimatedImpactRadiusKm} km
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {activeDetailHotspot.populationAtRisk.toLocaleString()} at risk
                  </div>
                </div>
              </div>

              {/* Explainable AI: Feature Importance Weights */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  <span>ML Feature Importance & Drivers</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {activeDetailHotspot.predictiveFactors.map((factor, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-200">{factor.factor}</span>
                        <span className="font-mono text-purple-300">+{factor.weight}%</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        {factor.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Precursor Telemetry */}
              {activeDetailHotspot.satellitePrecursorSignal && (
                <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/40 text-xs text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Satellite & Sensor Precursor Signal</span>
                  </div>
                  <p className="text-[11px] opacity-90">
                    {activeDetailHotspot.satellitePrecursorSignal}
                  </p>
                </div>
              )}

              {/* Recommended Action Protocol */}
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-xs text-rose-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Early Action Mitigation Protocol</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {activeDetailHotspot.recommendedPreemptiveAction}
                </p>
              </div>

              {/* Historical Precedent Card */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
                <div className="flex items-center justify-between">
                  <span>Last Historical Event:</span>
                  <strong className="text-slate-200">{activeDetailHotspot.lastHistoricalOccurrence}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Catalogued Precedents:</span>
                  <strong className="text-slate-200">{activeDetailHotspot.historicalPrecedentsCount} incidents</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mean Return Period:</span>
                  <strong className="text-slate-200">{activeDetailHotspot.meanRecurrenceYears} years</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
              <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p>Select a hotspot to view deep predictive telemetry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
