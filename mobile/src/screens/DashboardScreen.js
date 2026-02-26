import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const VAULTS_KEY = 'vault_manager_vaults';

export default function DashboardScreen({ navigation }) {
  const [vaults, setVaults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadVaults = async () => {
    try {
      const raw = await AsyncStorage.getItem(VAULTS_KEY);
      setVaults(raw ? JSON.parse(raw) : []);
    } catch {
      setVaults([]);
    }
  };

  useEffect(() => {
    loadVaults();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVaults();
    setRefreshing(false);
  };

  const handleCreateVault = () => {
    navigation.navigate('CreateVault');
  };

  const handleVaultPress = (vault) => {
    navigation.navigate('Vault', { vaultId: vault.id });
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('vault_user');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>THE MURDERER'S LOCK</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Your Vaults</Text>

      <FlatList
        data={vaults}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neonCyan} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No vaults yet</Text>
            <Text style={styles.emptySub}>Create one or sync from web</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.vaultCard}
            onPress={() => handleVaultPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.vaultIcon}>
              <Text style={styles.vaultEmoji}>🔐</Text>
            </View>
            <View style={styles.vaultInfo}>
              <Text style={styles.vaultName}>{item.name}</Text>
              <Text style={styles.vaultId}>ID: {item.id?.slice(0, 8)}...</Text>
              <Text style={[styles.vaultStatus, item.locked !== false && styles.locked]}>
                {item.locked !== false ? '🔒 Locked' : '🔓 Unlocked'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateVault}>
        <Text style={styles.fabText}>+ Create Vault</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 48 },
  logo: { fontSize: 18, fontWeight: '900', color: colors.neonCyan },
  logout: { color: colors.textGray, fontSize: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.textWhite, paddingHorizontal: 24, marginBottom: 16 },
  vaultCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 16, 240, 0.2)',
  },
  vaultIcon: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderWidth: 2, borderColor: colors.neonCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  vaultEmoji: { fontSize: 28 },
  vaultInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  vaultName: { fontSize: 18, fontWeight: '700', color: colors.textWhite },
  vaultId: { fontSize: 12, color: colors.textGray, marginTop: 4 },
  vaultStatus: { fontSize: 12, color: colors.neonLime, marginTop: 4 },
  locked: { color: colors.neonOrange },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { fontSize: 18, color: colors.textGray },
  emptySub: { fontSize: 14, color: colors.textGray, marginTop: 8 },
  fab: {
    position: 'absolute',
    bottom: 32, left: 24, right: 24,
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    borderWidth: 2, borderColor: colors.neonCyan,
    borderRadius: 16, padding: 20,
    alignItems: 'center',
  },
  fabText: { color: colors.neonCyan, fontWeight: '700', fontSize: 16 },
});
