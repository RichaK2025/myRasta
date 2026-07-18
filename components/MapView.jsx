'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { getTileConfig, ROUTE_STYLE, START_STYLE, END_STYLE, NOTE_COLORS, getSpeedZoneColor } from '@/lib/mapProvider';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    // animate: false avoids leaving a pending animation frame that can fire
    // after the map's panes are torn down (e.g. on fast navigation/unmount),
    // which throws "Cannot read properties of undefined (reading '_leaflet_pos')".
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: false });
  }, [center, zoom, map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], animate: false });
    }
  }, [points, map]);
  return null;
}

// Leaflet computes its container size once on init. When MapView sits inside
// an element that's still animating in (e.g. a framer-motion card fade-in),
// that initial size can be wrong. Nudge Leaflet to remeasure shortly after
// mount/prop changes instead of remounting the whole map (remounting raced
// with in-flight fitBounds/setView animations and crashed Leaflet).
function AutoInvalidate({ watch }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ...watch]);
  return null;
}

function ClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return;
    const handler = (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onMapClick]);
  return null;
}

export default function MapView({
  points = [],
  center,
  zoom = 15,
  follow = false,
  fit = false,
  height = '100%',
  showEnds = true,
  interactive = true,
  noteMarkers = [],
  onMapClick = null,
  droppedPin = null,
  mapStyle = 'standard',
  routeSegments = [],
  waypoints = [],
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const positions = points.map((p) => [p.lat, p.lng]);
  const initialCenter = center || (positions[0] ? positions[0] : [20.5937, 78.9629]);
  const last = positions[positions.length - 1];
  const first = positions[0];
  const tile = getTileConfig(mapStyle);

  if (!mounted) {
    return <div style={{ height, width: '100%' }} className="bg-neutral-100 dark:bg-neutral-900 animate-pulse" />;
  }

  return (
    <div style={{ height, width: '100%' }} className="relative leaflet-map-shell">
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl={false}
      >
        <TileLayer url={tile.url} maxZoom={tile.maxZoom} />
        {positions.length > 1 && routeSegments.length === 0 && (
          <Polyline positions={positions} pathOptions={ROUTE_STYLE} />
        )}
        {routeSegments.map((segment, index) => {
          const segmentPositions = (segment.points || []).map((p) => [p.lat, p.lng]);
          return (
            <Polyline
              key={`segment-${index}`}
              positions={segmentPositions}
              pathOptions={{
                ...ROUTE_STYLE,
                color: segment.color || getSpeedZoneColor(segment.speedKmh),
                weight: segment.weight || 5,
              }}
            />
          );
        })}
        {showEnds && first && (
          <CircleMarker center={first} radius={8} pathOptions={START_STYLE} />
        )}
        {showEnds && last && positions.length > 1 && (
          <CircleMarker center={last} radius={8} pathOptions={END_STYLE} />
        )}
        {noteMarkers.map((n) => (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lng]}
            radius={7}
            pathOptions={{
              color: '#fff',
              weight: 2,
              fillColor: NOTE_COLORS[n.category] || NOTE_COLORS.info,
              fillOpacity: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span className="text-xs font-medium">{n.text}</span>
            </Tooltip>
          </CircleMarker>
        ))}
        {droppedPin && (
          <CircleMarker
            center={[droppedPin.lat, droppedPin.lng]}
            radius={9}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#0a0a0a', fillOpacity: 1 }}
          />
        )}
        {waypoints.map((w) => (
          <CircleMarker
            key={w.id}
            center={[w.lat, w.lng]}
            radius={7}
            pathOptions={{ color: '#fff', weight: 2, fillColor: '#0f766e', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span className="text-xs font-medium">{w.label || 'Waypoint'}</span>
            </Tooltip>
          </CircleMarker>
        ))}
        {onMapClick && <ClickHandler onMapClick={onMapClick} />}
        {follow && last && <Recenter center={last} zoom={17} />}
        {fit && positions.length > 1 && <FitBounds points={points} />}
        <AutoInvalidate watch={[points.length, mapStyle, fit]} />
      </MapContainer>
    </div>
  );
}
