import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme';

export default function CreateAccountScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!email.trim() || !password || !confirm) {
      Alert.alert('Error', 'Fill all fields');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 12) {
      Alert.alert('Error', 'Password must be at least 12 characters');
      return;
    }
    setLoading(true);
    try {
      await SecureStore.setItemAsync('vault_manager_auth', JSON.stringify({
        email: email.trim(),
        password,
        createdAt: new Date().toISOString(),
      }));
      await SecureStore.setItemAsync('vault_user', email.trim());
      navigation.replace('Dashboard');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create account');
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
        <Text style={styles.title}>Create Account</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textGray}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 12 chars)"
            placeholderTextColor={colors.textGray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.textGray}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? '...' : 'Create Account'}</Text>
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
