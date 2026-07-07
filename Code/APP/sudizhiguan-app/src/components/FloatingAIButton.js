import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Animated, PanResponder, TouchableOpacity,
  Modal, FlatList, TextInput, StyleSheet, Dimensions,
  Platform, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { API } from '../config';

const { width: SW, height: SH } = Dimensions.get('window');
const BTN      = Math.round(SW / 6);
const CHAT_PORT = 8765;
const WELCOME  = '你好！我是智能快递站 AI 助手，可以帮你查包裹、预约取件或处理异常。';

// ── AI 网络层 ────────────────────────────────────────────────
async function getK1URL() {
  try {
    const res  = await fetch(`${API}/register_device.php`, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ip) throw new Error('K1 不在线，请确认设备已连接同一局域网');
    return `http://${data.ip}:${CHAT_PORT}`;
  } catch (e) {
    if (e.message.startsWith('K1')) throw e;
    throw new Error('无法连接服务器，请检查网络连接');
  }
}

// ── 气泡 ────────────────────────────────────────────────────
function Bubble({ item }) {
  const isUser = item.role === 'user';
  return (
    <View style={[b.row, isUser && b.rowUser]}>
      {!isUser && <View style={b.av}><Text style={b.avTxt}>🦞</Text></View>}
      <View style={[b.bub, isUser ? b.bubUser : b.bubAI]}>
        <Text style={[b.txt, isUser && b.txtUser]}>{item.content}</Text>
      </View>
    </View>
  );
}
const b = StyleSheet.create({
  row:    { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', paddingHorizontal: 12 },
  rowUser:{ flexDirection: 'row-reverse' },
  av:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ede9fe',
            justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  avTxt:  { fontSize: 14 },
  bub:    { maxWidth: '76%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubAI:  { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  bubUser:{ backgroundColor: '#4f46e5' },
  txt:    { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  txtUser:{ color: '#fff' },
});

// ── 主组件 ───────────────────────────────────────────────────
export default function FloatingAIButton() {
  const initX = SW - BTN - 16;
  const initY = SH - SH / 3 - BTN / 2;
  const pan   = useRef(new Animated.ValueXY({ x: initX, y: initY })).current;

  const [visible,  setVisible]  = useState(false);
  const slideAnim = useRef(new Animated.Value(SH)).current;

  // 键盘高度（普通 state，无动画冲突）
  const [kbHeight, setKbHeight] = useState(0);

  // 聊天状态
  const [messages, setMessages] = useState([{ id: '0', role: 'ai', content: WELCOME }]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const sessionRef = useRef(null);
  const listRef    = useRef(null);

  // 键盘监听
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => {
        setKbHeight(e.endCoordinates.height);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKbHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // 拖拽 vs 点击
  const movedRef = useRef(false);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      movedRef.current = false;
      pan.setOffset({ x: pan.x._value, y: pan.y._value });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) movedRef.current = true;
      Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gs);
    },
    onPanResponderRelease: () => {
      pan.flattenOffset();
      const x = Math.max(0, Math.min(SW - BTN, pan.x._value));
      const y = Math.max(0, Math.min(SH - BTN - 80, pan.y._value));
      Animated.spring(pan, { toValue: { x, y }, useNativeDriver: false, friction: 7 }).start();
      if (!movedRef.current) openPanel();
    },
  })).current;

  function openPanel() {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, friction: 10, tension: 70, useNativeDriver: false,
    }).start();
  }

  function closePanel() {
    Keyboard.dismiss();
    setKbHeight(0);
    Animated.timing(slideAnim, {
      toValue: SH, duration: 260, useNativeDriver: false,
    }).start(() => setVisible(false));
  }

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { id: String(Date.now()), role: 'user', content: text }]);
    setLoading(true);

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);

    try {
      const url = await getK1URL();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionRef.current || undefined }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`服务器返回 HTTP ${res.status}`);
      const data = await res.json();
      if (data.session_id) sessionRef.current = data.session_id;
      setMessages(prev => [...prev,
        { id: String(Date.now() + 1), role: 'ai', content: data.reply ?? '（无响应）' }
      ]);
    } catch (e) {
      clearTimeout(timer);
      const msg = e.name === 'AbortError'
        ? 'K1 响应超时（30秒），请确认 chat_server.py 正在运行'
        : e.message;
      Alert.alert('连接失败', msg, [
        { text: '取消', style: 'cancel' },
        { text: '重试', onPress: () => { setMessages(prev => prev.slice(0, -1)); setInput(text); } },
      ]);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading]);

  return (
    <>
      {/* 悬浮按钮 */}
      {!visible && (
        <Animated.View
          style={[s.fab, {
            width: BTN, height: BTN, borderRadius: BTN / 2,
            transform: pan.getTranslateTransform(),
          }]}
          {...responder.panHandlers}
        >
          <Text style={[s.fabIcon, { fontSize: BTN * 0.38 }]}>🦞</Text>
        </Animated.View>
      )}

      {/* 聊天面板 */}
      <Modal visible={visible} transparent animationType="none" onRequestClose={closePanel}>
        <View style={s.overlay}>
          {/* 上 1/4 暗色，点击关闭 */}
          <TouchableOpacity style={s.darkZone} activeOpacity={1} onPress={closePanel} />

          {/* 下 3/4 面板，translateY 滑入 */}
          <Animated.View style={[s.panel, { transform: [{ translateY: slideAnim }] }]}>
            {/* 标题栏 */}
            <View style={s.header}>
              <View>
                <Text style={s.headerTitle}>AI 助手</Text>
                <Text style={s.headerSub}>智能快递站</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={closePanel}>
                <Text style={s.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 消息列表 */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={i => i.id}
              contentContainerStyle={s.list}
              style={s.flex}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => <Bubble item={item} />}
              ListFooterComponent={
                loading ? (
                  <View style={s.typing}>
                    <ActivityIndicator size="small" color="#4f46e5" />
                    <Text style={s.typingTxt}>思考中…</Text>
                  </View>
                ) : null
              }
            />

            {/* 输入栏 */}
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
                submitBehavior="newline"
                color="#111827"
                backgroundColor="#fff"
              />
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading) && s.sendDim]}
                onPress={send}
                disabled={!input.trim() || loading}
              >
                <Text style={s.sendTxt}>➤</Text>
              </TouchableOpacity>
            </View>

            {/* 键盘占位：撑开面板内部，让输入栏上移 */}
            <View style={{ height: kbHeight }} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  fab:     { position: 'absolute', zIndex: 9999, backgroundColor: '#4f46e5',
             justifyContent: 'center', alignItems: 'center',
             elevation: 8, shadowColor: '#4f46e5', shadowOpacity: 0.45,
             shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fabIcon: { color: '#fff' },

  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  darkZone: { height: SH * 0.25 },

  panel:       { flex: 1, backgroundColor: '#f5f5f5',
                 borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                 backgroundColor: '#1e1b4b', paddingHorizontal: 16, paddingVertical: 14,
                 borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  closeBtn:    { width: 30, height: 30, borderRadius: 15,
                 backgroundColor: 'rgba(255,255,255,0.2)',
                 justifyContent: 'center', alignItems: 'center' },
  closeTxt:    { color: '#fff', fontSize: 14, fontWeight: '700' },

  flex:      { flex: 1 },
  list:      { paddingTop: 10, paddingBottom: 6 },
  typing:    { flexDirection: 'row', alignItems: 'center', gap: 8,
               paddingHorizontal: 16, paddingBottom: 8 },
  typingTxt: { color: '#6b7280', fontSize: 13 },
  inputRow:  { flexDirection: 'row', alignItems: 'flex-end', padding: 10,
               backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  input:     { flex: 1, minHeight: 40, maxHeight: 100,
               borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20,
               paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  sendBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#4f46e5',
               justifyContent: 'center', alignItems: 'center' },
  sendDim:   { backgroundColor: '#c7d2fe' },
  sendTxt:   { color: '#fff', fontSize: 15 },
});
