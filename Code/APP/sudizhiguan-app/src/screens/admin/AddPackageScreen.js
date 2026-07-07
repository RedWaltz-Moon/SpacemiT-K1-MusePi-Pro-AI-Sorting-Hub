import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { addPackage, getSlots } from '../../api';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

const CATEGORIES = ['日常生活用品', '衣服', '食品', '电子产品', '书籍', '保密发货', '其他'];

export default function AddPackageScreen() {
  const [tracking, setTracking] = useState('');
  const [phone,    setPhone]    = useState('');
  const [goods,    setGoods]    = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [slots,    setSlots]    = useState([]);
  const [loading,  setLoading]  = useState(false);

  useFocusEffect(useCallback(() => {
    getSlots().then(r => { if (Array.isArray(r)) setSlots(r); });
  }, []));

  async function handleSubmit() {
    if (!tracking || !phone || !location) { Alert.alert('提示', '单号、手机号、格口为必填项'); return; }
    setLoading(true);
    try {
      const res = await addPackage({ tracking_number: tracking, phone_suffix: phone, goods, category, location: parseInt(location) });
      if (res.error) { Alert.alert('失败', res.error); return; }
      Alert.alert('成功', '包裹入库成功');
      setTracking(''); setPhone(''); setGoods(''); setCategory(''); setLocation('');
      getSlots().then(r => { if (Array.isArray(r)) setSlots(r); });
    } catch (_) {
      Alert.alert('错误', '网络异常，请重试');
    } finally {
      setLoading(false);
    }
  }

  const freeSlots = slots.filter(s => s.state === 1);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>手动入库</Text>

        <Text style={s.label}>快递单号 *</Text>
        <TextInput style={s.input} value={tracking} onChangeText={setTracking} placeholder="扫描或手动输入" />

        <Text style={s.label}>收件人手机号 *</Text>
        <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="11位手机号" keyboardType="number-pad" />

        <Text style={s.label}>物品信息</Text>
        <TextInput style={s.input} value={goods} onChangeText={setGoods} placeholder="如：iPhone 15" />

        <Text style={s.label}>分类</Text>
        <View style={s.chips}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>存放格口 * （空闲格口：{freeSlots.map(s => s.id).join('、') || '无'}）</Text>
        <View style={s.slotGrid}>
          {slots.map(slot => (
            <TouchableOpacity
              key={slot.id}
              disabled={slot.state === 0}
              style={[s.slotBtn, slot.state === 0 ? s.slotOcc : s.slotFree, location === String(slot.id) && s.slotSelected]}
              onPress={() => setLocation(String(slot.id))}
            >
              <Text style={[s.slotText, slot.state === 0 ? s.slotTextOcc : s.slotTextFree]}>
                {slot.id} 号{slot.state === 0 ? '\n已占用' : '\n空闲'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>确认入库</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e1b4b', marginBottom: 16 },
  label: { fontSize: 13, color: '#6b7280', marginTop: 14, marginBottom: 6 },
  input: { height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, borderColor: '#e5e7eb' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slotBtn: { width: '30%', height: 64, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  slotFree: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  slotOcc: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  slotSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  slotText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  slotTextFree: { color: '#111827' },
  slotTextOcc: { color: '#9ca3af' },
  btn: { height: 52, backgroundColor: '#4f46e5', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
