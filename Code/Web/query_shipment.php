<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$phone = trim($_GET['phone'] ?? '');

if ($phone === '') {
    echo json_encode(['error' => '请输入手机号']);
    exit;
}
if (!preg_match('/^\d{7,11}$/', $phone)) {
    echo json_encode(['error' => '手机号格式不正确']);
    exit;
}

$conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
if ($conn->connect_error) { echo json_encode(['error' => '服务暂时不可用']); exit; }

$stmt = $conn->prepare(
    "SELECT id, tracking_number, raw_text, category, location, created_at
     FROM shipments
     WHERE phone_suffix = ? OR phone_suffix LIKE CONCAT('%', RIGHT(?, 4))
     ORDER BY id DESC LIMIT 50"
);
$stmt->bind_param('ss', $phone, $phone);
$stmt->execute();
$result = $stmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) $data[] = $row;

$stmt->close();
$conn->close();

echo json_encode($data);
