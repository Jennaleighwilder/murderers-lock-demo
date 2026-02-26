# Autofill Integration

## iOS - Password AutoFill

1. **Associated Domains** (app.json / app.config.js):
   ```json
   "associatedDomains": ["webcredentials:yourdomain.com"]
   ```

2. **Enable AutoFill** in Xcode:
   - Signing & Capabilities → + Capability → Associated Domains
   - Add `webcredentials:your-app.vercel.app`

3. **Credential Provider** - Use `expo-secure-store` with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` for items you want in AutoFill.

4. **ASAuthorizationPasswordRequest** - For native AutoFill UI, you'd add a custom native module. Expo doesn't include this; consider a development build with `expo-dev-client`.

## Android - Autofill Service

1. **Create Autofill Service** (requires native code / dev build):
   - `AndroidManifest.xml`: Declare `android.autofill` service
   - Implement `AutofillService` to provide credentials when apps request them

2. **Expo config plugin** - For managed workflow, autofill typically requires a custom dev build:
   ```bash
   eas build --profile development --platform android
   ```

3. **Data format** - Store credentials in a format compatible with `AutofillManager` (URL, username, password).

## MVP Status

- **Biometric unlock**: ✅ Implemented (Face ID, Touch ID, fingerprint)
- **Autofill**: Requires native modules / development build. Use `expo prebuild` + custom native code, or EAS Build with config plugins.
