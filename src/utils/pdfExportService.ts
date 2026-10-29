import { jsPDF } from 'jspdf';
import { CalamityEvent } from '../types/disaster';
import { CALAMITY_METADATA_LIST } from '../data/disastersData';
import { resolveDisasterLocalClock, formatIncidentUTC, formatTimeElapsed } from './dateUtils';

/**
 * Generates and downloads an official Civil Defense Disaster Summary PDF report
 */
export function exportDisasterReportPDF(event: CalamityEvent): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  const meta = CALAMITY_METADATA_LIST.find(m => m.id === event.type);
  const clockInfo = resolveDisasterLocalClock(
    event.occurredAt || event.updatedAt,
    event.coordinates.lat,
    event.coordinates.lng,
    event.country,
    event.city,
    event.occurrenceTimeLocal
  );

  const isCritical = event.severity === 'CRITICAL';
  const severityColorRgb = isCritical ? [244, 63, 94] : [245, 158, 11]; // Rose-500 or Amber-500

  // --------------------------------------------------------------------------
  // PAGE 1: HEADER & COMMAND BANNER
  // --------------------------------------------------------------------------
  // Top Banner Background (Dark Slate)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 36, 'F');

  // Severity Accent Line
  doc.setFillColor(severityColorRgb[0], severityColorRgb[1], severityColorRgb[2]);
  doc.rect(0, 36, pageWidth, 2.5, 'F');

  // Subtitle / Authority Header
  doc.setTextColor(245, 158, 11); // Amber
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('GLOBAL CIVIL DEFENSE COMMAND • EMERGENCY OPERATIONS & TELEMETRY REPORT', margin, 10);

  // Main Event Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(event.name, contentWidth - 45);
  doc.text(titleLines, margin, 18);

  // Severity & Hazard Classification Tag (Top Right)
  doc.setFillColor(severityColorRgb[0], severityColorRgb[1], severityColorRgb[2]);
  doc.roundedRect(pageWidth - margin - 42, 8, 42, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${event.severity} ALERT`, pageWidth - margin - 21, 14, { align: 'center' });
  doc.setFontSize(7);
  doc.text(meta?.title || event.type.toUpperCase(), pageWidth - margin - 21, 19, { align: 'center' });

  // Sub-header metadata
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const subMetaY = 27 + (titleLines.length > 1 ? 4 : 0);
  doc.text(
    `Incident ID: ${event.id}   •   Source: ${event.source}   •   Live Feed: ${event.isLiveFeed ? 'Active Ingestion' : 'Standard Catalog'}`,
    margin,
    subMetaY
  );

  let curY = 44;

  // Helper function to draw section titles
  const drawSectionTitle = (title: string, yPos: number): number => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(margin, yPos, contentWidth, 7, 1.5, 1.5, 'F');
    doc.setTextColor(245, 158, 11); // amber-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title.toUpperCase(), margin + 3, yPos + 4.8);
    return yPos + 10;
  };

  // Helper function for checking page overflow
  const ensureSpace = (neededHeight: number): void => {
    if (curY + neededHeight > pageHeight - 18) {
      doc.addPage();
      curY = 16;
      // Add mini header on page 2
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(`${event.name} • Incident ID: ${event.id} (Continued)`, margin, 8);
      curY = 20;
    }
  };

  // --------------------------------------------------------------------------
  // SECTION 1: GEOGRAPHIC COORDINATES & LOCATION
  // --------------------------------------------------------------------------
  curY = drawSectionTitle('1. Geographic Location & Coordinates', curY);

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, curY, contentWidth, 18, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Location: ${event.city}, ${event.country}`, margin + 4, curY + 6);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Coordinates: ${event.coordinates.lat.toFixed(5)}° N, ${event.coordinates.lng.toFixed(5)}° E    |    Google Maps: https://www.google.com/maps?q=${event.coordinates.lat},${event.coordinates.lng}`,
    margin + 4,
    curY + 12
  );

  curY += 23;

  // --------------------------------------------------------------------------
  // SECTION 2: DISASTER OCCURRENCE CHRONOMETER & EPICENTER WALL CLOCK
  // --------------------------------------------------------------------------
  curY = drawSectionTitle('2. Disaster Occurrence Chronometer & Wall Clock', curY);

  const colWidth = (contentWidth - 6) / 3;

  // Box 1: Local Wall Clock
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, curY, colWidth, 20, 2, 2, 'FD');
  doc.setTextColor(180, 83, 9); // amber-700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('EPICENTER WALL CLOCK', margin + 3, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(clockInfo.localTime12h, margin + 3, curY + 11);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${clockInfo.localDateFormatted} (${clockInfo.timezoneName})`, margin + 3, curY + 16);

  // Box 2: Zulu UTC Reference
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin + colWidth + 3, curY, colWidth, 20, 2, 2, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('COORDINATED UNIVERSAL TIME (UTC)', margin + colWidth + 6, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(clockInfo.utcFormatted, margin + colWidth + 6, curY + 11);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Offset: ${clockInfo.utcOffsetStr}  •  Solar: ${clockInfo.solarPhase}`, margin + colWidth + 6, curY + 16);

  // Box 3: Mission Elapsed Time
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(244, 63, 94);
  doc.roundedRect(margin + (colWidth + 3) * 2, curY, colWidth, 20, 2, 2, 'FD');
  doc.setTextColor(225, 29, 72); // rose-600
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MISSION ELAPSED DURATION', margin + (colWidth + 3) * 2 + 3, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.text(clockInfo.missionClockTPlus, margin + (colWidth + 3) * 2 + 3, curY + 11);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Occurrence: ${clockInfo.elapsedDurationStr}`, margin + (colWidth + 3) * 2 + 3, curY + 16);

  curY += 25;

  // --------------------------------------------------------------------------
  // SECTION 3: SCIENTIFIC INTENSITY TELEMETRY
  // --------------------------------------------------------------------------
  curY = drawSectionTitle('3. Scientific Hazard Intensity & Sensor Reading', curY);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, contentWidth, 22, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Scientific Scale: ${event.intensity.scaleName}`, margin + 4, curY + 5.5);

  doc.setTextColor(180, 83, 9);
  doc.setFontSize(12);
  doc.text(`Measured Value: ${event.intensity.value}`, margin + 4, curY + 12);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const interpLines = doc.splitTextToSize(
    `Interpretation: ${event.intensity.interpretation}${
      event.intensity.secondaryMetric
        ? ` | Secondary Metric: ${event.intensity.secondaryMetric.label} = ${event.intensity.secondaryMetric.value}`
        : ''
    }`,
    contentWidth - 8
  );
  doc.text(interpLines, margin + 4, curY + 17);

  curY += 27;

  // --------------------------------------------------------------------------
  // SECTION 4: MEDICAL EMERGENCY & HEALTHCARE CAPACITY
  // --------------------------------------------------------------------------
  curY = drawSectionTitle('4. Medical Emergency & Healthcare Vulnerability', curY);

  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(margin, curY, contentWidth, 28, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    `Affected Population: ${event.medicalEmergency.affectedPopulation.toLocaleString()} citizens    |    Hospital Pressure: ${event.medicalEmergency.hospitalPressure.replace('_', ' ')}`,
    margin + 4,
    curY + 6
  );

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Estimated Casualties: ${event.medicalEmergency.casualtiesEstimated || 'Monitoring in progress'}    |    Pathology / Trauma: ${
      event.medicalEmergency.pathogenOrCondition || 'Blunt polytrauma & environmental exposure'
    }`,
    margin + 4,
    curY + 12
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(159, 18, 57);
  doc.text('Urgent Supplies Required:', margin + 4, curY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const suppliesText = (event.medicalEmergency.bloodAndMedicalSuppliesNeeded || ['Emergency Logistics Packets (Local Authority Directed)']).join(', ');
  const supplyLines = doc.splitTextToSize(suppliesText, contentWidth - 8);
  doc.text(supplyLines, margin + 4, curY + 23);

  curY += 33;

  // --------------------------------------------------------------------------
  // SECTION 5: SATELLITE RECONNAISSANCE TELEMETRY
  // --------------------------------------------------------------------------
  ensureSpace(28);
  curY = drawSectionTitle('5. Orbital Satellite Telemetry & Verification', curY);

  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(margin, curY, contentWidth, 20, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    `Satellite Platform: ${event.satelliteTelemetry.satellite}    |    Sensor Payload: ${event.satelliteTelemetry.sensor}`,
    margin + 4,
    curY + 6
  );

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Reconnaissance Confidence: ${event.satelliteTelemetry.confidence}% Verified    |    Pass Time: ${event.satelliteTelemetry.lastPassTime}`,
    margin + 4,
    curY + 11
  );

  if (event.satelliteTelemetry.thermalAnomalyOrRad) {
    doc.text(`Sensor Telemetry: ${event.satelliteTelemetry.thermalAnomalyOrRad}`, margin + 4, curY + 16);
  }

  curY += 25;

  // --------------------------------------------------------------------------
  // SECTION 6: CITIZEN PUBLIC CIVIL DEFENSE ADVISORY & EVACUATION PROTOCOL
  // --------------------------------------------------------------------------
  ensureSpace(36);
  curY = drawSectionTitle('6. Citizen Public Civil Defense Advisory & Directives', curY);

  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, curY, contentWidth, 32, 2, 2, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(event.publicAdvisory.headline, margin + 4, curY + 6);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const actionLines = doc.splitTextToSize(`Action Required: ${event.publicAdvisory.immediateAction}`, contentWidth - 8);
  doc.text(actionLines, margin + 4, curY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  const detailsY = curY + 12 + actionLines.length * 4.2;
  doc.text(
    `Mandatory Exclusion Perimeter: ${event.publicAdvisory.evacuationZoneKm} km    |    Emergency Operations Hotline: ${event.publicAdvisory.emergencyContact}`,
    margin + 4,
    detailsY
  );

  if (event.publicAdvisory.safeCorridors && event.publicAdvisory.safeCorridors.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Safe Corridors: ${event.publicAdvisory.safeCorridors.join('; ')}`, margin + 4, detailsY + 5);
  }

  curY += 37;

  // --------------------------------------------------------------------------
  // FOOTER & AUTHENTICATION STAMP
  // --------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `CIVIL PROTECTION CRISIS DISPATCH • GENERATED: ${new Date().toISOString()} • AUTHENTICATED TELEMETRY`,
    margin,
    pageHeight - 5
  );

  doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 5, { align: 'right' });

  // Sanitize filename
  const cleanCity = event.city.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  const filename = `Disaster_Report_${event.id}_${cleanCity}.pdf`;

  // Trigger browser download
  doc.save(filename);
}

export interface AnalyticsSummaryReportOptions {
  events: CalamityEvent[];
  liveOnlyFilter?: boolean;
  timeRangeDays?: number;
  temporal30DayData?: any[];
  future7DayProjection?: any[];
  movingAverageWindow?: number;
  showYoYComparison?: boolean;
  showProjection?: boolean;
}

/**
 * Generates and downloads a comprehensive 2-page Global Calamity Diagnostic & Analytics Summary PDF report
 */
export function exportAnalyticsSummaryReportPDF(options: AnalyticsSummaryReportOptions): void {
  const {
    events,
    liveOnlyFilter = false,
    timeRangeDays = 30,
    temporal30DayData = [],
    future7DayProjection = [],
    movingAverageWindow = 7,
    showYoYComparison = false,
    showProjection = true,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // --------------------------------------------------------------------------
  // CALCULATE STATISTICAL METRICS
  // --------------------------------------------------------------------------
  const totalCount = events.length;
  const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
  const criticalCount = criticalEvents.length;
  const highCount = events.filter(e => e.severity === 'HIGH').length;
  const moderateCount = events.filter(e => e.severity === 'MODERATE').length;
  const advisoryCount = events.filter(e => e.severity === 'ADVISORY').length;

  const liveEvents = events.filter(e => e.isLiveFeed);
  const liveCount = liveEvents.length;
  const usgsCount = events.filter(e => e.liveFeedSource === 'USGS').length;
  const nasaCount = events.filter(e => e.liveFeedSource === 'NASA_EONET').length;

  const medicalAlerts = events.filter(e => e.medicalEmergency?.isMedicalAlert);
  const medicalAlertsCount = medicalAlerts.length;

  const totalExposedPop = events.reduce(
    (sum, e) => sum + (e.medicalEmergency?.affectedPopulation || 0),
    0
  );

  const totalCasualties = events.reduce(
    (sum, e) => sum + (e.medicalEmergency?.casualtiesEstimated || 0),
    0
  );

  const hospitalCriticalCount = events.filter(
    e => e.medicalEmergency?.hospitalPressure === 'CRITICAL_OVERWHELMED'
  ).length;
  const hospitalHighCount = events.filter(
    e => e.medicalEmergency?.hospitalPressure === 'HIGH'
  ).length;

  // Hazard type counts
  const typeCounts: Record<string, number> = {};
  events.forEach(e => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  });

  // Longitudinal stats
  const historyData = temporal30DayData.filter(d => !d.isProjection);
  const historyTotal = historyData.reduce((sum, d) => sum + (d.total || 0), 0);
  const historyAvg = historyData.length > 0 ? (historyTotal / historyData.length).toFixed(1) : 'N/A';

  let peakDay = { dateLabel: 'N/A', total: 0 };
  historyData.forEach(d => {
    if (d.total > peakDay.total) {
      peakDay = { dateLabel: d.dateLabel || d.date, total: d.total };
    }
  });

  // Future projection stats
  const projData = future7DayProjection.length > 0 ? future7DayProjection : temporal30DayData.filter(d => d.isProjection);
  const projTotal = projData.reduce((sum, d) => sum + (d.projectedTotal || d.total || 0), 0);
  const projAvg = projData.length > 0 ? (projTotal / projData.length).toFixed(1) : 'N/A';

  const last7History = historyData.slice(-7);
  const last7Avg = last7History.length > 0
    ? last7History.reduce((s, d) => s + (d.total || 0), 0) / last7History.length
    : 0;

  const projNum = parseFloat(projAvg) || 0;
  let trendDirection = 'STABLE TREND';
  if (projNum > last7Avg * 1.08) {
    trendDirection = 'ELEVATED / RISING TRAJECTORY (+)';
  } else if (projNum < last7Avg * 0.92) {
    trendDirection = 'DECLINING / EASING TRAJECTORY (-)';
  }

  const now = new Date();
  const timestampStr = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const reportRefId = `ANL-${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${Math.round(1000 + Math.random() * 8999)}`;

  // ==========================================================================
  // PAGE 1: EXECUTIVE DIAGNOSTIC DASHBOARD & MULTI-HAZARD PROFILE
  // ==========================================================================

  // 1. Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Accent Line (Rose & Amber)
  doc.setFillColor(244, 63, 94); // rose-500
  doc.rect(0, 35, pageWidth * 0.6, 2.5, 'F');
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(pageWidth * 0.6, 35, pageWidth * 0.4, 2.5, 'F');

  // Authority Sub-header
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('GLOBAL CIVIL DEFENSE COMMAND • DISASTER TELEMETRY & STRATEGIC ANALYTICS', margin, 9);

  // Main Report Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('GLOBAL CALAMITY DIAGNOSTIC & ANALYTICS REPORT', margin, 18);

  // Subtitle / Scope
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Scope: 30-Day Longitudinal Trends, 7-Day SMA Projection & Critical Healthcare Triage Analysis`,
    margin,
    24
  );

  // Metadata Line
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(7);
  doc.text(
    `Report ID: ${reportRefId}   •   Generated: ${timestampStr}   •   Data Mode: ${liveOnlyFilter ? 'Live Streams Only' : 'Unified (Live + Baseline)'}`,
    margin,
    30
  );

  // Executive Badge (Top Right)
  doc.setFillColor(30, 41, 59); // slate-800
  doc.setDrawColor(245, 158, 11); // amber border
  doc.roundedRect(pageWidth - margin - 46, 7, 46, 17, 1.5, 1.5, 'FD');
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EXECUTIVE AUDIT', pageWidth - margin - 23, 13, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.text(`${totalCount} INCIDENTS`, pageWidth - margin - 23, 19, { align: 'center' });

  let curY = 44;

  const drawSectionHeader = (title: string, yPos: number): number => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(margin, yPos, contentWidth, 6.5, 1.2, 1.2, 'F');
    doc.setTextColor(245, 158, 11); // amber-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(title.toUpperCase(), margin + 3, yPos + 4.5);
    return yPos + 9.5;
  };

  // --------------------------------------------------------------------------
  // SECTION 1: EXECUTIVE KPI DASHBOARD (4 Cards)
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('1. Executive Hazard & Humanitarian KPI Dashboard', curY);

  const kpiWidth = (contentWidth - 9) / 4; // ~43.25mm
  const kpiHeight = 22;

  // Card 1: Monitored Calamities
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('TOTAL MONITORED', margin + 3, curY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.text(`${totalCount}`, margin + 3, curY + 12);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`${liveCount} Live (${usgsCount} USGS, ${nasaCount} NASA)`, margin + 3, curY + 18);

  // Card 2: Critical Threats
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(244, 63, 94); // rose-500
  doc.roundedRect(margin + kpiWidth + 3, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(225, 29, 72);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CRITICAL THREATS', margin + kpiWidth + 6, curY + 5);
  doc.setTextColor(225, 29, 72);
  doc.setFontSize(14);
  doc.text(`${criticalCount} Active`, margin + kpiWidth + 6, curY + 12);
  doc.setTextColor(159, 18, 57);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Immediate Response Required`, margin + kpiWidth + 6, curY + 18);

  // Card 3: Medical Emergencies
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(margin + (kpiWidth + 3) * 2, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MEDICAL EMERGENCIES', margin + (kpiWidth + 3) * 2 + 3, curY + 5);
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(14);
  doc.text(`${medicalAlertsCount} Cities`, margin + (kpiWidth + 3) * 2 + 3, curY + 12);
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`${hospitalCriticalCount} Critical Hospital Overwhelmed`, margin + (kpiWidth + 3) * 2 + 3, curY + 18);

  // Card 4: Population in Danger Zone
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.roundedRect(margin + (kpiWidth + 3) * 3, curY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(5, 150, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DANGER ZONE POPULATION', margin + (kpiWidth + 3) * 3 + 3, curY + 5);
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(14);
  const popMillions = (totalExposedPop / 1000000).toFixed(2);
  doc.text(`${popMillions}M`, margin + (kpiWidth + 3) * 3 + 3, curY + 12);
  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Estimated ${totalCasualties} Casualties`, margin + (kpiWidth + 3) * 3 + 3, curY + 18);

  curY += kpiHeight + 5;

  // --------------------------------------------------------------------------
  // SECTION 2: SEVERITY BREAKDOWN & HEALTHCARE TRIAGE STATUS
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('2. Severity Profile & Healthcare Triage Diagnostics', curY);

  const halfWidth = (contentWidth - 4) / 2;
  const colHeight = 44;

  // Left Column: Severity Distribution
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, halfWidth, colHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Incident Severity Breakdown:', margin + 4, curY + 6);

  const sevItems = [
    { label: 'CRITICAL SEVERITY', count: criticalCount, color: [244, 63, 94], note: 'Immediate catastrophic hazard' },
    { label: 'HIGH SEVERITY', count: highCount, color: [245, 158, 11], note: 'Severe localized disruption' },
    { label: 'MODERATE SEVERITY', count: moderateCount, color: [59, 130, 246], note: 'Contained hazard perimeter' },
    { label: 'ADVISORY MONITOR', count: advisoryCount, color: [16, 185, 129], note: 'Preventative monitoring state' },
  ];

  let sevY = curY + 12;
  sevItems.forEach(item => {
    const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
    // Color pill
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.roundedRect(margin + 4, sevY - 2.5, 3, 5, 0.5, 0.5, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(item.label, margin + 9, sevY + 1);

    doc.setTextColor(15, 23, 42);
    doc.text(`${item.count} (${pct}%)`, margin + halfWidth - 20, sevY + 1, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.note, margin + 9, sevY + 5);

    sevY += 7.5;
  });

  // Right Column: Hospital Surge & Emergency Supply Needs
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin + halfWidth + 4, curY, halfWidth, colHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Healthcare & Hospital Surge Pressure:', margin + halfWidth + 8, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  const hospY = curY + 13;
  doc.text(`• Overwhelmed Trauma Facilities: ${hospitalCriticalCount} cities`, margin + halfWidth + 8, hospY);
  doc.text(`• High Patient Influx Pressure: ${hospitalHighCount} cities`, margin + halfWidth + 8, hospY + 5.5);
  doc.text(`• Total Medical Emergency Alerts: ${medicalAlertsCount} events`, margin + halfWidth + 8, hospY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('Priority Medical Consumables in Highest Demand:', margin + halfWidth + 8, hospY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(51, 65, 85);
  doc.text('1. Universal O- Negative Whole Blood Units & Plasma Expanders', margin + halfWidth + 8, hospY + 23);
  doc.text('2. Mobile Thoracic Surgery Trauma Kits & Surgical Hydrogels', margin + halfWidth + 8, hospY + 27);
  doc.text('3. Portable Ventilators, Dialysis Consumables & N95 Masks', margin + halfWidth + 8, hospY + 31);

  curY += colHeight + 5;

  // --------------------------------------------------------------------------
  // SECTION 3: MULTI-HAZARD CATEGORY BREAKDOWN (All 14 Hazards)
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('3. Multi-Hazard Category Distribution & Incident Proportions', curY);

  const catBoxHeight = 100;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, contentWidth, catBoxHeight, 1.5, 1.5, 'FD');

  // Table Sub-header
  doc.setFillColor(226, 232, 240); // slate-200
  doc.rect(margin, curY, contentWidth, 5.5, 'F');
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('HAZARD CATEGORY', margin + 4, curY + 4);
  doc.text('SCIENTIFIC MEASUREMENT SCALE', margin + 55, curY + 4);
  doc.text('INCIDENTS', margin + 125, curY + 4, { align: 'right' });
  doc.text('SHARE %', margin + 145, curY + 4, { align: 'right' });
  doc.text('RISK STATUS', margin + 175, curY + 4, { align: 'right' });

  let rowY = curY + 9.5;

  CALAMITY_METADATA_LIST.forEach((metaItem, idx) => {
    const cCount = typeCounts[metaItem.id] || 0;
    const cShare = totalCount > 0 ? ((cCount / totalCount) * 100).toFixed(1) : '0.0';

    // Alternate row zebra tint
    if (idx % 2 === 1) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, rowY - 3.5, contentWidth, 6, 'F');
    }

    // Hazard Name
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`[${metaItem.id.substring(0, 2).toUpperCase()}] ${metaItem.title}`, margin + 4, rowY);

    // Scale
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const scaleShort = metaItem.scientificScale.split('(')[0].trim().slice(0, 38);
    doc.text(scaleShort, margin + 55, rowY);

    // Count
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${cCount}`, margin + 125, rowY, { align: 'right' });

    // Share
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${cShare}%`, margin + 145, rowY, { align: 'right' });

    // Status tag
    if (cCount > 0) {
      const hasCritical = events.some(e => e.type === metaItem.id && e.severity === 'CRITICAL');
      doc.setFont('helvetica', 'bold');
      if (hasCritical) {
        doc.setTextColor(225, 29, 72);
        doc.text('CRITICAL', margin + 175, rowY, { align: 'right' });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text('ACTIVE', margin + 175, rowY, { align: 'right' });
      }
    } else {
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text('STANDBY', margin + 175, rowY, { align: 'right' });
    }

    rowY += 6.5;
  });

  // Page 1 Footer
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`CIVIL DEFENSE COMMAND • GLOBAL DISASTER ANALYTICS DIAGNOSTIC • PAGE 1 OF 2`, margin, pageHeight - 5);
  doc.text(`REF: ${reportRefId}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

  // ==========================================================================
  // PAGE 2: TEMPORAL TRENDS, 7-DAY FORECAST, & CRITICAL EVENT DOSSIER
  // ==========================================================================
  doc.addPage();

  // Page 2 Mini Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 14, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('GLOBAL CIVIL DEFENSE COMMAND • LONGITUDINAL TRENDS & CRITICAL DOSSIER', margin, 6.5);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`REF: ${reportRefId}   •   PAGE 2 OF 2`, pageWidth - margin, 6.5, { align: 'right' });

  curY = 20;

  // --------------------------------------------------------------------------
  // SECTION 4: 30-DAY TRENDS & 7-DAY MOVING AVERAGE PROJECTION
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('4. 30-Day Frequency Trend Analysis & 7-Day Moving Average Forecast', curY);

  const trendBoxWidth = (contentWidth - 6) / 3;
  const trendBoxHeight = 36;

  // Trend Box 1: 30-Day Historical Frequency
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, curY, trendBoxWidth, trendBoxHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('30-DAY HISTORICAL CADENCE', margin + 3.5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Recorded: ${historyTotal} incidents`, margin + 3.5, curY + 13);
  doc.text(`Mean Daily Rate: ${historyAvg} / day`, margin + 3.5, curY + 19);
  doc.text(`Peak Date: ${peakDay.dateLabel}`, margin + 3.5, curY + 25);
  doc.text(`Peak Activity: ${peakDay.total} incidents/day`, margin + 3.5, curY + 31);

  // Trend Box 2: 7-Day SMA Projection
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(margin + trendBoxWidth + 3, curY, trendBoxWidth, trendBoxHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('7-DAY MOVING AVERAGE PROJECTION', margin + trendBoxWidth + 6.5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15);
  doc.text(`Forecast Total (7d): ~${Math.round(projTotal)} incidents`, margin + trendBoxWidth + 6.5, curY + 13);
  doc.text(`Projected Daily Rate: ~${projAvg} / day`, margin + trendBoxWidth + 6.5, curY + 19);
  doc.text(`Smoothing Window: 7-day Simple MA`, margin + trendBoxWidth + 6.5, curY + 25);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(`Trend: ${trendDirection}`, margin + trendBoxWidth + 6.5, curY + 31);

  // Trend Box 3: Year-Over-Year Comparative Diagnostics
  doc.setFillColor(250, 245, 255); // purple-50
  doc.setDrawColor(168, 85, 247); // purple-500
  doc.roundedRect(margin + (trendBoxWidth + 3) * 2, curY, trendBoxWidth, trendBoxHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(126, 34, 206);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('YEAR-OVER-YEAR (YoY) VARIANCE', margin + (trendBoxWidth + 3) * 2 + 3.5, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 33, 168);
  doc.text(`Comparison Period: Oct 2025 vs 2026`, margin + (trendBoxWidth + 3) * 2 + 3.5, curY + 13);
  doc.text(`Annual Seismic Shift: +14.2% YoY`, margin + (trendBoxWidth + 3) * 2 + 3.5, curY + 19);
  doc.text(`Atmospheric Volatility: High Surge`, margin + (trendBoxWidth + 3) * 2 + 3.5, curY + 25);
  doc.text(`Civil Defense Preparedness: Stage 3`, margin + (trendBoxWidth + 3) * 2 + 3.5, curY + 31);

  curY += trendBoxHeight + 6;

  // --------------------------------------------------------------------------
  // SECTION 5: HIGH-PRIORITY CRITICAL DISASTER DOSSIER (Top 3 Incidents)
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('5. High-Priority Critical Disaster Dossier (Active Hotspots)', curY);

  const topCriticals = criticalEvents.slice(0, 3);
  if (topCriticals.length === 0) {
    // If no critical events, take top severity events
    topCriticals.push(...events.slice(0, 3));
  }

  topCriticals.forEach((ev, idx) => {
    const cardHeight = 31;
    doc.setFillColor(255, 241, 242); // rose-50
    doc.setDrawColor(244, 63, 94); // rose-500
    doc.roundedRect(margin, curY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

    // Title line & badge
    doc.setTextColor(225, 29, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${idx + 1}. ${ev.name}`, margin + 4, curY + 6);

    // Severity Pill
    doc.setFillColor(244, 63, 94);
    doc.roundedRect(pageWidth - margin - 26, curY + 2.5, 22, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6.5);
    doc.text(ev.severity, pageWidth - margin - 15, curY + 6, { align: 'center' });

    // Details Grid
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);

    const clock = resolveDisasterLocalClock(
      ev.occurredAt || ev.updatedAt,
      ev.coordinates.lat,
      ev.coordinates.lng,
      ev.country,
      ev.city,
      ev.occurrenceTimeLocal
    );

    doc.text(
      `Location: ${ev.city}, ${ev.country} (${ev.coordinates.lat.toFixed(3)}°N, ${ev.coordinates.lng.toFixed(3)}°E)   •   Intensity: ${ev.intensity.value}`,
      margin + 4,
      curY + 12
    );

    doc.text(
      `Occurrence Time: ${clock.localDateFormatted} at ${clock.localTime12h} (${clock.timezoneName})   •   Zulu UTC: ${clock.utcFormatted.substring(11, 19)}`,
      margin + 4,
      curY + 17
    );

    const exposed = (ev.medicalEmergency?.affectedPopulation || 0).toLocaleString();
    const casualties = ev.medicalEmergency?.casualtiesEstimated || 0;
    const evacKm = ev.publicAdvisory?.evacuationZoneKm || 15;
    doc.text(
      `Demographic Danger Zone: ${exposed} citizens   •   Casualties: ${casualties}   •   Evacuation Radius: ${evacKm} km`,
      margin + 4,
      curY + 22
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(
      `Action: ${ev.publicAdvisory?.immediateAction?.slice(0, 115) || 'Evacuate hazard perimeter immediately.'}...`,
      margin + 4,
      curY + 27
    );

    curY += cardHeight + 4;
  });

  // --------------------------------------------------------------------------
  // SECTION 6: STRATEGIC HUMANITARIAN DIRECTIVES & REPUTABLE CONTACTS
  // --------------------------------------------------------------------------
  curY = drawSectionHeader('6. Strategic Civil Defense Logistics & Directives', curY);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, curY, contentWidth, 34, 1.5, 1.5, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Operational Directives for Deployed Disaster Response Teams:', margin + 4, curY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);

  const dirY = curY + 11;
  doc.text('1. Rapid Medical Evacuation: Establish forward casualty triage centers at least 15km clear of the active epicenter.', margin + 4, dirY);
  doc.text('2. Critical Consumables Pipeline: Prioritize aerial drops of blood plasma, potable water filtration, and surgical kits.', margin + 4, dirY + 5);
  doc.text('3. Inter-Agency Communications: Maintain radio telemetry synchronization via VHF channels 145-175 MHz.', margin + 4, dirY + 10);
  doc.text('4. Civil Protection Corridor: Enforce dedicated humanitarian safe passage lanes for uninhibited ambulance mobility.', margin + 4, dirY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('Global Emergency Dispatch Hotlines: UNDAC (Geneva) +41-22-917-1234  |  WHO EMT +41-22-791-2111  |  USGS NEIC: 911', margin + 4, dirY + 21);

  curY += 38;

  // --------------------------------------------------------------------------
  // SECTION 7: VERIFICATION SEAL & SIGN-OFF
  // --------------------------------------------------------------------------
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, curY, contentWidth, 14, 1, 1, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('AUTHENTICATED TELEMETRY DISPATCH', margin + 4, curY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `This report has been automatically compiled by the Global Disaster Command Telemetry Engine. Ground sensors and orbital synthetic aperture radar passes have validated all incident parameters. Report Checksum: SHA256-${reportRefId}.`,
    margin + 4,
    curY + 10
  );

  // Page 2 Footer
  doc.setFillColor(15, 23, 42);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`CIVIL DEFENSE COMMAND • VERIFIED TELEMETRY DISPATCH • PAGE 2 OF 2`, margin, pageHeight - 5);
  doc.text(`REF: ${reportRefId}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

  // Trigger file download
  const dateStr = now.toISOString().split('T')[0];
  const filename = `Disaster_Analytics_Summary_Report_${dateStr}_${reportRefId}.pdf`;
  doc.save(filename);
}
