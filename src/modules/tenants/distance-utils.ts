/**
 * Distance calculation utilities for tenant location-based features
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point in degrees
 * @param lng1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lng2 Longitude of second point in degrees
 * @returns Distance in kilometers, rounded to 1 decimal place
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert degrees to radians
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  
  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Round to 1 decimal place for better UX
  return Math.round(distance * 10) / 10;
}

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted distance string (e.g., "2.5km", "800m")
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    // Convert to meters for distances less than 1km
    const meters = Math.round(distance * 1000);
    return `${meters}m`;
  }
  return `${distance}km`;
}

/**
 * Check if a distance is within a maximum range
 * @param distance Distance in kilometers
 * @param maxDistance Maximum allowed distance in kilometers
 * @returns True if distance is within range
 */
export function isWithinDistance(distance: number, maxDistance: number): boolean {
  return distance <= maxDistance;
}

/**
 * Calculate distance and format it for display
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Formatted distance string
 */
export function calculateAndFormatDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): string {
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  return formatDistance(distance);
}
