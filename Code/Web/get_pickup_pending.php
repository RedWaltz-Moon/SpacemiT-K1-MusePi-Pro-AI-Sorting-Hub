<?php
// Qt 轮询接口，返回所有 pending 取件请求
// 简单 API Key 鉴权，防止外部调用
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$apiKey = $_GET['key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($apiKey !== 'qt-polling-key-2024') {
    http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit;
}

$conn = db();
$result = $conn->query(
    "SELECT id, phone, package_id, locker, created_at
     FROM pickup_requests WHERE status = 'pending' ORDER BY id ASC"
);
$rows = [];
while ($r = $result->fetch_assoc()) $rows[] = $r;
$conn->close();

echo json_encode($rows);
