// Provider-agnostic map layer. Swap providers by changing this file.
// Supported: 'carto' (default, OSM data via CartoDB), 'osm', 'mapbox', 'google'
import { NOTE_CATEGORIES, LEGACY_CATEGORY_ALIASES } from './noteCategories';

export const PROVIDER = process.env.NEXT_PUBLIC_MAP_PROVIDER || 'carto';

export function getTileConfig(style = 'standard') {
  switch (style) {
    case 'satellite':
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles © Esri',
        maxZoom: 20,
      };
    case 'terrain':
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      };
    case 'standard':
    default:
      switch (PROVIDER) {
        case 'osm':
          return {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap',
            maxZoom: 19,
          };
        case 'mapbox': {
          const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
          return {
            url: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`,
            attribution: '© Mapbox',
            maxZoom: 22,
          };
        }
        case 'carto':
        default:
          return {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attribution: '© OpenStreetMap contributors, © CARTO',
            maxZoom: 20,
          };
      }
  }
}

// Route line style abstraction so switching providers keeps same look
export const ROUTE_STYLE = {
  color: '#0a0a0a',
  weight: 5,
  opacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
};

export const START_STYLE = { color: '#fff', weight: 3, fillColor: '#10b981', fillOpacity: 1 };
export const END_STYLE = { color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 };

export function getSpeedZoneColor(speedKmh) {
  if (speedKmh == null || Number.isNaN(speedKmh)) return '#0a0a0a';
  if (speedKmh < 10) return '#f59e0b';
  if (speedKmh < 30) return '#3b82f6';
  if (speedKmh < 60) return '#10b981';
  return '#8b5cf6';
}

// Note category color mapping for pinned notes on map — derived from
// lib/noteCategories.js (single source of truth) plus legacy aliases, so old
// route_notes docs (pre-dating the 18-category taxonomy) still resolve to a
// sensible color with no data migration.
export const NOTE_COLORS = {
  ...Object.fromEntries(NOTE_CATEGORIES.map((c) => [c.key, c.color])),
  ...Object.fromEntries(Object.entries(LEGACY_CATEGORY_ALIASES).map(([oldKey, newKey]) => [
    oldKey, NOTE_CATEGORIES.find((c) => c.key === newKey)?.color || '#a3a3a3',
  ])),
  info: '#525252',
};
