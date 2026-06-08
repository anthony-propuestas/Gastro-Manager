import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.lahoja.app',
  appName: 'La Hoja',
  webDir: 'dist',
  server: {
    url: 'https://www.lahoja.org',
    cleartext: false
  }
};

export default config;
