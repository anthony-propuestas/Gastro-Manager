# Mobile (Android)

La Hoja es una SPA React desplegada en Cloudflare Pages que también se distribuye como app nativa Android mediante **Capacitor 8**. El wrapper es mínimo: un `WebView` que carga la URL de producción, sin lógica nativa adicional.

---

## Arquitectura

```
React SPA (https://www.lahoja.org)
        │
        │  cargada en WebView
        ▼
MainActivity (BridgeActivity de Capacitor)
        │
        │  puente JS ↔ nativo
        ▼
Capacitor Runtime (org.lahoja.app)
```

- `MainActivity.java` extiende `BridgeActivity` de Capacitor — no contiene lógica propia.
- Capacitor inyecta un bridge JavaScript que permite llamar APIs nativas desde el código web. Se usan dos plugins nativos: `@capacitor/app` (escucha deep links vía `appUrlOpen`) y `@codetrix-studio/capacitor-google-auth` (Google Sign-In nativo).
- En producción el WebView apunta a `https://www.lahoja.org`; en desarrollo puede apuntar a `http://localhost:5173` editando `capacitor.config.ts`.

---

## Configuración principal

**`capacitor.config.ts`**

```typescript
const config: CapacitorConfig = {
  appId: 'org.lahoja.app',
  appName: 'La Hoja',
  webDir: 'dist',              // salida de `npm run build`
  server: {
    url: 'https://www.lahoja.org',  // carga la web en producción
    cleartext: false                 // solo HTTPS
  }
};
```

| Campo | Valor | Notas |
|-------|-------|-------|
| `appId` | `org.lahoja.app` | Identificador único en Play Store |
| `appName` | `La Hoja` | Nombre visible en el launcher |
| `webDir` | `dist` | Se usa cuando no hay `server.url` |
| `server.url` | `https://www.lahoja.org` | Apunta a producción vía internet |

---

## Android nativo

### AndroidManifest.xml

- **Permisos:** solo `android.permission.INTERNET`
- **Launch mode:** `singleTask`
- **FileProvider** configurado bajo `org.lahoja.app.fileprovider` para que el código web pueda abrir el selector de archivos (subida de comprobantes)
- **Deep links (`org.lahoja.app://`):** intent filter con el esquema `org.lahoja.app` captura URLs internas del tipo `org.lahoja.app://auth/callback?code=XXX`. El plugin `@capacitor/app` emite el evento `appUrlOpen`; `DeepLinkHandler` en `App.tsx` extrae `pathname + search` y llama a `navigate()` para enrutar dentro de la SPA.
- Maneja cambios de orientación, teclado y tamaño de pantalla (`configChanges`)

### Versiones de SDK (`android/variables.gradle`)

| Variable | Valor |
|----------|-------|
| `minSdkVersion` | 24 (Android 7.0) |
| `compileSdkVersion` | 36 |
| `targetSdkVersion` | 36 |
| `androidxWebkitVersion` | 1.14.0 |
| `cordovaAndroidVersion` | 14.0.1 |

### Dependencias Capacitor (`package.json`)

```
@capacitor/core    ^8.2.0
@capacitor/android ^8.2.0
@capacitor/cli     ^8.2.0
@capacitor/app     ^8.1.0
```

---

## Flujo de build

```bash
# 1. Build de la SPA
npm run build          # genera dist/

# 2. Sincronizar assets a Android (solo si no usas server.url)
npx cap sync android

# 3. Compilar APK / AAB desde Android Studio o línea de comandos
cd android
./gradlew assembleDebug          # APK debug
./gradlew bundleRelease          # AAB para Play Store
```

> Con `server.url` configurado, el APK no empaqueta los assets web — los descarga desde internet en tiempo de ejecución. Esto significa que actualizar la web en Cloudflare actualiza automáticamente la app sin publicar una nueva versión en Play Store.

---

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `capacitor.config.ts` | Configuración principal de Capacitor |
| `android/app/src/main/java/org/lahoja/app/MainActivity.java` | Activity principal (extiende BridgeActivity) |
| `android/app/src/main/AndroidManifest.xml` | Permisos, intent-filters, FileProvider |
| `android/variables.gradle` | Versiones de SDK y dependencias AndroidX |
| `android/app/build.gradle` | Configuración del módulo app |
| `android/build.gradle` | Configuración raíz del proyecto Gradle |
| `android/gradle/wrapper/gradle-wrapper.properties` | Versión de Gradle (8.13.0) |
