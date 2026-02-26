import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const VAULTS_KEY = 'vault_manager_vaults';
const VAULT_DATA_PREFIX = 'vault_data_';

export default function VaultScreen({ route, navigation }) {
  const { vaultId } = route.params;
  const [vault, setVault] = useState(null);
  const [locked, setLocked] = useState(true);
  const [contents, setContents] = useState('');

  useEffect(() => {
    const load = async () => {
      const raw = await AsyncStorage.getItem(VAULTS_KEY);
      const vaults = raw ? JSON.parse(raw) : [];
      const v = vaults.find((x) => x.id === vaultId);
      setVault(v);
      setLocked(v?.locked !== false);
      if (v?.locked === false) {
        const data = await AsyncStorage.getItem(VAULT_DATA_PREFIX + vaultId);
        const parsed = data ? JSON.parse(data) : {};
        setContents(parsed.secrets || '');
      }
    };
    load();
  }, [vaultId]);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.neonCyan, marginLeft: 16 }}>← Back</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (!vault) return <View style={styles.container}><Text style={styles.loading}>Loading...</Text></View>;

  if (locked) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{vault.name}</Text>
        <Text style={styles.subtitle}>Vault is locked</Text>
        <TouchableOpacity
          style={styles.unlockBtn}
          onPress={() => navigation.navigate('Unlock', { vaultId, vault })}
        >
          <Text style={styles.unlockBtnText}>Unlock Vault</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSave = async () => {
    try {
      const data = JSON.parse(await AsyncStorage.getItem(VAULT_DATA_PREFIX + vaultId) || '{}');
      data.secrets = contents;
      await AsyncStorage.setItem(VAULT_DATA_PREFIX + vaultId, JSON.stringify(data));
      Alert.alert('Saved', 'Vault contents saved');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{vault.name}</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.textArea}
        value={contents}
        onChangeText={setContents}
        placeholder="Secrets (label | username | password per line)"
        placeholderTextColor={colors.textGray}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgVoid, padding: 24 },
  loading: { color: colors.textGray, textAlign: 'center', marginTop: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.neonCyan },
  subtitle: { color: colors.textGray, marginBottom: 24 },
  unlockBtn: {
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    borderWidth: 2, borderColor: colors.neonCyan,
    borderRadius: 16, padding: 20, alignItems: 'center',
  },
  unlockBtnText: { color: colors.neonCyan, fontWeight: '700', fontSize: 18 },
  saveBtn: { padding: 8, paddingHorizontal: 16, borderWidth: 2, borderColor: colors.neonLime, borderRadius: 12 },
  saveBtnText: { color: colors.neonLime, fontWeight: '600' },
  textArea: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderWidth: 2, borderColor: 'rgba(255, 16, 240, 0.2)',
    borderRadius: 16, padding: 20,
    color: colors.textWhite, fontSize: 14,
  },
});
