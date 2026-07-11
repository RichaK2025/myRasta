'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

// Fix default icon issue
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

export default function MapView({
  points = [],
  center,
  zoom = 15,
  follow = false,
  fit = false,
  height = '100%',
  showEnds = true,
  interactive = true,
}) {
  const [mapKey] = useState(() => Math.random().toString(36).slice(2));
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const positions = points.map((p) => [p.lat, p.lng]);
  const initialCenter = center || (positions[0] ? positions[0] : [20.5937, 78.9629]);
  const last = positions[positions.length - 1];
  const first = positions[0];

  if (!mounted) {
    return <div style={{ height, width: '100%' }} className="bg-neutral-100 animate-pulse" />;
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
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{ color: '#0a0a0a', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
          />
        )}
        {showEnds && first && (
          <CircleMarker center={first} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#10b981', fillOpacity: 1 }} />
        )}
        {showEnds && last && positions.length > 1 && (
          <CircleMarker center={last} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }} />
        )}
        {follow && last && <Recenter center={last} zoom={17} />}
        {fit && positions.length > 1 && <FitBounds points={points} />}
      </MapContainer>
    </div>
  );
}
