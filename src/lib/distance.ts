/**
 * Distance calculation utilities for time log location verification
 */

/**
 * Calculate distance between two geographic points using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

/**
 * Determine warning level based on distance from appointment location
 * - ok: ≤500m (at job site)
 * - warning: 500m-2km (warning distance)
 * - danger: >2km (likely not at job site)
 */
export function getDistanceWarningLevel(
  meters: number
): "ok" | "warning" | "danger" {
  if (meters <= 500) return "ok";
  if (meters <= 2000) return "warning";
  return "danger";
}
