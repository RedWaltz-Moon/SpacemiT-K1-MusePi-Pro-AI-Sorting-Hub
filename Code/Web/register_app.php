<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$phone    = trim($input['phone']    ?? '');
$password = $input['password']      ?? '';
$confirm  = $input['confirm']       ?? '';

if ($phone === '' || $password === '' || $confirm === '') {
    echo json_encode(['error' => '请填写所有字段']); exit;
}
if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
    echo json_encode(['error' => '请输入有效的11位手机号']); exit;
}
if (strlen($password) < 6) {
    echo json_encode(['error' => '密码至少6位']); exit;
}
if ($password !== $confirm) {
    echo json_encode(['error' => '两次密码不一致']); exit;
}

$conn = db();

$stmt = $conn->prepare("SELECT id FROM users WHERE phone = ? LIMIT 1");
$stmt->bind_param('s', $phone);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    echo json_encode(['error' => '该手机号已注册，请直接登录']); exit;
}
$stmt->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO users (phone, password_hash) VALUES (?, ?)");
$stmt->bind_param('ss', $phone, $hash);
$ok = $stmt->execute();
$stmt->close();
$conn->close();

echo json_encode($ok ? ['success' => true] : ['error' => '注册失败，请重试']);
