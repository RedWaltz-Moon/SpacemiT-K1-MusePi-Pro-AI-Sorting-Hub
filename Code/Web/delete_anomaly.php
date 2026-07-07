<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

require_auth('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$id    = intval($input['id'] ?? 0);

if ($id <= 0) { echo json_encode(['error' => '无效 ID']); exit; }

$conn = db();
$stmt = $conn->prepare("DELETE FROM anomaly_reports WHERE id = ?");
$stmt->bind_param('i', $id);
$ok = $stmt->execute();
$stmt->close();
$conn->close();

echo json_encode($ok ? ['success' => true] : ['error' => '删除失败']);
