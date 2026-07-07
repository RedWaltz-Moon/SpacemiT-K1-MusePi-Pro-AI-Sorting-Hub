import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, ScrollView, RefreshControl, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { getStats, getPackages } from '../../api';

// Animated number counter
function CounterText({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setCount(Math.round(v)));
    return () => anim.removeListener(id);
  }, []);

  useEffect(() => {
    Animated.spring(anim, { toValue: value, friction: 6, useNativeDriver: false }).start();
  }, [value]);

  return <Text style={style}>{count}</Text>;
}

// Single animated bar
function AnimatedBar({ count, max, maxH, delay, color }) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  const targetH = Math.max(count > 0 ? 8 : 3, (count / max) * maxH);

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: targetH,
      friction: 7,
      delay: delay || 0,
      useNativeDriver: false,
    }).start();
  }, [count]);

  return (
    <Animated.View style={{
      height: heightAnim,
      width: '76%',
      borderRadius: 4,
      backgroundColor: count > 0 ? (color || '#4f46e5') : '#e5e7eb',
    }} />
  );
}

function BarChart({ data, maxH = 80, color }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <View style={bc.wrap}>
      {data.map((item, i) => (
        <View key={i} style={bc.col}>
          <Text style={bc.val}>{item.count > 0 ? item.count : ''}</Text>
          <AnimatedBar count={item.count} max={max} maxH={maxH} delay={i * 40} color={color} />
          <Text style={bc.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const bc = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingTop: 8 },
  col:   { flex: 1, alignItems: 'center' },
  val:   { fontSize: 10, color: '#6b7280', marginBottom: 2 },
  label: { fontSize: 9, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
});

export default function AnalyticsScreen() {
  const [stats,    setStats]    = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [statsRes, pkgRes] = await Promise.all([getStats(), getPackages(0)]);
      setStats(statsRes);
      if (Array.isArray(pkgRes)) setPackages(pkgRes);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shelfDist = [1,2,3,4,5,6].map(loc => ({
    label: `${loc}号`,
    count: packages.filter(p => p.location === loc).length,
  }));

  const catMap = {};
  packages.forEach(p => { const c = p.category || '未分类'; catMap[c] = (catMap[c] || 0) + 1; });
  const catDist = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,6).map(([label,count]) => ({ label, count }));

  const now = Date.now();
  const ageBuckets = { '1天内': 0, '1-3天': 0, '3-7天': 0, '7天+': 0 };
  packages.forEach(p => {
    const days = (now - new Date(p.created_at.replace(' ','T')).getTime()) / 86400000;
    if (days < 1) ageBuckets['1天内']++;
    else if (days < 3) ageBuckets['1-3天']++;
    else if (days < 7) ageBuckets['3-7天']++;
    else ageBuckets['7天+']++;
  });
  const ageDist = Object.entries(ageBuckets).map(([label, count]) => ({ label, count }));

  const totalIn    = (stats?.total_in    ?? 0);
  const totalOut   = (stats?.total_taken ?? 0);
  const todayIn    = (stats?.today_in    ?? 0);
  const todayOut   = (stats?.today_taken ?? 0);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <LinearGradient colors={['#1e1b4b', '#4338ca']} style={s.header}>
          <Text style={s.title}>数据看板</Text>
          <Text style={s.subtitle}>实时统计 · 智能分析</Text>
        </LinearGradient>

        {/* Summary stat cards */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#ede9fe' }]}>
            <CounterText value={totalIn} style={[s.statNum, { color: '#4f46e5' }]} />
            <Text style={s.statLabel}>累计入库</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#d1fae5' }]}>
            <CounterText value={totalOut} style={[s.statNum, { color: '#065f46' }]} />
            <Text style={s.statLabel}>累计取件</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#fef3c7' }]}>
            <CounterText value={packages.length} style={[s.statNum, { color: '#92400e' }]} />
            <Text style={s.statLabel}>当前在库</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>格口分布</Text>
          <BarChart data={shelfDist} color="#4f46e5" />
        </View>

        {catDist.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>分类分布</Text>
            <BarChart data={catDist} color="#7c3aed" />
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>在库时长分布</Text>
          <BarChart data={ageDist} maxH={60} color="#0891b2" />
        </View>

        {stats?.daily && (
          <View style={s.card}>
            <Text style={s.cardTitle}>近7日取件量</Text>
            <BarChart data={stats.daily} color="#059669" />
          </View>
        )}

        {stats?.weekly && (
          <View style={s.card}>
            <Text style={s.cardTitle}>近8周取件量</Text>
            <BarChart data={stats.weekly} color="#dc2626" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#f5f5f5' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16 },
  header:    { borderRadius: 16, padding: 20, marginBottom: 16 },
  title:     { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  subtitle:  { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statsRow:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:  { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  statNum:   { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 4 },
});
