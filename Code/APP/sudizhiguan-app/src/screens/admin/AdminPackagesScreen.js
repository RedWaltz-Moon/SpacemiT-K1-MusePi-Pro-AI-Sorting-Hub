import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Alert,
  TextInput, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPackages, deletePackage, updatePackage } from '../../api';

export default function AdminPackagesScreen({ navigation }) {
  const [packages,   setPackages]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [editItem,   setEditItem]   = useState(null);
  const [editData,   setEditData]   = useState({});

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getPackages(0);
      if (Array.isArray(res)) setPackages(res);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const displayList = search
    ? packages.filter(p => {
        const q = search.toLowerCase();
        return p.tracking_number.toLowerCase().includes(q) ||
               (p.phone_suffix || '').includes(q) ||
               (p.category || '').includes(q);
      })
    : packages;

  function openEdit(item) {
    setEditItem(item);
    setEditData({
      id: item.id,
      tracking_number: item.tracking_number,
      phone_suffix: item.phone_suffix,
      goods: item.raw_text,
      category: item.category,
      location: String(item.location),
    });
  }

  async function handleSave() {
    const res = await updatePackage({
      ...editData,
      location: parseInt(editData.location),
    });
    if (res.error) { Alert.alert('失败', res.error); return; }
    setEditItem(null);
    load();
  }

  async function handleDelete(item) {
    Alert.alert('确认删除', `删除单号 ${item.tracking_number}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          const res = await deletePackage(item.id);
          if (res.error) Alert.alert('失败', res.error);
          else load();
        },
      },
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          placeholder="搜索单号 / 手机号 / 分类"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={displayList}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={<Text style={s.header}>在库包裹（{displayList.length}）</Text>}
        ListEmptyComponent={<Text style={s.empty}>暂无在库包裹</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.trackNo} numberOfLines={1}>{item.tracking_number}</Text>
              <View style={s.badge}><Text style={s.badgeText}>{item.location} 号格口</Text></View>
            </View>
            <Text style={s.phone}>{item.phone_suffix}</Text>
            {item.raw_text  ? <Text style={s.desc}>{item.raw_text}</Text>  : null}
            {item.category  ? <Text style={s.tag}>分类：{item.category}</Text> : null}
            <Text style={s.time}>入库：{item.created_at}</Text>
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

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AddPackage')}>
        <Text style={s.fabText}>＋</Text>
      </TouchableOpacity>

      <Modal visible={!!editItem} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>编辑包裹</Text>
            <ScrollView>
              {[
                ['快递单号', 'tracking_number'],
                ['手机号',   'phone_suffix'],
                ['物品信息', 'goods'],
                ['分类',     'category'],
                ['格口(1-6)','location'],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={s.label}>{label}</Text>
                  <TextInput
                    style={s.modalInput}
                    value={editData[key] || ''}
                    onChangeText={v => setEditData(d => ({ ...d, [key]: v }))}
                    keyboardType={key === 'location' ? 'number-pad' : 'default'}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditItem(null)}>
                <Text style={s.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f5f5f5' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar:    { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchInput:  { height: 40, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  list:         { padding: 16 },
  header:       { fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginBottom: 10 },
  empty:        { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 15 },
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  trackNo:      { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  badge:        { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:    { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  phone:        { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  desc:         { fontSize: 14, color: '#374151', marginBottom: 2 },
  tag:          { fontSize: 12, color: '#9ca3af' },
  time:         { fontSize: 12, color: '#d1d5db', marginTop: 4 },
  actions:      { flexDirection: 'row', gap: 8, marginTop: 10 },
  editBtn:      { flex: 1, height: 36, backgroundColor: '#ede9fe', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editText:     { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  deleteBtn:    { flex: 1, height: 36, backgroundColor: '#fee2e2', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  deleteText:   { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  fab:          { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText:      { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 16 },
  label:        { fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 4 },
  modalInput:   { height: 44, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  modalBtns:    { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:    { flex: 1, height: 46, backgroundColor: '#f3f4f6', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText:   { color: '#374151', fontWeight: '600' },
  saveBtn:      { flex: 1, height: 46, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  saveText:     { color: '#fff', fontWeight: '600' },
});
