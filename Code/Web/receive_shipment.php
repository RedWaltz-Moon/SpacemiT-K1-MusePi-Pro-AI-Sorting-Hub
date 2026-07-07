<?php
// 接收JSON数据
$json_data = file_get_contents('php://input');
$data = json_decode($json_data, true);

// 验证必要字段
if (!$data || !isset($data['tracking_number']) || !isset($data['phone_suffix']) || !isset($data['raw_text'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: tracking_number, phone_suffix, raw_text']);
    exit;
}

$tracking_number = $data['tracking_number'];
$phone_suffix    = $data['phone_suffix'];
$raw_text        = $data['raw_text'];
// 直接使用 Python 已分类好的 category，若缺失则回退到保密发货
$category        = isset($data['category']) && $data['category'] !== '' ? $data['category'] : '保密发货';
// 直接使用 Python 查询空位后传来的 location
$location        = isset($data['location']) ? intval($data['location']) : 0;

if ($location < 1 || $location > 6) {
    http_response_code(400);
    echo json_encode(['error' => '无效的位置编号']);
    exit;
}

// 连接数据库
$servername = "localhost";
$username = "redwaltz";
$password = "123456";
$dbname = "qiansai";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// 二次确认格子未被占用（防止并发重复）
$check = $conn->prepare("SELECT id FROM shipments WHERE location = ? AND status = 0 LIMIT 1");
$check->bind_param('i', $location);
$check->execute();
$check->store_result();
if ($check->num_rows > 0) {
    $check->close();
    $conn->close();
    http_response_code(409);
    echo json_encode(['error' => "格子 {$location} 已被占用，请重新扫描"]);
    exit;
}
$check->close();

// 检查单号是否已入库
$dup = $conn->prepare("SELECT id FROM shipments WHERE tracking_number = ? LIMIT 1");
$dup->bind_param('s', $tracking_number);
$dup->execute();
$dup->store_result();
if ($dup->num_rows > 0) {
    $dup->close();
    $conn->close();
    http_response_code(409);
    echo json_encode(['error' => "单号 {$tracking_number} 已入库，禁止重复"]);
    exit;
}
$dup->close();

// 插入数据（created_at 自动生成）
$sql = "INSERT INTO shipments (tracking_number, phone_suffix, raw_text, category, location) VALUES (?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
$stmt->bind_param("ssssi", $tracking_number, $phone_suffix, $raw_text, $category, $location);

if ($stmt->execute()) {
    echo json_encode(['status' => 'success', 'id' => $stmt->insert_id]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save data: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
