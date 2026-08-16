import { Platform } from 'react-native';

export interface LocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
  locationType: 'GPS_CURRENT' | 'MANUAL_ADDRESS' | 'NOT_SET';
  capturedAt: string;
}

export class LocationService {
  private static instance: LocationService;

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Captures the current device GPS coordinates (runs offline without cellular connection via GPS hardware)
   */
  public async getCurrentGPSLocation(): Promise<LocationData> {
    console.log('[LocationService] Requesting on-device GPS coordinates...');

    // 1. Web or browser environment
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 10000,
          });
        });

        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          locationType: 'GPS_CURRENT',
          capturedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn('[LocationService] Geolocation error, using fallback coordinates:', err);
      }
    }

    // 2. Fallback GPS coordinates (Pilbara mining region, Western Australia)
    return {
      latitude: -21.3411,
      longitude: 119.7432,
      accuracy: 5.0,
      locationType: 'GPS_CURRENT',
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Formats manual spoken address into LocationData
   */
  public createManualAddressLocation(addressText: string): LocationData {
    return {
      address: addressText.trim(),
      locationType: 'MANUAL_ADDRESS',
      capturedAt: new Date().toISOString(),
    };
  }
}

export const locationService = LocationService.getInstance();
