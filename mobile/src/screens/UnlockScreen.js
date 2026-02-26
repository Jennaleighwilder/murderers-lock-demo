import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const VAULTS_KEY = 'vault_manager_vaults';
const VAULT_DATA_PREFIX = 'vault_data_';

export default function UnlockScreen({ route, navigation }) {
  const { vaultId, vault } = route.params;
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
      setBiometricAvailable(types.length > 0);
    });
  }, []);

  const handleUnlock = async () => {
    if (!password) {
      Alert.alert('Error', 'Enter password');
      return;
    }
    setLoading(true);
    try {
      // MVP: decrypt locally or call API
      // For demo, accept password and mark unlocked
      const vaults = JSON.parse(await AsyncStorage.getItem(VAULTS_KEY) || '[]');
      const idx = vaults.findIndex((v) => v.id === vaultId);
      if (idx >= 0) {
        vaults[idx].locked = false;
        await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
      }
      navigation.replace('Vault', { vaultId });
    } catch (e) {
      Alert.alert('Error', e.message || 'Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock vault with biometrics',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      // Use stored password from SecureStore if previously saved
      const storedPw = await SecureStore.getItemAsync(`vault_pw_${vaultId}`);
      if (storedPw) {
        setPassword(storedPw);
        // Auto-unlock on next render or we could call handleUnlock
        Alert.alert('Biometric OK', 'Enter password to complete (or use saved)');
      } else {
        Alert.alert('Info', 'Set password first, then enable biometric unlock');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{vault?.name}</Text>
        <Text style={styles.subtitle}>Enter password to unlock</Text>

        {biometricAvailable && (
          <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
            <Text style={styles.biometricText}>🔐 Use Face ID / Touch ID</Text>
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textGray}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="2FA code (if enabled)"
          placeholderTextColor={colors.textGray}
          value={totp}
          onChangeText={setTotp}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleUnlock}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? '...' : 'Unlock'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.neonCyan, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: colors.textGray, textAlign: 'center', marginBottom: 32 },
  biometricBtn: {
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderWidth: 2, borderColor: colors.neonCyan,
    borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24,
  },
  biometricText: { color: colors.neonCyan, fontWeight: '600' },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 2, borderColor: 'rgba(255, 16, 240, 0.3)',
    borderRadius: 12, padding: 16, color: colors.textWhite,
    marginBottom: 16, fontSize: 16,
  },
  btn: { padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  btnPrimary: {
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    borderWidth: 2, borderColor: colors.neonCyan,
  },
  btnText: { color: colors.neonCyan, fontWeight: '700', fontSize: 18 },
});
