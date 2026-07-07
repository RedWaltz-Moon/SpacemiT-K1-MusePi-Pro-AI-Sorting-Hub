<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

$requestId = intval($_GET['request_id'] ?? 0);
if ($requestId <= 0) {
    echo json_encode(['error' => '参数错误']); exit;
}

require_auth();

$conn = db();
$stmt = $conn->prepare("SELECT status FROM pickup_requests WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $requestId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
$conn->close();

if (!$row) {
    echo json_encode(['error' => '请求不存在']); exit;
}

echo json_encode(['status' => $row['status']]);
