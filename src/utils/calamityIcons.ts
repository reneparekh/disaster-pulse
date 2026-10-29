import { CalamityType } from '../types/disaster';

export interface CalamityIconConfig {
  color: string;
  emoji: string;
  label: string;
}

export const calamityIconMap: Record<CalamityType, CalamityIconConfig> = {
  volcano: { color: '#ef4444', emoji: '🌋', label: 'Volcano' },
  tsunami: { color: '#06b6d4', emoji: '🌊', label: 'Tsunami' },
  earthquake: { color: '#f97316', emoji: '⚡', label: 'Earthquake' },
  wildfire: { color: '#ea580c', emoji: '🔥', label: 'Wildfire' },
  virus: { color: '#a855f7', emoji: '🦠', label: 'Virus/Pathogen' },
  landslide: { color: '#ca8a04', emoji: '⛰️', label: 'Landslide' },
  avalanche: { color: '#38bdf8', emoji: '❄️', label: 'Avalanche' },
  cyclone: { color: '#3b82f6', emoji: '🌀', label: 'Cyclone' },
  tornado: { color: '#e11d48', emoji: '🌪️', label: 'Tornado' },
  flood: { color: '#2563eb', emoji: '💧', label: 'Flood' },
  drought: { color: '#d97706', emoji: '☀️', label: 'Drought' },
  blizzard: { color: '#94a3b8', emoji: '❄️', label: 'Blizzard' },
  extreme_temp: { color: '#dc2626', emoji: '🌡️', label: 'Extreme Temp' },
  pandemic: { color: '#7c3aed', emoji: '☣️', label: 'Pandemic' },
};

export function getCalamityIconConfig(type: CalamityType): CalamityIconConfig {
  return calamityIconMap[type] || { color: '#64748b', emoji: '⚠️', label: 'Unknown' };
}
