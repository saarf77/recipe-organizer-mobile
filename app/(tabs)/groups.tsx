import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/features/groups/groupStore';
import { Group } from '@/types';
import { Colors, Spacing, Radii, FontFamily } from '@/constants';

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
          <Text style={{ color: group.editing_mode === 'collaborative' ? Colors.privateGreen : Colors.primaryMid }}>
            {group.editing_mode === 'collaborative' ? 'Collaborative' : 'Strict'}
          </Text>
        </Text>
        {group.my_role && (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{group.my_role}</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.textFaint} />
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
          <Ionicons name="add" size={22} color={Colors.bgWhite} />
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
  container: { flex: 1, backgroundColor: Colors.bgSurface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.lg },
  title: { fontSize: 28, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  newBtn: { backgroundColor: Colors.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, paddingBottom: 120 },
  card: { backgroundColor: Colors.bgWhite, borderRadius: Radii.lg, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardIconWrap: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 22, fontFamily: FontFamily.bold, color: Colors.primary },
  cardContent: { flex: 1 },
  cardName: { fontSize: 16, fontFamily: FontFamily.semibold, color: Colors.textPrimary },
  cardMeta: { fontSize: 13, fontFamily: FontFamily.regular, color: Colors.textFaint, marginTop: 2 },
  roleBadge: { marginTop: Spacing.xs, backgroundColor: Colors.bgMuted, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radii.sm, alignSelf: 'flex-start' },
  roleText: { fontSize: 11, fontFamily: FontFamily.medium, color: Colors.textSecondary, textTransform: 'capitalize' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: Colors.textPrimary },
  emptySub: { fontSize: 14, fontFamily: FontFamily.regular, color: Colors.textFaint, textAlign: 'center', marginTop: Spacing.sm, marginBottom: 20 },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: Radii.md, minHeight: 44 },
  createBtnText: { color: Colors.bgWhite, fontFamily: FontFamily.semibold, fontSize: 15 },
});
