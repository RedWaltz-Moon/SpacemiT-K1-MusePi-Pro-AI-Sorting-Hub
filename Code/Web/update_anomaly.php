<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

require_auth('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input  = json_decode(file_get_contents('php://input'), true);
$id     = intval($input['id'] ?? 0);
$status = $input['status'] ?? '';
$desc   = trim($input['description'] ?? '');

if ($id <= 0) { echo json_encode(['error' => '无效 ID']); exit; }
if (!in_array($status, ['pending', 'resolved'])) { echo json_encode(['error' => '无效状态']); exit; }

$conn = db();
$stmt = $conn->prepare("UPDATE anomaly_reports SET `status` = ?, description = ? WHERE id = ?");
$stmt->bind_param('ssi', $status, $desc, $id);
$ok = $stmt->execute();
$stmt->close();
$conn->close();

echo json_encode($ok ? ['success' => true] : ['error' => '更新失败']);
