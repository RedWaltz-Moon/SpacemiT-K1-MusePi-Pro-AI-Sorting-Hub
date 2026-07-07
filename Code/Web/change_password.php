<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$user = require_auth();

if ($user['role'] === 'admin') {
    echo json_encode(['error' => '管理员账号密码请在服务端配置中修改']); exit;
}

$input       = json_decode(file_get_contents('php://input'), true);
$oldPassword = $input['old_password']     ?? '';
$newPassword = $input['new_password']     ?? '';
$confirm     = $input['confirm_password'] ?? '';

if ($oldPassword === '' || $newPassword === '' || $confirm === '') {
    echo json_encode(['error' => '请填写所有字段']); exit;
}
if (strlen($newPassword) < 6) {
    echo json_encode(['error' => '新密码至少6位']); exit;
}
if ($newPassword !== $confirm) {
    echo json_encode(['error' => '两次新密码不一致']); exit;
}
if ($newPassword === $oldPassword) {
    echo json_encode(['error' => '新密码不能与旧密码相同']); exit;
}

$phone = $user['phone'];
$conn  = db();

$stmt = $conn->prepare("SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1");
$stmt->bind_param('s', $phone);
$stmt->execute();
$u = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$u || !password_verify($oldPassword, $u['password_hash'])) {
    $conn->close(); echo json_encode(['error' => '旧密码不正确']); exit;
}

$hash = password_hash($newPassword, PASSWORD_DEFAULT);
$stmt = $conn->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
$stmt->bind_param('si', $hash, $u['id']);
$ok = $stmt->execute();
$stmt->close();

// 使旧 token 失效
if ($ok) {
    $stmt = $conn->prepare("DELETE FROM user_tokens WHERE phone = ?");
    $stmt->bind_param('s', $phone);
    $stmt->execute();
    $stmt->close();
    // Web session
    if (session_status() === PHP_SESSION_NONE) session_start();
    session_unset(); session_destroy();
}
$conn->close();

echo json_encode($ok ? ['success' => true] : ['error' => '修改失败，请重试']);
