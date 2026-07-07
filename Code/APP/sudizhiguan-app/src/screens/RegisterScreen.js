import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView, ScrollView,
} from 'react-native';
import { registerApp } from '../api';

function genCaptcha() {
  const ops = ['+', '-', '×'];
  const op  = ops[Math.floor(Math.random() * 3)];
  let a = Math.floor(Math.random() * 10) + 1;
  let b = Math.floor(Math.random() * 10) + 1;
  if (op === '-' && b > a) [a, b] = [b, a]; // 保证结果非负
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  return { question: `${a} ${op} ${b} = ?`, answer: String(answer) };
}

export default function RegisterScreen({ navigation }) {
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [captcha,  setCaptcha]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [quiz,     setQuiz]     = useState(() => genCaptcha());

  const refreshCaptcha = useCallback(() => {
    setQuiz(genCaptcha());
    setCaptcha('');
  }, []);

  async function handleRegister() {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入有效的11位手机号'); return; }
    if (password.length < 6)           { setError('密码至少6位');            return; }
    if (password !== confirm)          { setError('两次密码不一致');          return; }
    if (captcha.trim() !== quiz.answer) {
      setError('验证码错误');
      refreshCaptcha();
      return;
    }
    setLoading(true); setError('');
    try {
      const res = await registerApp(phone, password, confirm);
      if (res.error) { setError(res.error); refreshCaptcha(); return; }
      navigation.navigate('Login');
    } catch (e) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Text style={s.title}>注册账号</Text>

          <Text style={s.label}>手机号</Text>
          <TextInput style={s.input} placeholder="请输入11位手机号" keyboardType="number-pad" value={phone} onChangeText={setPhone} />

          <Text style={s.label}>密码</Text>
          <TextInput style={s.input} placeholder="至少6位" secureTextEntry value={password} onChangeText={setPassword} />

          <Text style={s.label}>确认密码</Text>
          <TextInput style={s.input} placeholder="再次输入密码" secureTextEntry value={confirm} onChangeText={setConfirm} />

          <Text style={s.label}>验证码</Text>
          <View style={s.captchaRow}>
            <TextInput
              style={[s.input, s.captchaInput]}
              placeholder="计算结果"
              keyboardType="number-pad"
              value={captcha}
              onChangeText={setCaptcha}
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity style={s.captchaBox} onPress={refreshCaptcha}>
              <Text style={s.captchaText}>{quiz.question}</Text>
              <Text style={s.captchaHint}>点击换一题</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>注 册</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={s.link} onPress={() => navigation.goBack()}>
            <Text style={s.linkText}>已有账号？去登录</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f0f7' },
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 48 },
  title: { fontSize: 26, fontWeight: '700', color: '#1e1b4b', marginBottom: 24 },
  label: { fontSize: 13, color: '#6b7280', marginBottom: 6, marginTop: 14 },
  input: { height: 48, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#fff' },
  captchaRow: { flexDirection: 'row', gap: 10 },
  captchaInput: { flex: 1 },
  captchaBox: { backgroundColor: '#1e1b4b', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', minWidth: 110 },
  captchaText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  captchaHint: { color: '#a5b4fc', fontSize: 10, marginTop: 2 },
  error: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  btn: { height: 50, backgroundColor: '#4f46e5', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#4f46e5', fontSize: 14 },
});
