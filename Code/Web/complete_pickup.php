<?php
// Qt 完成取件后调用：标记请求完成 + 更新包裹状态为已取走
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input  = json_decode(file_get_contents('php://input'), true);
$apiKey = $input['key'] ?? '';
if ($apiKey !== 'qt-polling-key-2024') {
    http_response_code(403); echo json_encode(['error' => 'Forbidden']); exit;
}

$requestId = intval($input['request_id'] ?? 0);
$success   = (bool)($input['success'] ?? true);

if ($requestId <= 0) {
    echo json_encode(['error' => '参数错误']); exit;
}

$conn   = db();
$status = $success ? 'done' : 'failed';

// 获取 package_id
$stmt = $conn->prepare("SELECT package_id FROM pickup_requests WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $requestId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    $conn->close(); echo json_encode(['error' => '请求不存在']); exit;
}

// 更新请求状态
$stmt = $conn->prepare(
    "UPDATE pickup_requests SET status = ?, processed_at = NOW() WHERE id = ?"
);
$stmt->bind_param('si', $status, $requestId);
$stmt->execute();
$stmt->close();

// 成功则标记包裹已取走
if ($success) {
    $packageId = $row['package_id'];
    $stmt = $conn->prepare("UPDATE shipments SET status = 1 WHERE id = ?");
    $stmt->bind_param('i', $packageId);
    $stmt->execute();
    $stmt->close();
}

$conn->close();
echo json_encode(['success' => true]);
