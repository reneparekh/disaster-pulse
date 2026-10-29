import React, { useState, useEffect } from 'react';
import { CalamityEvent } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { formatIncidentDateTime, formatIncidentUTC, formatTimeElapsed } from '../utils/dateUtils';
import { DisasterOccurrenceClock } from './DisasterOccurrenceClock';
import { exportDisasterReportPDF } from '../utils/pdfExportService';
import { copyToClipboard } from '../utils/clipboardUtils';
import { 
  X, 
  MapPin, 
  ExternalLink, 
  AlertTriangle, 
  Activity, 
  Satellite, 
  HeartPulse, 
  Hospital, 
  ShieldAlert, 
  Compass, 
  Radio, 
  Share2, 
  Check, 
  PhoneCall, 
  Navigation,
  Flame, 
  Waves, 
  Wind, 
  Droplets,
  Package,
  Calendar,
  Clock,
  Timer,
  FileDown,
  Loader2,
  FileJson,
  FileCode
} from 'lucide-react';
import { generateDisasterGeoJSON, triggerFileDownload } from '../utils/gisExportService';

interface DisasterDetailModalProps {
  event: CalamityEvent | null;
  onClose: () => void;
}

export const DisasterDetailModal: React.FC<DisasterDetailModalProps> = ({
  event,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [exportedJsonSuccess, setExportedJsonSuccess] = useState(false);

  // Close on Escape key press (keyboard & mobile back navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!event) return null;

  const handleExportJSON = async () => {
    if (!event) return;
    try {
      setIsExportingJson(true);
      await new Promise(r => setTimeout(r, 120));
      
      const payload = {
        meta: {
          system: "DISASTER PULSE Global Disaster Intelligence System",
          exportedAtUTC: new Date().toISOString(),
          formatVersion: "1.0",
          schema: "disaster-event-offline-report",
          classification: "PUBLIC_SAFETY_ADVISORY"
        },
        disasterEvent: event
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeCity = (event.city || 'global').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const safeType = event.type.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.href = url;
      link.download = `crisiscommand-${safeType}-${safeCity}-${event.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportedJsonSuccess(true);
      setTimeout(() => setExportedJsonSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export disaster event JSON:', err);
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await new Promise(r => setTimeout(r, 150));
      exportDisasterReportPDF(event);
      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export PDF summary:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const [exportedGeoJsonSuccess, setExportedGeoJsonSuccess] = useState(false);

  const handleExportGeoJSON = () => {
    if (!event) return;
    try {
      const geojson = generateDisasterGeoJSON([event]);
      triggerFileDownload(
        geojson,
        `${event.id}_spatial_layers.geojson`,
        'application/geo+json'
      );
      setExportedGeoJsonSuccess(true);
      setTimeout(() => setExportedGeoJsonSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to export GeoJSON:', err);
    }
  };

  const meta = CALAMITY_METADATA_LIST.find(m => m.id === event.type);
  const googleMapsUrl = `https://www.google.com/maps?q=${event.coordinates.lat},${event.coordinates.lng}`;
  const elapsed = event.occurredAt ? formatTimeElapsed(event.occurredAt) : '';
  const utcDateStr = event.occurredAt ? formatIncidentUTC(event.occurredAt) : new Date(event.updatedAt).toUTCString();

  const handleCopyAdvisory = async () => {
    const text = `
[EMERGENCY CIVIL DEFENSE ADVISORY - GLOBAL DISASTER COMMAND]
Event: ${event.name}
Hazard Type: ${meta?.title || event.type}
Actual Occurred: ${utcDateStr} (${event.occurrenceTimeLocal || ''})
Affected Location: ${event.city}, ${event.country}
Coordinates: ${event.coordinates.lat}, ${event.coordinates.lng}
Google Maps: ${googleMapsUrl}
Intensity: ${event.intensity.value} (${event.intensity.scaleName})
Public Action: ${event.publicAdvisory.immediateAction}
Evacuation Zone: ${event.publicAdvisory.evacuationZoneKm} km radius
Emergency Dispatch: ${event.publicAdvisory.emergencyContact}
    `.trim();

    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disaster-modal-title"
    >
      <div 
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="relative p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shrink-0"
                style={{ backgroundColor: `${meta?.color || '#f59e0b'}20`, color: meta?.color || '#f59e0b' }}
              >
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    event.severity === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    {event.severity} ALERT
                  </span>
                  {event.isLiveFeed && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      LIVE {event.liveFeedSource || 'STREAM'}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">ID: {event.id}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100 mt-1">{event.name}</h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJSON}
                disabled={isExportingJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-emerald-500/50"
                title="Export current event data as a downloadable JSON file for offline reporting"
              >
                {isExportingJson ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedJsonSuccess ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <FileJson className="w-3.5 h-3.5" />
                )}
                <span>{isExportingJson ? 'Exporting...' : exportedJsonSuccess ? 'JSON Downloaded!' : 'Export JSON'}</span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-rose-500/50"
                title="Export downloadable PDF disaster summary report"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>{isExporting ? 'Generating PDF...' : exportedSuccess ? 'PDF Downloaded!' : 'Export PDF'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Location Bar with Direct Google Maps Link */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold">{event.city}, {event.country}</span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-xs text-amber-400">
                {event.coordinates.lat.toFixed(5)}°N, {event.coordinates.lng.toFixed(5)}°E
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('disaster:locate', { detail: event }));
                  setTimeout(() => {
                    const mapEl = document.getElementById('disaster-map-container');
                    if (mapEl) {
                      mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }, 50);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                title={`Close modal and center disaster map on ${event.name}`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Locate on Map</span>
              </button>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md"
              >
                <Compass className="w-3.5 h-3.5" />
                Live Google Maps Pin
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Content Body: Tabs / Grid Sections */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Section 0: Disaster Occurrence Chronometer & Local Wall Clock */}
          <DisasterOccurrenceClock event={event} />

          {/* Section 1: Scientific Intensity Measurement */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-400" />
                Scientific Calamity Intensity Measurement
              </h3>
              <span className="text-xs text-slate-400 font-mono">{event.intensity.scaleName}</span>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">Measured Value & Unit</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{event.intensity.value}</div>
                <div className="text-xs text-slate-300 mt-1">{event.intensity.interpretation}</div>
              </div>

              {event.intensity.secondaryMetric && (
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-xs text-slate-400">{event.intensity.secondaryMetric.label}</div>
                  <div className="text-xl font-bold text-cyan-400 mt-1">{event.intensity.secondaryMetric.value}</div>
                  <div className="text-xs text-slate-400 mt-1">Real-time secondary sensor validation</div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Medical Emergency & Healthcare Vulnerability */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-rose-400 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-400" />
                Medical Emergency & Hospital Vulnerability Status
              </h3>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                event.medicalEmergency.hospitalPressure === 'CRITICAL_OVERWHELMED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                Hospital Demand: {event.medicalEmergency.hospitalPressure.replace('_', ' ')}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Impacted Population:</span>
                <div className="text-base font-bold text-slate-100 mt-0.5">
                  {event.medicalEmergency.affectedPopulation.toLocaleString()} citizens
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Condition / Pathology:</span>
                <div className="text-sm font-semibold text-rose-300 mt-0.5">
                  {event.medicalEmergency.pathogenOrCondition || 'Blunt polytrauma & exposure'}
                </div>
              </div>
            </div>

            {/* Civil Defense Emergency Supplies & Official Logistics */}
            {event.medicalEmergency?.bloodAndMedicalSuppliesNeeded && event.medicalEmergency.bloodAndMedicalSuppliesNeeded.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                  Official Civil Defense Logistics & Triage Needs:
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.medicalEmergency.bloodAndMedicalSuppliesNeeded.map((sup, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs font-medium"
                    >
                      + {sup}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-2 text-[10px] text-slate-500 italic">
              Official Notice: Health and evacuation advisories are transcribed directly from civil defense records. No automated medical prescriptions are provided.
            </div>
          </div>

          {/* Section 3: Satellite Telemetry */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <h3 className="text-xs uppercase tracking-wider font-bold text-cyan-400 flex items-center gap-1.5 mb-3">
              <Satellite className="w-4 h-4 text-cyan-400" />
              Orbital Satellite Telemetry & Verification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Satellite Platform</span>
                <div className="font-semibold text-slate-200 mt-0.5">{event.satelliteTelemetry.satellite}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Sensor Payload</span>
                <div className="font-semibold text-slate-200 mt-0.5">{event.satelliteTelemetry.sensor}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Recon Confidence</span>
                <div className="font-bold text-emerald-400 mt-0.5">{event.satelliteTelemetry.confidence}% Verified</div>
              </div>
            </div>
            {event.satelliteTelemetry.thermalAnomalyOrRad && (
              <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-900/60 p-2 rounded border border-slate-800">
                Sensor Observation: {event.satelliteTelemetry.thermalAnomalyOrRad}
              </div>
            )}
          </div>

          {/* Section 4: Public Civil Defense Advisory */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Citizen Public Advisory & Evacuation Protocol
              </h3>
              <span className="text-xs font-mono text-amber-300">
                Exclusion Perimeter: {event.publicAdvisory.evacuationZoneKm} km
              </span>
            </div>

            <div className="mt-2 text-sm font-bold text-slate-100">
              {event.publicAdvisory.headline}
            </div>
            <div className="mt-1 text-xs text-slate-300">
              {event.publicAdvisory.immediateAction}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-500/20 text-xs">
              <div className="flex items-center gap-1.5 text-amber-300">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Hotline: <strong>{event.publicAdvisory.emergencyContact}</strong></span>
              </div>

              <button
                onClick={handleCopyAdvisory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                {copied ? 'Advisory Copied' : 'Copy Public Advisory'}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Telemetric Source: {event.source} • Synced: {new Date(event.updatedAt).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleExportJSON}
              disabled={isExportingJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-emerald-500/40"
              title="Download event data as structured JSON file for offline reporting"
            >
              {isExportingJson ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : exportedJsonSuccess ? (
                <Check className="w-3.5 h-3.5 text-white" />
              ) : (
                <FileJson className="w-3.5 h-3.5" />
              )}
              <span>{isExportingJson ? 'Exporting JSON...' : exportedJsonSuccess ? 'JSON Downloaded!' : 'Export JSON (Offline)'}</span>
            </button>

            <button
              onClick={handleExportGeoJSON}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Download spatial features and evacuation buffer as OGC GeoJSON for QGIS / ArcGIS"
            >
              {exportedGeoJsonSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{exportedGeoJsonSuccess ? 'GeoJSON Saved!' : 'Export GeoJSON (GIS)'}</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer border border-rose-500/40"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : exportedSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Generating PDF...' : exportedSuccess ? 'PDF Downloaded!' : 'Export PDF Summary Report'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close Diagnostics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
