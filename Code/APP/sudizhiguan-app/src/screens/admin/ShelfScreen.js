import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getSlots, getPackages, getActivePickups } from '../../api';

// Animated number counter
function CounterText({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setCount(Math.round(v)));
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    Animated.spring(anim, { toValue: value, friction: 7, useNativeDriver: false }).start();
  }, [value]);

  return <Text style={style}>{count}</Text>;
}

// Individual slot cell with breathing + pickup flash animations
function SlotCell({ slot, pkg, isPickupActive }) {
  const glow = useRef(new Animated.Value(0)).current;
  const isFree = slot.state === 1;

  useEffect(() => {
    if (isFree && !isPickupActive) {
      Animated.timing(glow, { toValue: 0, duration: 400, useNativeDriver: false }).start();
      return;
    }
    const duration = isPickupActive ? 380 : 1500;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFree, isPickupActive]);

  const bgColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: isPickupActive
      ? ['#fef3c7', '#ffedd5']
      : isFree ? ['#fff', '#fff'] : ['#fef3c7', '#fef9c3'],
  });

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: isPickupActive
      ? ['#fb923c', '#ef4444']
      : isFree ? ['#e5e7eb', '#e5e7eb'] : ['#fcd34d', '#fbbf24'],
  });

  return (
    <Animated.View style={[s.slot, { backgroundColor: bgColor, borderColor, borderWidth: isPickupActive ? 2 : 1 }]}>
      <View style={s.slotTop}>
        <Text style={s.slotNum}>{slot.id} 号</Text>
        {isPickupActive && (
          <View style={s.activeBadge}>
            <Text style={s.activeBadgeText}>出库中</Text>
          </View>
        )}
      </View>
      <Text style={[s.slotStatus,
        isPickupActive ? s.statusActive : isFree ? s.statusFree : s.statusOcc]}>
        {isPickupActive ? '⚡ 取件中' : isFree ? '空  闲' : '已占用'}
      </Text>
      {pkg && <Text style={s.slotTrack} numberOfLines={1}>{pkg.tracking_number}</Text>}
      {pkg?.category ? <Text style={s.slotCat}>{pkg.category}</Text> : null}
    </Animated.View>
  );
}

export default function ShelfScreen() {
  const [slots,         setSlots]         = useState([]);
  const [packages,      setPackages]      = useState([]);
  const [activeLockers, setActiveLockers] = useState(new Set());
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [slotsRes, pkgRes] = await Promise.all([getSlots(), getPackages(0)]);
      if (Array.isArray(slotsRes)) setSlots(slotsRes);
      if (Array.isArray(pkgRes))   setPackages(pkgRes);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const pollPickups = useCallback(async () => {
    try {
      const res = await getActivePickups();
      if (Array.isArray(res)) {
        setActiveLockers(new Set(res.map(r => r.locker)));
      }
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    pollPickups();
    pollRef.current = setInterval(pollPickups, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load, pollPickups]));

  const occupied = packages.length;
  const free     = 6 - occupied;

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <LinearGradient colors={['#1e1b4b', '#4338ca']} style={s.header}>
          <Text style={s.title}>货架总览</Text>
          <Text style={s.subtitle}>实时监控 · 智能取件</Text>
        </LinearGradient>

        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#ede9fe' }]}>
            <CounterText value={occupied} style={[s.statNum, { color: '#4f46e5' }]} />
            <Text style={s.statLabel}>已占用</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#d1fae5' }]}>
            <CounterText value={free} style={[s.statNum, { color: '#065f46' }]} />
            <Text style={s.statLabel}>空  闲</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#f3f4f6' }]}>
            <CounterText value={6} style={[s.statNum, { color: '#374151' }]} />
            <Text style={s.statLabel}>总格口</Text>
          </View>
        </View>

        {activeLockers.size > 0 && (
          <View style={s.alertBanner}>
            <Text style={s.alertText}>⚡ 格口 {[...activeLockers].join('、')} 正在出库</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>格口状态</Text>
        <View style={s.grid}>
          {slots.map(slot => {
            const pkg = packages.find(p => p.location === slot.id);
            return (
              <SlotCell
                key={slot.id}
                slot={slot}
                pkg={pkg}
                isPickupActive={activeLockers.has(slot.id)}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#f5f5f5' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container:    { padding: 16 },
  header:       { borderRadius: 16, padding: 20, marginBottom: 16 },
  title:        { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle:     { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard:     { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNum:      { fontSize: 28, fontWeight: '800' },
  statLabel:    { fontSize: 12, color: '#6b7280', marginTop: 2 },
  alertBanner:  { backgroundColor: '#fff7ed', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#f97316' },
  alertText:    { color: '#c2410c', fontWeight: '600', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot:         { width: '47%', borderRadius: 14, padding: 14, minHeight: 105 },
  slotTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  slotNum:      { fontSize: 18, fontWeight: '700', color: '#1e1b4b' },
  activeBadge:  { backgroundColor: '#f97316', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  slotStatus:   { fontSize: 13, fontWeight: '600', marginTop: 2 },
  statusFree:   { color: '#059669' },
  statusOcc:    { color: '#92400e' },
  statusActive: { color: '#ea580c' },
  slotTrack:    { fontSize: 11, color: '#6b7280', marginTop: 6 },
  slotCat:      { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
