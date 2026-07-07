import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Alert,
  TextInput, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getAnomalies, updateAnomaly, deleteAnomaly } from '../../api';

const TYPE_LABEL  = { inbound: '入库', outbound: '出库' };
const TYPE_COLOR  = { inbound: { bg: '#dbeafe', text: '#1d4ed8' }, outbound: { bg: '#ffedd5', text: '#c2410c' } };
const STATUS_LABEL = { pending: '待处理', resolved: '已处理' };
const STATUS_COLOR = { pending: { bg: '#fef3c7', text: '#92400e' }, resolved: { bg: '#d1fae5', text: '#065f46' } };

function Badge({ value, colorMap, labelMap }) {
  const c = colorMap[value] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <View style={[bd.wrap, { backgroundColor: c.bg }]}>
      <Text style={[bd.text, { color: c.text }]}>{labelMap[value] ?? value}</Text>
    </View>
  );
}
const bd = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});

export default function AnomalyScreen() {
  const [anomalies,  setAnomalies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search,     setSearch]     = useState('');
  const [editItem,   setEditItem]   = useState(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editDesc,   setEditDesc]   = useState('');
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getAnomalies();
      if (Array.isArray(res)) setAnomalies(res);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayed = anomalies.filter(a => {
    if (typeFilter   !== 'all' && a.type   !== typeFilter)   return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (a.tracking_number || '').toLowerCase().includes(q) ||
             (a.phone_suffix    || '').includes(q) ||
             (a.description     || '').toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount  = anomalies.filter(a => a.status === 'pending').length;
  const resolvedCount = anomalies.filter(a => a.status === 'resolved').length;

  function openEdit(item) {
    setEditItem(item);
    setEditStatus(item.status);
    setEditDesc(item.description || '');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateAnomaly({ id: editItem.id, status: editStatus, description: editDesc });
      if (res.error) { Alert.alert('失败', res.error); return; }
      setEditItem(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    Alert.alert(
      '确认删除',
      `删除工单 #${item.id}（${TYPE_LABEL[item.type] ?? item.type}异常）？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive', onPress: async () => {
            const res = await deleteAnomaly(item.id);
            if (res.error) Alert.alert('失败', res.error);
            else load();
          },
        },
      ]
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#dc2626" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <LinearGradient colors={['#7f1d1d', '#dc2626']} style={s.header}>
        <Text style={s.headerTitle}>异常处理</Text>
        <Text style={s.headerSub}>工单管理 · 实时跟踪</Text>
      </LinearGradient>

      {/* Stat row */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: '#fef3c7' }]}>
          <Text style={[s.statNum, { color: '#92400e' }]}>{pendingCount}</Text>
          <Text style={s.statLabel}>待处理</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#d1fae5' }]}>
          <Text style={[s.statNum, { color: '#065f46' }]}>{resolvedCount}</Text>
          <Text style={s.statLabel}>已处理</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#f3f4f6' }]}>
          <Text style={[s.statNum, { color: '#374151' }]}>{anomalies.length}</Text>
          <Text style={s.statLabel}>全部</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="搜索单号 / 手机号 / 描述"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        {[['all','全部类型'],['inbound','入库'],['outbound','出库']].map(([v, label]) => (
          <TouchableOpacity
            key={v}
            style={[s.chip, typeFilter === v && s.chipActive]}
            onPress={() => setTypeFilter(v)}
          >
            <Text style={[s.chipText, typeFilter === v && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={s.divider} />
        {[['all','全部状态'],['pending','待处理'],['resolved','已处理']].map(([v, label]) => (
          <TouchableOpacity
            key={v}
            style={[s.chip, statusFilter === v && s.chipActive]}
            onPress={() => setStatusFilter(v)}
          >
            <Text style={[s.chipText, statusFilter === v && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={displayed}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <Text style={s.listHeader}>共 {displayed.length} 条工单</Text>
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={s.emptyText}>暂无异常工单</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.card, item.status === 'pending' && s.cardPending]}>
            <View style={s.cardTop}>
              <View style={s.badgeRow}>
                <Badge value={item.type}   colorMap={TYPE_COLOR}   labelMap={TYPE_LABEL} />
                <Badge value={item.status} colorMap={STATUS_COLOR} labelMap={STATUS_LABEL} />
              </View>
              <Text style={s.idText}>#{item.id}</Text>
            </View>

            {item.tracking_number
              ? <Text style={s.trackNo} numberOfLines={1}>{item.tracking_number}</Text>
              : null}
            {item.phone_suffix
              ? <Text style={s.phone}>{item.phone_suffix}</Text>
              : null}
            {item.raw_text
              ? <Text style={s.goods} numberOfLines={1}>{item.raw_text}</Text>
              : null}
            {item.location
              ? <Text style={s.location}>{item.location} 号格口</Text>
              : null}
            {item.description
              ? <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
              : null}

            <Text style={s.time}>{item.created_at}</Text>

            <View style={s.actions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(item)}>
                <Text style={s.editText}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
                <Text style={s.deleteText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Edit modal */}
      <Modal visible={!!editItem} animationType="slide" transparent>
        <View style={m.overlay}>
          <View style={m.card}>
            <Text style={m.title}>编辑工单 #{editItem?.id}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status toggle */}
              <Text style={m.label}>处理状态</Text>
              <View style={m.toggleRow}>
                {[['pending','待处理'],['resolved','已处理']].map(([v, label]) => (
                  <TouchableOpacity
                    key={v}
                    style={[m.toggleBtn, editStatus === v && m.toggleActive]}
                    onPress={() => setEditStatus(v)}
                  >
                    <Text style={[m.toggleText, editStatus === v && m.toggleTextActive]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description */}
              <Text style={m.label}>异常描述</Text>
              <TextInput
                style={m.descInput}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="记录处理过程或异常说明…"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={m.btns}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setEditItem(null)} disabled={saving}>
                <Text style={m.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={m.saveText}>保存</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#f5f5f5' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  statsRow:  { flexDirection: 'row', gap: 10, padding: 12 },
  statCard:  { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum:   { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  searchWrap:  { paddingHorizontal: 12, paddingBottom: 6 },
  searchInput: { height: 40, alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, borderWidth: 1, borderColor: '#e5e7eb', color: '#111827' },

  filterRow:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, paddingBottom: 8, alignItems: 'center' },
  chip:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive:  { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  chipText:    { fontSize: 12, color: '#6b7280' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  divider:     { width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 2 },

  list:       { paddingHorizontal: 12, paddingBottom: 24 },
  listHeader: { fontSize: 13, color: '#9ca3af', marginBottom: 8 },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 15, color: '#9ca3af' },

  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  cardPending: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badgeRow:    { flexDirection: 'row', gap: 6 },
  idText:      { fontSize: 12, color: '#9ca3af' },
  trackNo:     { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2 },
  phone:       { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  goods:       { fontSize: 13, color: '#374151', marginBottom: 2 },
  location:    { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  desc:        { fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 18 },
  time:        { fontSize: 11, color: '#d1d5db', marginTop: 6 },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn:     { flex: 1, height: 34, backgroundColor: '#fee2e2', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editText:    { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  deleteBtn:   { flex: 1, height: 34, backgroundColor: '#f3f4f6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteText:  { color: '#6b7280', fontWeight: '600', fontSize: 13 },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card:       { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '75%' },
  title:      { fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 16 },
  label:      { fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 6 },
  toggleRow:  { flexDirection: 'row', gap: 10 },
  toggleBtn:  { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  toggleActive:     { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  toggleText:       { fontSize: 14, color: '#374151', fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '700' },
  descInput:  { height: 100, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingTop: 10, fontSize: 14, backgroundColor: '#fafafa' },
  btns:       { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:  { flex: 1, height: 46, backgroundColor: '#f3f4f6', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: '#374151', fontWeight: '600' },
  saveBtn:    { flex: 1, height: 46, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveText:   { color: '#fff', fontWeight: '600' },
});
