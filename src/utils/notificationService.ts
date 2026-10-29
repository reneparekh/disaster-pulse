import { CalamityEvent } from '../types/disaster';
import { formatIncidentUTC } from './dateUtils';

/**
 * Checks if browser desktop notifications are supported
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets current notification permission status
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests browser desktop notification permissions from the user
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn('Failed to request notification permission:', error);
    return Notification.permission;
  }
}

/**
 * Plays a short, distinct dual-tone emergency civil defense audio alert via Web Audio API
 */
export function playEmergencyAudioChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Emergency tone: 880Hz (A5) -> 740Hz (F#5) -> 880Hz (A5)
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(740, now + 0.12);
    osc.frequency.setValueAtTime(880, now + 0.24);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    // Audio autoplay might be restricted by browser until first interaction
  }
}

/**
 * Sends a native browser desktop alert for a CRITICAL calamity
 */
export function sendDesktopNotification(event: CalamityEvent, onClick?: () => void): boolean {
  if (!isNotificationSupported()) return false;

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const occurredTime = event.occurredAt ? formatIncidentUTC(event.occurredAt) : 'Real-time Ingestion';
    const title = `🚨 CRITICAL CALAMITY INGESTED: ${event.city}, ${event.country}`;
    const body = `Event: ${event.name}\nIntensity: ${event.intensity.value} (${event.intensity.scaleName})\nOccurred: ${occurredTime}\nImmediate Action: ${event.publicAdvisory.immediateAction}`;

    const notification = new Notification(title, {
      body,
      tag: `calamity-${event.id}`,
      icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚨</text></svg>',
      requireInteraction: true,
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    return true;
  } catch (err) {
    console.warn('Browser desktop notification error:', err);
    return false;
  }
}
