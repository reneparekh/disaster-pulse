import React, { useState, useEffect } from 'react';
import { Mountain, Satellite, Moon, Check, Sparkles, Info, X, ChevronRight, Eye } from 'lucide-react';
import { CalamityType } from '../types/disaster';

export type MapLayerKey = 'terrain' | 'satellite' | 'dark';

export interface MapLayerOption {
  key: MapLayerKey;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  provider: string;
  maxZoom: number;
  tagline: string;
  description: string;
  recommendedDisasters: {
    types: CalamityType[];
    label: string;
    reason: string;
  };
  visibilityBenefits: string[];
}

export const MAP_LAYER_CONFIGS: Record<MapLayerKey, MapLayerOption> = {
  terrain: {
    key: 'terrain',
    label: 'Topographic Relief & Elevation',
    shortLabel: 'Terrain',
    icon: Mountain,
    emoji: '⛰️',
    provider: 'OpenTopoMap / SRTM Data',
    maxZoom: 17,
    tagline: 'Best for Inundation, Slope Instability & Evacuation Pathways',
    description: 'Detailed contour elevation lines, hillshade models, mountain ridge passes, and river valley drainage channels.',
    recommendedDisasters: {
      types: ['flood', 'tsunami', 'landslide', 'avalanche', 'volcano'],
      label: 'Floods, Landslides & Lahars',
      reason: 'Elevation contours clearly delineate low-lying flood plains, steep slope runoff risks, and natural evacuation ridges.',
    },
    visibilityBenefits: [
      'Visualizes elevation contours (5m/20m relief intervals) to pinpoint flood accumulation zones',
      'Highlights mountain ridges, cliffs, and valley choke points for evacuation planning',
      'Provides high visibility for landslide and mudslide trajectory assessment',
    ],
  },
  satellite: {
    key: 'satellite',
    label: 'Satellite Reconnaissance',
    shortLabel: 'Satellite',
    icon: Satellite,
    emoji: '🛰️',
    provider: 'Esri World Imagery / USGS',
    maxZoom: 18,
    tagline: 'Best for Wildfire Burn Scars, Canopy Loss & Storm Damage',
    description: 'High-resolution global optical satellite imagery capturing actual physical terrain, canopy density, and infrastructure.',
    recommendedDisasters: {
      types: ['wildfire', 'cyclone', 'tornado', 'drought', 'extreme_temp'],
      label: 'Wildfires, Storm Surges & Cyclones',
      reason: 'True-color orbital photography reveals actual vegetation fuel beds, burn scar perimeters, and coastline erosion.',
    },
    visibilityBenefits: [
      'Real orbital photographic verification of land cover, forest canopy, and burn perimeters',
      'Exposes building footprints, transport corridors, and bridge access infrastructure',
      'Enhances coastal disaster visibility (storm surge inundation, seawall breaches)',
    ],
  },
  dark: {
    key: 'dark',
    label: 'Dark Tactical Nocturnal Canvas',
    shortLabel: 'Dark Mode',
    icon: Moon,
    emoji: '🌑',
    provider: 'CartoDB Dark Matter / OSM',
    maxZoom: 19,
    tagline: 'Best for Night Rescue, Thermal Radiance & SOS Pin Contrast',
    description: 'High-contrast nocturnal operations canvas optimized for bright hazard beacons, NASA FIRMS hotspots, and night rescue.',
    recommendedDisasters: {
      types: ['earthquake', 'virus', 'pandemic', 'blizzard'],
      label: 'Night Operations & Thermal Radiance',
      reason: 'Deep nocturnal canvas provides maximum chromatic contrast for glowing hazard heatmaps, FIRMS hotspots, and 50km hazard circles.',
    },
    visibilityBenefits: [
      'Maximum optical contrast for glowing severity halos, 50km danger radii, and FIRMS hotspots',
      'Zero night-blindness glare for field search-and-rescue teams during nocturnal operations',
      'Low power draw on AMOLED devices, pairing seamlessly with Field Power Saver mode',
    ],
  },
};

export interface MapLayersProps {
  activeLayer: MapLayerKey;
  onSelectLayer: (layer: MapLayerKey) => void;
  currentDisasterType?: CalamityType | string | null;
  isPowerSaverMode?: boolean;
  className?: string;
  showDetailsModal?: boolean;
  onCloseDetailsModal?: () => void;
}

/**
 * MapLayers Component
 * Dedicated map layer control allowing first responders and GIS analysts to switch
 * between Topographic Terrain, Satellite Reconnaissance, and Dark Tactical tile layers,
 * with context-aware disaster visibility intelligence.
 */
export const MapLayers: React.FC<MapLayersProps> = ({
  activeLayer,
  onSelectLayer,
  currentDisasterType,
  isPowerSaverMode = false,
  className = '',
}) => {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Determine if a specific layer is recommended based on the active calamity type
  const getRecommendedLayer = (): MapLayerKey | null => {
    if (!currentDisasterType) return null;
    const typeStr = currentDisasterType.toLowerCase();
    for (const [key, config] of Object.entries(MAP_LAYER_CONFIGS)) {
      if (config.recommendedDisasters.types.some(t => t.toLowerCase() === typeStr)) {
        return key as MapLayerKey;
      }
    }
    return null;
  };

  const recommendedLayer = getRecommendedLayer();

  // Keyboard shortcut listener for rapid layer switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === '1') onSelectLayer('terrain');
      if (e.key === '2') onSelectLayer('satellite');
      if (e.key === '3') onSelectLayer('dark');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectLayer]);

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Segmented Quick-Switch Control Bar */}
      <div className={`flex items-center gap-1 p-1 rounded-xl shadow-2xl backdrop-blur-xl border ${
        isPowerSaverMode
          ? 'bg-black/95 border-slate-900'
          : 'bg-slate-950/90 border-slate-800/90'
      }`}>
        {/* Label Prefix / Guide Trigger */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className={`px-2 py-1 flex items-center gap-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            isGuideOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Map Layers Intelligence: Learn how Terrain, Satellite, and Dark Mode improve visibility for specific disaster conditions"
          aria-label="Map Layers Guide"
        >
          <Eye className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline font-mono tracking-wider text-[11px] uppercase">Base Layer:</span>
        </button>

        {/* Layer Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800/80">
          {(['terrain', 'satellite', 'dark'] as const).map((key, idx) => {
            const config = MAP_LAYER_CONFIGS[key];
            const isActive = activeLayer === key;
            const isRec = recommendedLayer === key;
            const Icon = config.icon;

            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectLayer(key)}
                className={`relative group flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-950/40 ring-1 ring-amber-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={`${config.label} (${idx + 1}): ${config.tagline}${isRec ? ' ★ RECOMMENDED FOR ACTIVE DISASTER' : ''}`}
                aria-pressed={isActive}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span className="text-[11px] font-sans tracking-tight">{config.shortLabel}</span>

                {/* Hotkey hint on hover */}
                <span className={`text-[9px] font-mono opacity-60 hidden md:inline ml-0.5 ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                  [{idx + 1}]
                </span>

                {/* Recommended Star Indicator */}
                {isRec && !isActive && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-slate-950"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Info Guide Toggle Button */}
        <button
          type="button"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isGuideOpen
              ? 'bg-amber-400 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Open Map Layer Visibility & Disaster Conditions Guide"
          aria-label="Map Layer Visibility Guide"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover / Modal: Map Layer Visibility & Disaster Conditions Guide */}
      {isGuideOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] max-h-[80vh] overflow-y-auto bg-slate-950/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-4 shadow-2xl z-[1500] text-xs space-y-4 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-white text-sm">Map Layers Visibility Guide</h4>
                <p className="text-[10px] text-slate-400">Tailored tile layers for extreme disaster environments</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGuideOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Disaster Recommendation Banner */}
          {currentDisasterType && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] flex items-center gap-1 font-mono">
                  <span>🎯</span> Active Condition Recommendation
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold capitalize">
                  {currentDisasterType}
                </span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {recommendedLayer
                  ? `For ${currentDisasterType.toUpperCase()} disasters, ${MAP_LAYER_CONFIGS[recommendedLayer].shortLabel} mode provides maximum visibility. ${MAP_LAYER_CONFIGS[recommendedLayer].recommendedDisasters.reason}`
                  : `Select between Terrain, Satellite, and Dark Mode to optimize map readability for ${currentDisasterType}.`}
              </p>
            </div>
          )}

          {/* Layer Cards */}
          <div className="space-y-2.5">
            {(['terrain', 'satellite', 'dark'] as const).map((key) => {
              const config = MAP_LAYER_CONFIGS[key];
              const isSelected = activeLayer === key;
              const isRec = recommendedLayer === key;
              const Icon = config.icon;

              return (
                <div
                  key={key}
                  onClick={() => onSelectLayer(key)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-100 text-xs">
                          <span>{config.emoji}</span>
                          <span>{config.label}</span>
                          {isRec && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                              Best Fit
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {config.provider} • Max Zoom: {config.maxZoom}x
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black">
                          <Check className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLayer(key);
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tagline */}
                  <div className="text-[11px] font-semibold text-amber-300/90 italic">
                    "{config.tagline}"
                  </div>

                  {/* Visibility Benefits */}
                  <div className="pt-1 border-t border-slate-800/80 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Situational Visibility Benefits:
                    </div>
                    <ul className="space-y-0.5 text-[10px] text-slate-300 list-disc list-inside">
                      {config.visibilityBenefits.map((benefit, bIdx) => (
                        <li key={bIdx} className="leading-tight">{benefit}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended Disasters Badge Row */}
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Optimized For:</span>
                    <span className="font-semibold text-slate-200">{config.recommendedDisasters.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Hotkeys Tip */}
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between font-mono">
            <span>⚡ Keyboard shortcuts:</span>
            <span className="text-amber-400 font-bold">[1] Terrain • [2] Satellite • [3] Dark</span>
          </div>
        </div>
      )}
    </div>
  );
};
