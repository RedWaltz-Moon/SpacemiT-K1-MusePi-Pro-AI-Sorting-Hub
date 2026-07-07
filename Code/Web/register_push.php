<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$user  = require_auth();
$input = json_decode(file_get_contents('php://input'), true);
$expoToken = trim($input['expo_token'] ?? '');

if ($expoToken === '' || !str_starts_with($expoToken, 'ExponentPushToken[')) {
    echo json_encode(['error' => '无效的推送 Token']); exit;
}

$phone = $user['phone'];
$conn  = db();

// 管理员不绑定手机号，用 role 标记
if ($phone === '') $phone = '__admin__';

$stmt = $conn->prepare(
    "INSERT INTO push_tokens (phone, expo_token) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP"
);
$stmt->bind_param('ss', $phone, $expoToken);
$ok = $stmt->execute();
$stmt->close();
$conn->close();

echo json_encode($ok ? ['success' => true] : ['error' => '注册失败']);
