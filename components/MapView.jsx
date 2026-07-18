'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { getTileConfig, ROUTE_STYLE, START_STYLE, END_STYLE, NOTE_COLORS } from '@/lib/mapProvider';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points]);
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
}) {
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const positions = points.map((p) => [p.lat, p.lng]);
  const initialCenter = center || (positions[0] ? positions[0] : [20.5937, 78.9629]);
  const last = positions[positions.length - 1];
  const first = positions[0];
  const tile = getTileConfig();

  if (!mounted) {
    return <div style={{ height, width: '100%' }} className="bg-neutral-100 dark:bg-neutral-900 animate-pulse" />;
  }

  return (
    <div style={{ height, width: '100%' }} className="relative">
      <MapContainer
        key={mapKey}
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
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={ROUTE_STYLE} />
        )}
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
        {onMapClick && <ClickHandler onMapClick={onMapClick} />}
        {follow && last && <Recenter center={last} zoom={17} />}
        {fit && positions.length > 1 && <FitBounds points={points} />}
      </MapContainer>
    </div>
  );
}
