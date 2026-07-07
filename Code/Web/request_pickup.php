<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$user       = require_auth();
$input      = json_decode(file_get_contents('php://input'), true);
$packageId  = intval($input['package_id'] ?? 0);
$locker     = intval($input['locker']     ?? 0);

if ($packageId <= 0 || $locker < 1 || $locker > 6) {
    echo json_encode(['error' => '参数错误']); exit;
}

$conn = db();

// 确认包裹属于该用户且仍在库
$phone = $user['phone'];
if ($user['role'] === 'admin') {
    $stmt = $conn->prepare("SELECT id FROM shipments WHERE id = ? AND status = 0 LIMIT 1");
    $stmt->bind_param('i', $packageId);
} else {
    $stmt = $conn->prepare(
        "SELECT id FROM shipments WHERE id = ? AND status = 0
         AND (phone_suffix = ? OR ? LIKE CONCAT('%', phone_suffix)) LIMIT 1"
    );
    $stmt->bind_param('iss', $packageId, $phone, $phone);
}
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows === 0) {
    $stmt->close(); $conn->close();
    echo json_encode(['error' => '包裹不存在或已取走']); exit;
}
$stmt->close();

// 是否已有待处理请求
$stmt = $conn->prepare(
    "SELECT id FROM pickup_requests WHERE package_id = ? AND status IN ('pending','processing') LIMIT 1"
);
$stmt->bind_param('i', $packageId);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    $stmt->close(); $conn->close();
    echo json_encode(['error' => '该包裹已有取件请求，请稍候']); exit;
}
$stmt->close();

$stmt = $conn->prepare(
    "INSERT INTO pickup_requests (phone, package_id, locker) VALUES (?, ?, ?)"
);
$stmt->bind_param('sii', $phone, $packageId, $locker);
$ok = $stmt->execute();
$insertId = $ok ? $conn->insert_id : 0;
$stmt->close();
$conn->close();

echo json_encode($ok ? ['success' => true, 'request_id' => $insertId, 'message' => '取件请求已提交，请前往取件口等候'] : ['error' => '提交失败，请重试']);
