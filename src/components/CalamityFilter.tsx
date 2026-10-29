import React from 'react';
import { CalamityType } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { 
  Flame, 
  Waves, 
  Activity, 
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
  Globe 
} from 'lucide-react';

interface CalamityFilterProps {
  selectedType: CalamityType | 'all';
  onSelectType: (type: CalamityType | 'all') => void;
  countsByType: Record<string, number>;
  totalCount: number;
}

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

export const CalamityFilter: React.FC<CalamityFilterProps> = ({
  selectedType,
  onSelectType,
  countsByType,
  totalCount,
}) => {
  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 shadow-lg">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
            Active Calamity Filters (14 Hazards)
          </span>
          <span className="text-[11px] text-slate-400">
            Select hazard to isolate epicenter & telemetry
          </span>
        </div>
        <button
          onClick={() => onSelectType('all')}
          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
            selectedType === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          View All ({totalCount})
        </button>
      </div>

      {/* Grid of 14 Calamity Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {CALAMITY_METADATA_LIST.map(item => {
          const IconComp = ICON_MAP[item.id] || Activity;
          const count = countsByType[item.id] || 0;
          const isSelected = selectedType === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectType(item.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all border ${
                isSelected
                  ? 'border-amber-400 bg-amber-500/15 text-white shadow-md'
                  : 'border-slate-800/90 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <div 
                className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${item.color}25`, color: item.color }}
              >
                <IconComp className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-[11px]">{item.title}</div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>{count} tracked</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
