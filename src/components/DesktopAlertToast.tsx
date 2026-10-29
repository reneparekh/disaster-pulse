import React, { useEffect, useState } from 'react';
import { CalamityEvent } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { resolveDisasterLocalClock } from '../utils/dateUtils';
import { 
  BellRing, 
  X, 
  ExternalLink, 
  ShieldAlert, 
  Activity, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Compass,
  Volume2,
  Timer
} from 'lucide-react';

interface DesktopAlertToastProps {
  alerts: CalamityEvent[];
  onDismiss: (id: string) => void;
  onSelectEvent: (event: CalamityEvent) => void;
  permissionStatus: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
}

export const DesktopAlertToast: React.FC<DesktopAlertToastProps> = ({
  alerts,
  onDismiss,
  onSelectEvent,
  permissionStatus,
  onRequestPermission,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[3000] flex flex-col gap-3 max-w-md w-full pointer-events-none">
      {alerts.map((event) => {
        const meta = CALAMITY_METADATA_LIST.find((m) => m.id === event.type);
        const clockInfo = resolveDisasterLocalClock(
          event.occurredAt || event.updatedAt,
          event.coordinates.lat,
          event.coordinates.lng,
          event.country,
          event.city,
          event.occurrenceTimeLocal
        );

        return (
          <div
            key={event.id}
            className="pointer-events-auto bg-slate-950/95 backdrop-blur-xl border-2 border-rose-500/80 rounded-2xl shadow-2xl p-4 text-slate-100 animate-slide-in relative overflow-hidden ring-4 ring-rose-500/20"
          >
            {/* Top Red Alert Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 animate-bounce text-rose-400" />
                  NEW CRITICAL CALAMITY INGESTED
                </span>
              </div>

              <button
                onClick={() => onDismiss(event.id)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Event Details */}
            <div className="mt-2.5">
              <div className="flex items-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider">
                <span>{meta?.title || event.type}</span>
                <span className="text-slate-500">•</span>
                <span className="text-rose-400 font-black">{event.intensity.value}</span>
              </div>
              <h4 className="text-sm font-black text-slate-100 mt-0.5 leading-snug">
                {event.name}
              </h4>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="font-semibold">{event.city}, {event.country}</span>
              </div>
            </div>

            {/* Disaster Occurrence Clock & Date */}
            <div className="mt-2.5 p-2 rounded-lg bg-slate-900/90 border border-amber-500/30 text-[11px] font-mono space-y-1">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Occurrence Clock:</span>
                  <span className="text-white bg-slate-950 px-1.5 py-0.2 rounded border border-slate-700">
                    {clockInfo.localTime12h}
                  </span>
                </div>
                <span className="text-[10px] text-cyan-400">{clockInfo.timezoneName}</span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>📅 {clockInfo.localDayOfWeek}, {clockInfo.localDateFormatted}</span>
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Timer className="w-3 h-3 text-rose-500 animate-pulse" />
                  {clockInfo.missionClockTPlus}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-slate-900">
              <div className="text-[10px] text-slate-400">
                {permissionStatus === 'granted' ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    ✓ Desktop Alert Dispatched
                  </span>
                ) : permissionStatus === 'default' ? (
                  <button
                    onClick={onRequestPermission}
                    className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    🔔 Click to enable Desktop popups
                  </button>
                ) : (
                  <span className="text-slate-500">Browser alerts restricted</span>
                )}
              </div>

              <button
                onClick={() => {
                  onSelectEvent(event);
                  onDismiss(event.id);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <span>View Calamity</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
