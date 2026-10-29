import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { CalamityEvent } from '../types/disaster';
import { getCalamityIconConfig } from '../utils/calamityIcons';

interface MapClusterLayerProps {
  map: L.Map | null;
  events: CalamityEvent[];
  onEventClick: (event: CalamityEvent) => void;
  enabled: boolean;
}

export default function MapClusterLayer({ map, events, onEventClick, enabled }: MapClusterLayerProps) {
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!enabled) {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
      return;
    }

    // Remove existing cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    // Create marker cluster group with custom styling
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = 'small';
        if (count >= 10) size = 'medium';
        if (count >= 50) size = 'large';
        
        return L.divIcon({
          html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
    });

    events.forEach((event) => {
      const config = getCalamityIconConfig(event.type);
      const icon = L.divIcon({
        className: 'custom-disaster-marker',
        html: `<div class="marker-pin marker-${event.severity.toLowerCase()}" style="background: ${config.color}20; border-color: ${config.color};">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${config.color}" stroke-width="2">
                   <circle cx="12" cy="12" r="3"></circle>
                 </svg>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([event.coordinates.lat, event.coordinates.lng], { icon });
      marker.bindTooltip(
        `<div class="text-xs font-semibold">${event.name.substring(0, 40)}...</div><div class="text-[10px] text-slate-400">${event.country}</div>`,
        { direction: 'top', offset: [0, -10] }
      );
      marker.on('click', () => onEventClick(event));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, events, enabled, onEventClick]);

  return null;
}
