import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { getUser, clearAuth } from '../storage';
import { changePassword, registerPushToken } from '../api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export default function ProfileScreen({ onLogout }) {
  const [user,       setUser]       = useState(null);
  const [oldPwd,     setOldPwd]     = useState('');
  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError,   setPwdError]   = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    getUser().then(setUser);
    checkPushStatus();
  }, []);

  function checkPushStatus() {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPushEnabled(status === 'granted');
    });
  }

  async function enablePush() {
    if (!Device.isDevice) {
      Alert.alert('提示', '推送通知仅支持真机，模拟器无法注册');
      return;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('提示', '请在系统设置中允许本应用发送通知');
      return;
    }
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(token);
      setPushEnabled(true);
    } catch (e) {
      Alert.alert('失败', `获取推送令牌失败：${e.message ?? e}`);
    }
  }

  async function handleChangePwd() {
    setPwdError('');
    setPwdLoading(true);
    try {
      const res = await changePassword(oldPwd, newPwd, confirmPwd);
      if (res.error) { setPwdError(res.error); return; }
      Alert.alert('成功', '密码已修改，请重新登录', [{ text: '确定', onPress: handleLogout }]);
    } catch (_) {
      setPwdError('网络错误，请重试');
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleLogout() {
    await clearAuth();
    onLogout();
  }

  if (!user) return <View style={s.center}><ActivityIndicator color="#4f46e5" /></View>;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>我的</Text>

        {/* 账号信息 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>账号信息</Text>
          <Row label="角色" value={user.role === 'admin' ? '管理员' : '普通用户'} />
          {user.phone ? <Row label="手机号" value={user.display_name || user.phone} /> : null}
        </View>

        {/* 推送通知 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>到站推送通知</Text>
          <Text style={s.desc}>开启后，包裹到站时将自动推送通知</Text>
          {pushEnabled
            ? <Text style={s.pushOn}>✓ 推送通知已开启</Text>
            : <TouchableOpacity style={s.pushBtn} onPress={enablePush}>
                <Text style={s.pushBtnText}>开启推送通知</Text>
              </TouchableOpacity>
          }
        </View>

        {/* 修改密码（仅普通用户） */}
        {user.role !== 'admin' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>修改密码</Text>
            <Text style={s.label}>旧密码</Text>
            <TextInput style={s.input} secureTextEntry value={oldPwd} onChangeText={setOldPwd} placeholder="当前密码" />
            <Text style={s.label}>新密码</Text>
            <TextInput style={s.input} secureTextEntry value={newPwd} onChangeText={setNewPwd} placeholder="至少6位" />
            <Text style={s.label}>确认新密码</Text>
            <TextInput style={s.input} secureTextEntry value={confirmPwd} onChangeText={setConfirmPwd} placeholder="再次输入新密码" />
            {pwdError ? <Text style={s.error}>{pwdError}</Text> : null}
            <TouchableOpacity style={s.btn} onPress={handleChangePwd} disabled={pwdLoading}>
              {pwdLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>修改密码</Text>}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e1b4b', marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { fontSize: 14, color: '#6b7280' },
  rowValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  desc: { fontSize: 13, color: '#9ca3af', marginBottom: 10 },
  pushOn: { color: '#065f46', fontSize: 14, fontWeight: '600' },
  pushBtn: { height: 40, backgroundColor: '#4f46e5', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  pushBtnText: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 4 },
  input: { height: 44, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  error: { color: '#ef4444', fontSize: 13, marginTop: 6 },
  btn: { height: 46, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { height: 50, backgroundColor: '#fee2e2', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
});
