import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { queryGuest } from '../api';

export default function GuestQueryScreen({ navigation }) {
  const [phone,    setPhone]    = useState('');
  const [result,   setResult]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [queried,  setQueried]  = useState(false);

  async function handleQuery() {
    if (phone.length < 7) { setError('请输入完整手机号'); return; }
    setLoading(true); setError(''); setQueried(false);
    try {
      const res = await queryGuest(phone);
      if (res.error) { setError(res.error); setResult([]); }
      else { setResult(res); setQueried(true); }
    } catch (e) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <View style={s.container}>
          <Text style={s.title}>游客查件</Text>
          <Text style={s.sub}>无需登录，输入手机号查询在库包裹</Text>

          <View style={s.row}>
            <TextInput
              style={s.input} placeholder="请输入手机号"
              keyboardType="number-pad" value={phone}
              onChangeText={setPhone} onSubmitEditing={handleQuery}
            />
            <TouchableOpacity style={s.btn} onPress={handleQuery} disabled={loading}>
              <Text style={s.btnText}>查询</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}
          {loading && <ActivityIndicator color="#4f46e5" style={{ marginTop: 20 }} />}
          {queried && !loading && (
            <Text style={s.count}>{result.length === 0 ? '暂无在库包裹' : `共 ${result.length} 件包裹`}</Text>
          )}

          <FlatList
            data={result}
            keyExtractor={item => String(item.id)}
            style={{ marginTop: 8, width: '100%' }}
            renderItem={({ item }) => (
              <View style={s.card}>
                <View style={s.row2}>
                  <Text style={s.trackNo}>{item.tracking_number}</Text>
                  <View style={s.badge}><Text style={s.badgeText}>{item.location} 号格口</Text></View>
                </View>
                {item.raw_text ? <Text style={s.desc}>{item.raw_text}</Text> : null}
                {item.category ? <Text style={s.tag}>分类：{item.category}</Text> : null}
                <Text style={s.time}>入库：{item.created_at}</Text>
              </View>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f0f7' },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e1b4b', marginBottom: 4 },
  sub: { fontSize: 13, color: '#6b7280', marginBottom: 24 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, height: 48, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, borderColor: '#e5e7eb' },
  btn: { width: 72, height: 48, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  count: { fontSize: 13, color: '#6b7280', marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  row2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackNo: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  badge: { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  desc: { fontSize: 14, color: '#374151', marginBottom: 2 },
  tag: { fontSize: 12, color: '#9ca3af' },
  time: { fontSize: 12, color: '#d1d5db', marginTop: 4 },
});
