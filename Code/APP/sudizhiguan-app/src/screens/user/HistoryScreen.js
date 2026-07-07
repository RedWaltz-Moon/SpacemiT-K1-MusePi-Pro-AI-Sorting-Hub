import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, SafeAreaView, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPackages } from '../../api';

export default function HistoryScreen() {
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getPackages(1);
      if (Array.isArray(res)) setPackages(res);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={packages}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.header}>取件历史 ({packages.length})</Text>}
        ListEmptyComponent={<Text style={s.empty}>暂无取件记录</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.trackNo} numberOfLines={1}>{item.tracking_number}</Text>
              <View style={s.doneBadge}><Text style={s.doneBadgeText}>已取走</Text></View>
            </View>
            {item.raw_text ? <Text style={s.desc}>{item.raw_text}</Text> : null}
            {item.category ? <Text style={s.tag}>分类：{item.category}</Text> : null}
            <Text style={s.time}>入库：{item.created_at}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  header: { fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 12 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 15 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackNo: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  doneBadge: { backgroundColor: '#d1fae5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  doneBadgeText: { color: '#065f46', fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 14, color: '#374151', marginBottom: 2 },
  tag: { fontSize: 12, color: '#9ca3af' },
  time: { fontSize: 12, color: '#d1d5db', marginTop: 4 },
});
