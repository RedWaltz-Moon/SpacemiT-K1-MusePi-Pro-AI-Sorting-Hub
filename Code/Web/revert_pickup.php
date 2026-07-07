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

if ($id <= 0) {
    echo json_encode(['error' => '参数错误']); exit;
}

$conn = db();
$stmt = $conn->prepare("UPDATE shipments SET status = 0 WHERE id = ? AND status = 1");
$stmt->bind_param('i', $id);
$ok       = $stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();
$conn->close();

if (!$ok)           echo json_encode(['error' => 'SQL执行失败: ' . $conn->error]);
elseif ($affected === 0) echo json_encode(['error' => "id={$id} 未找到已取走的包裹"]);
else                echo json_encode(['success' => true]);
