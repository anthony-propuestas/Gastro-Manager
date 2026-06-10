import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.lahoja.app',
  appName: 'La Hoja',
  webDir: 'dist',
  server: {
    url: 'https://www.lahoja.org',
    cleartext: false
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      clientId: '940337841448-bukrod6t1eejv9t26fb9t4peua9tevae.apps.googleusercontent.com',
      serverClientId: '940337841448-bukrod6t1eejv9t26fb9t4peua9tevae.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    }
  }
};

export default config;
