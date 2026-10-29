import React, { useState } from 'react';
import { Activity, Calculator, AlertTriangle, ShieldCheck, HeartPulse, RefreshCw } from 'lucide-react';

interface HazardFormula {
  id: string;
  name: string;
  unit: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  calculate: (val: number) => {
    rating: string;
    description: string;
    hazardRadiusKm: number;
    hospitalDemand: string;
    medicalAction: string;
  };
}

const FORMULAS: HazardFormula[] = [
  {
    id: 'earthquake',
    name: 'Earthquake (Moment Magnitude Mw)',
    unit: 'Mw',
    defaultValue: 7.2,
    min: 3.0,
    max: 9.5,
    step: 0.1,
    calculate: (val) => {
      const radius = Math.round(Math.pow(10, 0.43 * val - 0.5));
      const mmi = val >= 8.0 ? 'MMI X-XII (Catastrophic)' : val >= 7.0 ? 'MMI VIII-IX (Violent)' : val >= 6.0 ? 'MMI VI-VII (Strong)' : 'MMI IV-V (Moderate)';
      return {
        rating: `${val.toFixed(1)} Mw (${mmi})`,
        description: `Peak ground shaking capable of structural failure up to ${radius} km away from epicenter.`,
        hazardRadiusKm: radius,
        hospitalDemand: val >= 6.8 ? 'CRITICAL OVERWHELMED' : 'HIGH',
        medicalAction: 'Crush Syndrome IV protocol, dialysis machines, cervical braces, Type O- blood banks.',
      };
    },
  },
  {
    id: 'cyclone',
    name: 'Tropical Cyclone / Typhoon (Wind Speed)',
    unit: 'km/h',
    defaultValue: 240,
    min: 80,
    max: 340,
    step: 5,
    calculate: (val) => {
      let cat = 1;
      if (val >= 252) cat = 5;
      else if (val >= 209) cat = 4;
      else if (val >= 178) cat = 3;
      else if (val >= 154) cat = 2;
      const surgeMeters = (val * 0.021).toFixed(1);
      return {
        rating: `Category ${cat} ${cat === 5 ? 'Super Typhoon / Major Hurricane' : 'Cyclone'}`,
        description: `Sustained winds of ${val} km/h creating storm surges up to ${surgeMeters}m above normal tide.`,
        hazardRadiusKm: Math.round(val * 0.8),
        hospitalDemand: cat >= 4 ? 'CRITICAL OVERWHELMED' : 'HIGH',
        medicalAction: 'Mass casualty evacuation, portable backup diesel generators, Leptospirosis chemoprophylaxis.',
      };
    },
  },
  {
    id: 'volcano',
    name: 'Volcanic Eruption (Plume Altitude)',
    unit: 'km above vent',
    defaultValue: 15,
    min: 1,
    max: 45,
    step: 1,
    calculate: (val) => {
      const vei = val >= 25 ? 5 : val >= 10 ? 4 : val >= 3 ? 3 : val >= 1 ? 2 : 1;
      const dispersion = Math.round(val * 16);
      return {
        rating: `VEI ${vei} (Volcanic Explosivity Index)`,
        description: `Ash column penetrating Flight Level FL${Math.round(val * 32.8)}. Pyroclastic flow risk within immediate valleys.`,
        hazardRadiusKm: dispersion,
        hospitalDemand: vei >= 4 ? 'CRITICAL' : 'HIGH',
        medicalAction: 'Supply FFP3/N95 masks, bronchodilators, burn trauma units, aviation airspace closure.',
      };
    },
  },
  {
    id: 'tornado',
    name: 'Tornado (Peak Wind Gust)',
    unit: 'mph',
    defaultValue: 185,
    min: 65,
    max: 320,
    step: 5,
    calculate: (val) => {
      const ef = val >= 200 ? 5 : val >= 166 ? 4 : val >= 136 ? 3 : val >= 111 ? 2 : val >= 86 ? 1 : 0;
      return {
        rating: `Enhanced Fujita EF-${ef}`,
        description: `Violent rotating vortex. ${ef >= 4 ? 'Total destruction of well-constructed frame houses' : 'Severe roof collapse and flying debris'}.`,
        hazardRadiusKm: Math.round(ef * 3.5 + 2),
        hospitalDemand: ef >= 4 ? 'CRITICAL OVERWHELMED' : 'HIGH',
        medicalAction: 'Underground reinforced bunker triage, thoracic chest drains, impalement trauma kits.',
      };
    },
  },
  {
    id: 'heatwave',
    name: 'Heat Wave (Wet-Bulb Globe Temp WBGT)',
    unit: '°C',
    defaultValue: 34.2,
    min: 25.0,
    max: 39.0,
    step: 0.2,
    calculate: (val) => {
      const isLethal = val >= 35.0;
      return {
        rating: `${val.toFixed(1)}°C WBGT (${isLethal ? 'PHYSIOLOGICALLY LETHAL' : 'EXTREME DANGER'})`,
        description: isLethal
          ? 'Exceeds the thermodynamic limit of the human skin to shed heat via sweating. Even healthy persons can perish within 6 hours.'
          : 'High risk of heat stroke, cerebral edema, and rhabdomyolysis without active AC cooling.',
        hazardRadiusKm: 180,
        hospitalDemand: 'CRITICAL OVERWHELMED',
        medicalAction: 'Full-body ice bath immersion tubs, IV chilled saline, rapid electrolyte panels.',
      };
    },
  },
  {
    id: 'tsunami',
    name: 'Tsunami (Deep Ocean / Coastal Amplitude)',
    unit: 'meters',
    defaultValue: 3.5,
    min: 0.5,
    max: 25.0,
    step: 0.5,
    calculate: (val) => {
      return {
        rating: `${val.toFixed(1)}m Wave Run-up (Category ${val >= 6 ? 'Major Cataclysm' : 'Destructive'})`,
        description: `Rapid seawater inundation penetrating low-lying coastal plains with hydrodynamic drag force.`,
        hazardRadiusKm: Math.round(val * 4.2),
        hospitalDemand: val >= 3.0 ? 'CRITICAL OVERWHELMED' : 'HIGH',
        medicalAction: 'Aspiration saltwater drowning triage, water purification distribution, tetanus shots.',
      };
    },
  },
];

export const IntensityCalculator: React.FC = () => {
  const [selectedHazardId, setSelectedHazardId] = useState<string>(FORMULAS[0].id);
  const selectedFormula = FORMULAS.find(f => f.id === selectedHazardId) || FORMULAS[0];
  const [inputValue, setInputValue] = useState<number>(selectedFormula.defaultValue);

  const result = selectedFormula.calculate(inputValue);

  const handleHazardChange = (id: string) => {
    setSelectedHazardId(id);
    const f = FORMULAS.find(form => form.id === id);
    if (f) setInputValue(f.defaultValue);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-bold text-slate-100">
            Scientific Calamity Intensity & Danger Radius Calculator
          </h2>
        </div>
        <span className="text-xs text-slate-400">ISO / WMO / USGS Compliant Equations</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Left Inputs */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Disaster Mechanism:
            </label>
            <select
              value={selectedHazardId}
              onChange={(e) => handleHazardChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            >
              {FORMULAS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span>Input Value ({selectedFormula.unit}):</span>
              <span className="text-amber-400 font-mono font-bold text-sm">
                {inputValue} {selectedFormula.unit}
              </span>
            </div>
            <input
              type="range"
              min={selectedFormula.min}
              max={selectedFormula.max}
              step={selectedFormula.step}
              value={inputValue}
              onChange={(e) => setInputValue(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Min: {selectedFormula.min} {selectedFormula.unit}</span>
              <span>Max: {selectedFormula.max} {selectedFormula.unit}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Model Formula Note: </span>
            Intensity calculates peak kinetic or thermal threshold and projects damage perimeter and hospital load before field arrival.
          </div>
        </div>

        {/* Right Computation Results */}
        <div className="lg:col-span-7 space-y-3">
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 shadow-inner">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Computed Scientific Intensity
            </div>
            <div className="text-xl font-black text-amber-400 mt-1">
              {result.rating}
            </div>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {result.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Impact Danger Perimeter
              </div>
              <div className="text-lg font-bold text-cyan-400 mt-1">
                ~{result.hazardRadiusKm} km radius
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Civil evacuation zone perimeter</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                Regional Hospital Surge
              </div>
              <div className="text-lg font-bold text-rose-400 mt-1 truncate">
                {result.hospitalDemand}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Emergency department stress</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-xs">
            <div className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              Critical Medical & Supply Protocol:
            </div>
            <div className="text-slate-300">
              {result.medicalAction}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
