<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

require_auth('admin');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$id       = intval($input['id']             ?? 0);
$tracking = trim($input['tracking_number']  ?? '');
$phone    = trim($input['phone_suffix']     ?? '');
$goods    = trim($input['goods']            ?? '');
$category = trim($input['category']        ?? '');
$location = intval($input['location']       ?? 0);
$status   = isset($input['status']) ? intval($input['status']) : -1;

if ($id <= 0 || $tracking === '') {
    echo json_encode(['error' => '参数错误']); exit;
}
if ($location < 1 || $location > 6) {
    echo json_encode(['error' => '存放位置须为 1–6']); exit;
}
if ($status !== -1 && !in_array($status, [0, 1])) {
    echo json_encode(['error' => '状态值无效']); exit;
}

$conn = db();
if ($status !== -1) {
    $stmt = $conn->prepare(
        "UPDATE shipments SET tracking_number=?, phone_suffix=?, raw_text=?, category=?, location=?, status=? WHERE id=?"
    );
    $stmt->bind_param('ssssiii', $tracking, $phone, $goods, $category, $location, $status, $id);
} else {
    $stmt = $conn->prepare(
        "UPDATE shipments SET tracking_number=?, phone_suffix=?, raw_text=?, category=?, location=? WHERE id=?"
    );
    $stmt->bind_param('ssssii', $tracking, $phone, $goods, $category, $location, $id);
}
$ok           = $stmt->execute();
$affected     = $stmt->affected_rows;
$stmt->close();
$conn->close();

if (!$ok)         echo json_encode(['error' => '更新失败']);
elseif ($affected === 0) echo json_encode(['error' => "id={$id} 未命中任何行，affected_rows=0"]);
else              echo json_encode(['success' => true, 'affected' => $affected]);
