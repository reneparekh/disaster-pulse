import { Layers, Maximize2, Minimize2, Crosshair, Filter } from 'lucide-react';
import { useState } from 'react';

interface MapControlsProps {
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  onCenterOnUser: () => void;
  onToggleLayers: () => void;
  onToggleClustering: () => void;
  clusteringEnabled: boolean;
}

export default function MapControls({
  onToggleFullscreen,
  isFullscreen,
  onCenterOnUser,
  onToggleLayers,
  onToggleClustering,
  clusteringEnabled,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={onCenterOnUser}
        className="p-2.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
        title="Center on my location"
      >
        <Crosshair className="w-5 h-5 text-slate-300" />
      </button>
      
      <button
        onClick={onToggleClustering}
        className={`p-2.5 backdrop-blur-xl border rounded-lg shadow-2xl transition-all hover:scale-105 ${
          clusteringEnabled
            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
            : 'bg-slate-900/95 border-slate-700/50 text-slate-300 hover:bg-slate-800'
        }`}
        title={clusteringEnabled ? 'Disable clustering' : 'Enable clustering'}
      >
        <Filter className="w-5 h-5" />
      </button>
      
      <button
        onClick={onToggleLayers}
        className="p-2.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
        title="Toggle map layers"
      >
        <Layers className="w-5 h-5 text-slate-300" />
      </button>
      
      <button
        onClick={onToggleFullscreen}
        className="p-2.5 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-lg shadow-2xl hover:bg-slate-800 transition-all hover:scale-105"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-5 h-5 text-slate-300" /> : <Maximize2 className="w-5 h-5 text-slate-300" />}
      </button>
    </div>
  );
}
