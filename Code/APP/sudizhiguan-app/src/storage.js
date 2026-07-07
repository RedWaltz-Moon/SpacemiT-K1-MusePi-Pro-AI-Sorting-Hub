import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

export async function saveAuth(token, user) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken() {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
