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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const stored = JSON.parse(await SecureStore.getItemAsync('vault_manager_auth') || '{}');
      if (stored.email === email.trim() && stored.password === password) {
        await SecureStore.setItemAsync('vault_user', email.trim());
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Error', 'Invalid email or password');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = () => {
    navigation.navigate('CreateAccount');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.neonBg} />
      <View style={styles.content}>
        <Text style={styles.logo}>THE MURDERER'S LOCK</Text>
        <Text style={styles.subtitle}>Quantum-Resistant Security Vault</Text>

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
            placeholder="Password"
            placeholderTextColor={colors.textGray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? '...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={handleCreateAccount}>
            <Text style={styles.linkText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  neonBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
  },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: {
    fontSize: 24, fontWeight: '900', textAlign: 'center', color: colors.neonCyan,
    marginBottom: 8,
  },
  subtitle: { fontSize: 12, color: colors.textGray, textAlign: 'center', marginBottom: 48 },
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
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.neonCyan, fontSize: 14 },
});
