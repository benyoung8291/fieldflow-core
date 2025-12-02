/**
 * Helper function to resolve appointment location from multiple possible sources
 * Priority: appointment.location_lat/lng > service_order.customer_location.latitude/longitude
 */
export interface AppointmentLocation {
  lat: number;
  lng: number;
  address: string;
}

export function getAppointmentLocation(appointment: any): AppointmentLocation | null {
  // First check if appointment has direct location set
  if (appointment?.location_lat && appointment?.location_lng) {
    return {
      lat: appointment.location_lat,
      lng: appointment.location_lng,
      address: appointment.location_address || '',
    };
  }

  // Fall back to customer location from service order
  if (appointment?.service_order?.customer_location?.latitude && 
      appointment?.service_order?.customer_location?.longitude) {
    const location = appointment.service_order.customer_location;
    return {
      lat: location.latitude,
      lng: location.longitude,
      address: location.address || location.formatted_address || '',
    };
  }

  return null;
}
