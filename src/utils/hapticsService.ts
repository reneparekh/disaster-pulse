/**
 * Mobile Haptics & Vibration Engine for Disaster Command
 * Uses the Web Vibration API (navigator.vibrate) to deliver tactile feedback
 * for life-critical alerts, map interactions, and emergency workflows.
 * Fully compatible with Android WebViews, PWAs, Chrome Mobile, and Capacitor.
 */

const STORAGE_KEY_HAPTICS = 'disaster_command_haptics_enabled';

/**
 * Check if the browser / platform supports the Navigator.vibrate API
 */
export function isVibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Get whether user has haptic feedback enabled (defaults to true)
 */
export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HAPTICS);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

/**
 * Toggle or set haptic feedback preference
 */
export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_HAPTICS, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to store haptic preference:', err);
  }
}

/**
 * Core vibration runner with safety check & error handling
 */
export function triggerVibration(pattern: number | number[]): boolean {
  if (!isVibrationSupported() || !isHapticsEnabled()) {
    return false;
  }

  try {
    return navigator.vibrate(pattern);
  } catch (err) {
    // Some devices restrict vibrations if page has no user gesture yet
    return false;
  }
}

/**
 * Cancel any ongoing vibration
 */
export function stopVibrations(): void {
  if (isVibrationSupported()) {
    try {
      navigator.vibrate(0);
    } catch {
      // Ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Specialized Disaster & Map Interaction Vibration Triggers
// ---------------------------------------------------------------------------

/**
 * 🚨 CRITICAL SEVERITY CALAMITY ALERT
 * Urgent SOS-style civil defense cadence: 3 short pulses followed by a sustained emergency shockwave
 */
export function triggerCriticalAlertHaptic(): void {
  // 300ms vibration, 100ms pause, 300ms vibration, 100ms pause, 600ms sustained rumble
  triggerVibration([300, 100, 300, 100, 600]);
}

/**
 * ⚠️ HIGH / SEVERE HAZARD WARNING
 * Double-pulse alert for significant events, cascading secondary hazards, or proximity warnings
 */
export function triggerWarningHaptic(): void {
  triggerVibration([180, 80, 180]);
}

/**
 * 📍 MAP DISASTER MARKER SELECTION
 * Crisp, tactile single tap when the user taps a disaster, earthquake, or volcano marker
 */
export function triggerMapMarkerTapHaptic(): void {
  triggerVibration(35);
}

/**
 * 📏 MAP MEASUREMENT POINT A/B PLACEMENT
 * Subtle tap confirming the placement of an evacuation waypoint
 */
export function triggerMeasurePointHaptic(): void {
  triggerVibration(25);
}

/**
 * 🏁 MAP MEASUREMENT ROUTE CALCULATED
 * Dual-tap confirming both Origin and Destination are connected with an evacuation arc
 */
export function triggerMeasureCompleteHaptic(): void {
  triggerVibration([30, 45, 30]);
}

/**
 * 🎯 GPS LOCATION LOCK ACQUIRED
 * Affirmative pulse when user geolocation is locked and 500km perimeter is drawn
 */
export function triggerLocationLockHaptic(): void {
  triggerVibration([45, 60, 45]);
}

/**
 * 🏥 EMERGENCY RESOURCE / SHELTER MARKER TAP
 * Distinct gentle feedback when tapping field hospitals, shelters, or triage stations
 */
export function triggerResourceMarkerHaptic(): void {
  triggerVibration(28);
}

/**
 * 🔘 INTERACTIVE ACTION / BUTTON TAP
 * Micro-pulse for UI toggles, sound controls, or layer changes
 */
export function triggerActionHaptic(): void {
  triggerVibration(15);
}
