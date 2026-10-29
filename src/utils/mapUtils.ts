import L from 'leaflet';

export function createCustomIcon(color: string, severity: string) {
  const size = severity === 'CRITICAL' ? 36 : severity === 'HIGH' ? 32 : 28;
  const pulse = severity === 'CRITICAL' ? 'animate-pulse' : '';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="${pulse}" style="
        width: ${size}px;
        height: ${size}px;
        background: radial-gradient(circle, ${color} 0%, ${color}dd 70%, transparent 100%);
        border: 2px solid ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 0 20px ${color}80, 0 4px 12px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size],
  });
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#ef4444';
    case 'HIGH': return '#f97316';
    case 'MODERATE': return '#eab308';
    case 'ADVISORY': return '#06b6d4';
    default: return '#64748b';
  }
}

export function calculateBounds(events: any[]): L.LatLngBounds | null {
  if (!events || events.length === 0) return null;
  
  const bounds = L.latLngBounds([]);
  events.forEach(event => {
    if (event.coordinates?.lat && event.coordinates?.lng) {
      bounds.extend([event.coordinates.lat, event.coordinates.lng]);
    }
  });
  
  return bounds.isValid() ? bounds : null;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
