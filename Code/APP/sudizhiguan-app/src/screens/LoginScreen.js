import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { login } from '../api';
import { saveAuth } from '../storage';

export default function LoginScreen({ navigation, onLogin }) {
  const [account,  setAccount]  = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    if (!account || !password) { setError('请填写账号和密码'); return; }
    setLoading(true); setError('');
    try {
      const res = await login(account, password);
      if (res.error) { setError(res.error); return; }
      await saveAuth(res.token, { role: res.role, phone: res.phone, display_name: res.display_name });
      onLogin(res.role);
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

          <Text style={s.logo}>速递智管</Text>
          <Text style={s.sub}>快递驿站智能管理平台</Text>

          <View style={s.card}>
            <Text style={s.label}>账号</Text>
            <TextInput
              style={s.input} placeholder="手机号"
              autoCapitalize="none" keyboardType="number-pad"
              value={account} onChangeText={setAccount}
            />
            <Text style={s.label}>密码</Text>
            <TextInput
              style={s.input} placeholder="请输入密码"
              secureTextEntry value={password} onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>登 录</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.link} onPress={() => navigation.navigate('Register')}>
              <Text style={s.linkText}>没有账号？立即注册</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={s.linkText}>忘记密码？</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => navigation.navigate('GuestQuery')}>
              <Text style={s.linkText}>游客查件（无需登录）</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#f0f0f7' },
  flex:      { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo:      { fontSize: 32, fontWeight: '800', color: '#1e1b4b', textAlign: 'center', marginBottom: 4 },
  sub:       { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  label:     { fontSize: 13, color: '#6b7280', marginBottom: 6, marginTop: 12 },
  input:     { height: 48, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#fff' },
  error:     { color: '#ef4444', fontSize: 13, marginTop: 8 },
  btn:       { height: 50, backgroundColor: '#4f46e5', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  btnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:      { marginTop: 14, alignItems: 'center' },
  linkText:  { color: '#4f46e5', fontSize: 14 },
});
