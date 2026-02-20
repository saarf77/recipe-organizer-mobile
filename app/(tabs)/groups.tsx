import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/features/groups/groupStore';
import { Group } from '@/types';

function GroupItem({ group }: { group: Group }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/group/${group.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open group ${group.name}`}
    >
      <View style={styles.cardIconWrap}>
        <Text style={styles.cardIcon}>{group.name[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{group.name}</Text>
        <Text style={styles.cardMeta}>
          {group.member_count ?? 0} member{group.member_count !== 1 ? 's' : ''} ·{' '}
          <Text style={{ color: group.editing_mode === 'collaborative' ? '#22c55e' : '#f97316' }}>
            {group.editing_mode === 'collaborative' ? 'Collaborative' : 'Strict'}
          </Text>
        </Text>
        {group.my_role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{group.my_role}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  const { groups, isLoading, loadAll } = useGroupStore();

  useEffect(() => { loadAll(); }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/group/new')}
          accessibilityLabel="Create new group"
        >
          <Ionicons name="add" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <GroupItem group={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👨‍👩‍👧‍👦</Text>
              <Text style={styles.emptyTitle}>No groups yet</Text>
              <Text style={styles.emptySub}>Create a group to share recipes with family or friends</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/group/new')}>
                <Text style={styles.createBtnText}>Create a Group</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#0f172a' },
  newBtn: { backgroundColor: '#f97316', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 120 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#f97316' },
  cardContent: { flex: 1 },
  cardName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a' },
  cardMeta: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 2 },
  roleBadge: { marginTop: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  roleText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#475569', textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0f172a' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94a3b8', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  createBtn: { backgroundColor: '#f97316', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, minHeight: 44 },
  createBtnText: { color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
