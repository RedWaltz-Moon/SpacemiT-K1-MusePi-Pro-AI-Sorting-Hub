import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { API } from '../config';

const WELCOME = '你好！我是 K1 快递站 AI 助手。\n可以帮你查包裹、预约取件或处理异常，请告诉我你的需求~';
const CHAT_PORT = 8765;

async function getK1URL() {
  const res = await fetch(`${API}/register_device.php`, { cache: 'no-store' });
  const { ip } = await res.json();
  if (!ip) throw new Error('K1 不在线，请确认设备已连接同一网络');
  return `http://${ip}:${CHAT_PORT}`;
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[b.row, isUser ? b.rowUser : b.rowBot]}>
      {!isUser && <View style={b.avatar}><Text style={b.avatarText}>🤖</Text></View>}
      <View style={[b.bubble, isUser ? b.bubbleUser : b.bubbleBot]}>
        <Text style={[b.text, isUser ? b.textUser : b.textBot]}>{msg.content}</Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row:        { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  rowUser:    { justifyContent: 'flex-end' },
  rowBot:     { justifyContent: 'flex-start' },
  avatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ede9fe', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  avatarText: { fontSize: 16 },
  bubble:     { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#4f46e5', borderBottomRightRadius: 4 },
  bubbleBot:  { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  text:       { fontSize: 15, lineHeight: 22 },
  textUser:   { color: '#fff' },
  textBot:    { color: '#1f2937' },
});

export default function AIChatScreen() {
  const [messages,  setMessages]  = useState([{ role: 'assistant', content: WELCOME }]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const sessionRef = useRef(null);
  const listRef    = useRef(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const url = await getK1URL();
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionRef.current || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.session_id) sessionRef.current = data.session_id;
      const reply = data.reply ?? data.error ?? '（无响应）';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      Alert.alert('连接失败', `${e.message}`);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading]);

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={['#1e1b4b', '#4338ca']} style={s.header}>
        <Text style={s.title}>AI 助手</Text>
        <Text style={s.sub}>局域网 · K1 本地推理</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <Bubble msg={item} />}
          ListFooterComponent={
            loading ? (
              <View style={s.typingRow}>
                <View style={b.avatar}><Text style={b.avatarText}>🤖</Text></View>
                <View style={[b.bubbleBot, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                  <ActivityIndicator size="small" color="#4f46e5" />
                </View>
              </View>
            ) : null
          }
        />

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="输入消息…"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={300}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && s.sendBtnDim]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Text style={s.sendText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#f5f5f5' },
  flex:       { flex: 1 },
  header:     { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  title:      { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub:        { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  list:       { padding: 14, paddingBottom: 8 },
  typingRow:  { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  inputRow:   { flexDirection: 'row', alignItems: 'flex-end', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  input:      { flex: 1, minHeight: 42, maxHeight: 110, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827' },
  sendBtn:    { height: 42, paddingHorizontal: 16, backgroundColor: '#4f46e5', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendBtnDim: { backgroundColor: '#c7d2fe' },
  sendText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});
