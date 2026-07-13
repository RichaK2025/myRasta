// Provider-agnostic map layer. Swap providers by changing this file.
// Supported: 'carto' (default, OSM data via CartoDB), 'osm', 'mapbox', 'google'

export const PROVIDER = process.env.NEXT_PUBLIC_MAP_PROVIDER || 'carto';

export function getTileConfig() {
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

// Note category color mapping for pinned notes on map
export const NOTE_COLORS = {
  tea: '#a16207',       // amber
  food: '#ea580c',      // orange
  fuel: '#0891b2',      // cyan
  washroom: '#0369a1',  // blue
  police: '#4338ca',    // indigo
  danger: '#dc2626',    // red
  safe: '#059669',      // green
  scenic: '#7c3aed',    // violet
  shortcut: '#db2777',  // pink
  warning: '#d97706',   // amber-dark
  info: '#525252',      // neutral
};
