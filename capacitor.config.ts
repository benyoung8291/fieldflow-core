import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.036d358a29a647deaf6b2aac469bfbd9',
  appName: 'Pulse Worker',
  webDir: 'dist',
  server: {
    // Development hot-reload - comment out for production builds
    url: 'https://036d358a-29a6-47de-af6b-2aac469bfbd9.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Camera: {
      // iOS camera permissions
    },
    Geolocation: {
      // Location permissions
    }
  },
  ios: {
    // Start at worker dashboard
    path: 'ios',
    scheme: 'Pulse Worker'
  },
  android: {
    path: 'android',
    allowMixedContent: true
  }
};

export default config;
