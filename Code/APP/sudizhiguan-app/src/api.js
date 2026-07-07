import { API } from './config';
import { getToken } from './storage';

async function authHeaders() {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
               : { 'Content-Type': 'application/json' };
}

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: await authHeaders() });
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return res.json();
}

// Auth
export const login         = (account, password) => post('/login.php', { account, password });
export const registerApp   = (phone, password, confirm) => post('/register_app.php', { phone, password, confirm });
export const changePassword = (old_password, new_password, confirm_password) =>
  post('/change_password.php', { old_password, new_password, confirm_password });
export const resetPassword = (phone, password, confirm_password) =>
  post('/reset_password_app.php', { phone, password, confirm_password });

// Packages
export const getPackages   = (status = 0) => get(`/get_shipments.php?status=${status}`);
export const getAllPackages = ()           => get('/get_shipments.php?status=all');
export const addPackage    = (data) => post('/add_shipment.php', data);
export const updatePackage = (data) => post('/update_shipment.php', data);
export const deletePackage = (id)   => post('/delete_shipment.php', { id });
export const queryGuest    = (phone) => fetch(`${API}/query_shipment.php?phone=${phone}`).then(r => r.json());

// Pickup
export const requestPickup   = (package_id, locker) => post('/request_pickup.php', { package_id, locker });
export const revertPickup    = (id) => post('/revert_pickup.php', { id });
export const getPickupStatus = (request_id) => get(`/get_pickup_status.php?request_id=${request_id}`);

// Slots & Stats
export const getSlots         = () => get('/get_slots.php');
export const getStats         = () => get('/get_stats.php');
export const getActivePickups = () => get('/get_active_pickups.php');

// Push token
export const registerPushToken = (expo_token) => post('/register_push.php', { expo_token });

// Anomaly reports
export const getAnomalies  = ()     => get('/get_anomalies.php');
export const updateAnomaly = (data) => post('/update_anomaly.php', data);
export const deleteAnomaly = (id)   => post('/delete_anomaly.php', { id });
