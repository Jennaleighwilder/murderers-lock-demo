import React, { useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const VAULTS_KEY = 'vault_manager_vaults';

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CreateVaultScreen({ navigation }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || !password) {
      Alert.alert('Error', 'Enter vault name and password');
      return;
    }
    if (password.length < 12) {
      Alert.alert('Error', 'Password must be at least 12 characters');
      return;
    }
    setLoading(true);
    try {
      const id = uuid();
      const vaults = JSON.parse(await AsyncStorage.getItem(VAULTS_KEY) || '[]');
      vaults.push({
        id,
        name: name.trim(),
        locked: true,
        murderCount: 0,
        lockjawEngaged: false,
      });
      await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
      // Store encrypted placeholder - real encryption would call API
      await AsyncStorage.setItem(
        `vault_data_${id}`,
        JSON.stringify({ salt: '', iv: '', encryptedData: '', secrets: '' })
      );
      navigation.replace('Vault', { vaultId: id });
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create Vault</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Vault name"
            placeholderTextColor={colors.textGray}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Master password (min 12 chars)"
            placeholderTextColor={colors.textGray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? '...' : 'Create Vault'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.neonCyan, textAlign: 'center', marginBottom: 32 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    padding: 32,
    borderWidth: 2,
    borderColor: 'rgba(255, 16, 240, 0.2)',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255, 16, 240, 0.3)',
    borderRadius: 12,
    padding: 16,
    color: colors.textWhite,
    marginBottom: 16,
    fontSize: 16,
  },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnPrimary: {
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    borderWidth: 2,
    borderColor: colors.neonCyan,
  },
  btnText: { color: colors.neonCyan, fontWeight: '700', fontSize: 16 },
});
