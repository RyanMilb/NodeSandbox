'use strict';

const ORIGIN = { name: 'McMinnville, OR', lat: 45.2101, lon: -123.1951 };

const EARTH_RADIUS_MILES = 3958.7613;
const rad = (deg) => (deg * Math.PI) / 180;

function haversineMiles(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

function compassBearing(lat, lon) {
  const dLon = rad(lon - ORIGIN.lon);
  const y = Math.sin(dLon) * Math.cos(rad(lat));
  const x =
    Math.cos(rad(ORIGIN.lat)) * Math.sin(rad(lat)) -
    Math.sin(rad(ORIGIN.lat)) * Math.cos(rad(lat)) * Math.cos(dLon);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return points[Math.round(deg / 22.5) % 16];
}

function distanceFromOrigin(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { miles: null, bearing: null };
  return {
    miles: Number(haversineMiles(ORIGIN.lat, ORIGIN.lon, lat, lon).toFixed(1)),
    bearing: compassBearing(lat, lon),
  };
}

module.exports = { ORIGIN, haversineMiles, distanceFromOrigin };
