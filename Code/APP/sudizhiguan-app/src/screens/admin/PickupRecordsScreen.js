import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPackages, revertPickup } from '../../api';

export default function PickupRecordsScreen() {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getPackages(1);
      if (Array.isArray(res)) setRecords(res);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayList = search
    ? records.filter(p => {
        const q = search.toLowerCase();
        return p.tracking_number.toLowerCase().includes(q) ||
               (p.phone_suffix || '').includes(q);
      })
    : records;

  function handleRevert(item) {
    Alert.alert(
      '撤销取件',
      `将 ${item.tracking_number} 恢复为在库？\n（用于纠正误操作）`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认恢复',
          onPress: () => doRevert(item),
        },
      ]
    );
  }

  async function doRevert(item) {
    console.log('[doRevert] id=', item.id);
    try {
      const res = await revertPickup(item.id);
      console.log('[doRevert] response', JSON.stringify(res));
      // 用 setTimeout 确保 Android 上第一个 Alert 完全关闭后再弹第二个
      if (res && res.error) {
        setTimeout(() => Alert.alert('撤销失败', res.error), 300);
      } else if (res && res.success) {
        load();
        setTimeout(() => Alert.alert('已恢复', '包裹已重新标记为在库'), 300);
      } else {
        setTimeout(() => Alert.alert('异常', '服务器返回未知结果'), 300);
      }
    } catch (e) {
      console.log('[doRevert] error', e);
      setTimeout(() => Alert.alert('网络错误', '请检查网络后重试'), 300);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          placeholder="搜索单号 / 手机号"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={displayList}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.header}>取件记录（{displayList.length}）</Text>}
        ListEmptyComponent={<Text style={s.empty}>暂无取件记录</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.trackNo} numberOfLines={1}>{item.tracking_number}</Text>
              <View style={s.badge}><Text style={s.badgeText}>已取走</Text></View>
            </View>
            <Text style={s.phone}>{item.phone_suffix}</Text>
            {item.raw_text  ? <Text style={s.desc}>{item.raw_text}</Text>  : null}
            {item.category  ? <Text style={s.tag}>分类：{item.category}</Text> : null}
            <Text style={s.time}>入库：{item.created_at}</Text>
            <TouchableOpacity style={s.revertBtn} onPress={() => handleRevert(item)}>
              <Text style={s.revertText}>撤销取件（纠正误取）</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#f5f5f5' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar:   { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchInput: { height: 40, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  list:        { padding: 16 },
  header:      { fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginBottom: 10 },
  empty:       { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 15 },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  trackNo:     { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  badge:       { backgroundColor: '#d1fae5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:   { color: '#065f46', fontSize: 12, fontWeight: '600' },
  phone:       { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  desc:        { fontSize: 14, color: '#374151', marginBottom: 2 },
  tag:         { fontSize: 12, color: '#9ca3af' },
  time:        { fontSize: 12, color: '#d1d5db', marginTop: 4 },
  revertBtn:   { marginTop: 10, height: 36, backgroundColor: '#fef3c7', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  revertText:  { color: '#92400e', fontWeight: '600', fontSize: 13 },
});
