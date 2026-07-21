// Standard Google encoded-polyline algorithm (precision 5, the usual
// default). Used purely as a response-time transform for list views — never
// persisted, so it doesn't duplicate the stored `points` data.
export function encodePolyline(points) {
  let output = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    output += encodeSignedNumber(lat - prevLat) + encodeSignedNumber(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return output;
}

function encodeSignedNumber(num) {
  let sgnNum = num << 1;
  if (num < 0) sgnNum = ~sgnNum;
  return encodeNumber(sgnNum);
}

function encodeNumber(num) {
  let output = '';
  while (num >= 0x20) {
    output += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  output += String.fromCharCode(num + 63);
  return output;
}

// Applied to a list-view route object right before responding: swaps the
// full `points` array for a compact `encoded_polyline` string when the
// caller asked for it (`?format=polyline`). No-op otherwise.
export function applyPolylineFormat(route, format) {
  if (format !== 'polyline' || !Array.isArray(route.points) || route.points.length === 0) return route;
  const { points, ...rest } = route;
  return { ...rest, encoded_polyline: encodePolyline(points) };
}

export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
