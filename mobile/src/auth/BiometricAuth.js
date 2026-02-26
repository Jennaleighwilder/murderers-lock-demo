/**
 * Biometric authentication - Face ID, Touch ID, fingerprint
 */
import * as LocalAuthentication from 'expo-local-authentication';

export async function isBiometricAvailable() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types.length > 0;
}

export async function getBiometricType() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID / Fingerprint';
  return null;
}

export async function authenticate(reason = 'Unlock your vault') {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
