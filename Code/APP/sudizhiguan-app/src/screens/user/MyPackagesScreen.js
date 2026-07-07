import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Alert, Modal, Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getPackages, requestPickup, getPickupStatus } from '../../api';

const OVERDUE_DAYS = 7;
const POLL_MS      = 2000;
const TIMEOUT_MS   = 120000;

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr.replace(' ', 'T')).getTime()) / 86400000);
}

// Slide-in card wrapper
function AnimatedCard({ index, style, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, friction: 8, tension: 65,
      delay: index * 55, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [24, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

// Spinning arc loader
function SpinningRing() {
  const spin  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(spin,  { toValue: 1, duration: 900, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0,1], outputRange: ['0deg','360deg'] });
  return (
    <View style={m.spinWrap}>
      <Animated.View style={[m.outerPulse, { transform: [{ scale: pulse }] }]} />
      <Animated.View style={[m.spinArc, { transform: [{ rotate }] }]} />
      <View style={m.spinCenter} />
    </View>
  );
}

// Bounce-in success circle
function SuccessCircle() {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[m.successCircle, { transform: [{ scale }] }]}>
      <Text style={m.checkmark}>✓</Text>
    </Animated.View>
  );
}

// Shake fail circle
function FailCircle() {
  const shakeX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:  -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[m.failCircle, { transform: [{ translateX: shakeX }] }]}>
      <Text style={m.failMark}>✕</Text>
    </Animated.View>
  );
}

export default function MyPackagesScreen() {
  const [packages,    setPackages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [pickupState, setPickupState] = useState(null); // null | 'pending' | 'done' | 'failed'
  const [pickupMsg,   setPickupMsg]   = useState('');
  const pollRef    = useRef(null);
  const timeoutRef = useRef(null);
  const overdueAlerted = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await getPackages(0);
      if (Array.isArray(res)) {
        setPackages(res);
        if (!overdueAlerted.current) {
          overdueAlerted.current = true;
          const overdue = res.filter(p => daysSince(p.created_at) >= OVERDUE_DAYS);
          if (overdue.length > 0) {
            Alert.alert(
              '包裹滞留提醒',
              `以下包裹已超 ${OVERDUE_DAYS} 天未取：\n\n` +
              overdue.map(p => `• ${p.tracking_number}（已存 ${daysSince(p.created_at)} 天）`).join('\n'),
              [{ text: '知道了' }]
            );
          }
        }
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    return () => stopPolling();
  }, [load, stopPolling]));

  async function handlePickup(item) {
    Alert.alert(
      '确认取件',
      `取件后包裹将由机械臂送至出口，确认取 ${item.tracking_number} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认取件', onPress: async () => {
            const res = await requestPickup(item.id, item.location);
            if (res.error) { Alert.alert('失败', res.error); return; }
            setPickupState('pending');
            setPickupMsg('正在调度机械臂…');
            const requestId = res.request_id;
            pollRef.current = setInterval(async () => {
              try {
                const s = await getPickupStatus(requestId);
                if (s.status === 'done') {
                  stopPolling();
                  setPickupState('done');
                  setPickupMsg('请前往出口区取件');
                  setTimeout(() => { setPickupState(null); load(true); }, 2800);
                } else if (s.status === 'failed') {
                  stopPolling();
                  setPickupState('failed');
                  setPickupMsg('取件失败，请联系管理员');
                }
              } catch (_) {}
            }, POLL_MS);
            timeoutRef.current = setTimeout(() => {
              stopPolling();
              setPickupState('failed');
              setPickupMsg('等待超时，请检查设备是否在线');
            }, TIMEOUT_MS);
          },
        },
      ]
    );
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={packages}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        contentContainerStyle={packages.length === 0 ? s.emptyContainer : s.list}
        ListHeaderComponent={<Text style={s.header}>在库包裹 ({packages.length})</Text>}
        ListEmptyComponent={<Text style={s.empty}>暂无在库包裹</Text>}
        renderItem={({ item, index }) => {
          const days   = daysSince(item.created_at);
          const overdue = days >= OVERDUE_DAYS;
          return (
            <AnimatedCard index={index} style={{}}>
              <View style={[s.card, overdue && s.cardOverdue]}>
                <View style={s.row}>
                  <Text style={s.trackNo} numberOfLines={1}>{item.tracking_number}</Text>
                  <View style={s.badge}><Text style={s.badgeText}>{item.location} 号格口</Text></View>
                </View>
                {item.raw_text  ? <Text style={s.desc}>{item.raw_text}</Text>  : null}
                {item.category  ? <Text style={s.tag}>分类：{item.category}</Text> : null}
                <View style={s.timeRow}>
                  <Text style={s.time}>入库：{item.created_at}</Text>
                  {overdue && <Text style={s.overdueTag}>已存 {days} 天</Text>}
                </View>
                <TouchableOpacity
                  style={[s.pickupBtn, pickupState !== null && s.pickupBtnDisabled]}
                  onPress={() => handlePickup(item)}
                  disabled={pickupState !== null}
                >
                  <Text style={s.pickupText}>一键取件</Text>
                </TouchableOpacity>
              </View>
            </AnimatedCard>
          );
        }}
      />

      <Modal transparent visible={pickupState !== null} animationType="fade">
        <View style={m.overlay}>
          <View style={m.card}>
            {pickupState === 'pending' && (
              <>
                <SpinningRing />
                <Text style={m.title}>取件中</Text>
                <Text style={m.msg}>{pickupMsg}</Text>
              </>
            )}
            {pickupState === 'done' && (
              <>
                <SuccessCircle />
                <Text style={[m.title, { color: '#059669' }]}>取件成功</Text>
                <Text style={m.msg}>{pickupMsg}</Text>
              </>
            )}
            {pickupState === 'failed' && (
              <>
                <FailCircle />
                <Text style={[m.title, { color: '#dc2626' }]}>取件失败</Text>
                <Text style={m.msg}>{pickupMsg}</Text>
                <TouchableOpacity style={m.closeBtn} onPress={() => setPickupState(null)}>
                  <Text style={m.closeBtnText}>关闭</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#f5f5f5' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:           { padding: 16 },
  emptyContainer: { flex: 1, padding: 16 },
  header:         { fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 12 },
  empty:          { textAlign: 'center', color: '#9ca3af', marginTop: 60, fontSize: 15 },
  card:           { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  cardOverdue:    { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  trackNo:        { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  badge:          { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:      { color: '#4f46e5', fontSize: 12, fontWeight: '600' },
  desc:           { fontSize: 14, color: '#374151', marginBottom: 2 },
  tag:            { fontSize: 12, color: '#9ca3af' },
  timeRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'space-between' },
  time:           { fontSize: 12, color: '#d1d5db' },
  overdueTag:     { fontSize: 11, color: '#f59e0b', fontWeight: '600', backgroundColor: '#fffbeb', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pickupBtn:         { marginTop: 12, height: 42, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pickupBtnDisabled: { backgroundColor: '#a5b4fc' },
  pickupText:        { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
});

const m = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card:         { backgroundColor: '#fff', borderRadius: 24, padding: 40, alignItems: 'center', width: 270 },
  title:        { fontSize: 22, fontWeight: '800', color: '#1e1b4b', marginTop: 16, marginBottom: 6 },
  msg:          { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  closeBtn:     { marginTop: 22, paddingHorizontal: 30, paddingVertical: 12, backgroundColor: '#f3f4f6', borderRadius: 10 },
  closeBtnText: { color: '#374151', fontWeight: '600', fontSize: 15 },

  // Spinning ring
  spinWrap:    { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  outerPulse:  { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#ede9fe' },
  spinArc:     { position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: '#ede9fe', borderTopColor: '#4f46e5', borderRightColor: '#4f46e5' },
  spinCenter:  { width: 18, height: 18, borderRadius: 9, backgroundColor: '#4f46e5' },

  // Success
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center' },
  checkmark:     { fontSize: 38, color: '#059669', fontWeight: '900' },

  // Fail
  failCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center' },
  failMark:   { fontSize: 36, color: '#dc2626', fontWeight: '900' },
});
