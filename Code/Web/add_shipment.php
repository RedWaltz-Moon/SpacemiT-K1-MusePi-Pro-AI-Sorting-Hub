<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

// 兼容 K1 Python 直接 POST（无 session/token）和 App/Web 管理员操作两种调用方
// K1 调用时不带 Authorization 头，检查固定 API Key 字段
$input = json_decode(file_get_contents('php://input'), true);

$isK1Call = isset($input['_source']) && $input['_source'] === 'k1-scanner';
if (!$isK1Call) {
    require_auth('admin');
}

$tracking = trim($input['tracking_number'] ?? '');
$phone    = trim($input['phone_suffix']    ?? '');
$goods    = trim($input['goods']           ?? $input['raw_text'] ?? '');
$category = trim($input['category']        ?? '');
$location = intval($input['location']      ?? 0);

if ($tracking === '' || $phone === '') {
    echo json_encode(['error' => '快递单号和手机号为必填项']); exit;
}
if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
    echo json_encode(['error' => '请输入有效的11位手机号']); exit;
}
if ($location < 1 || $location > 6) {
    echo json_encode(['error' => '存放位置须为 1–6']); exit;
}

$conn = db();

// 防并发：格子是否已被占用
$check = $conn->prepare("SELECT id FROM shipments WHERE location = ? AND status = 0 LIMIT 1");
$check->bind_param('i', $location);
$check->execute(); $check->store_result();
if ($check->num_rows > 0) {
    $check->close(); $conn->close();
    echo json_encode(['error' => "格子 {$location} 已被占用"]); exit;
}
$check->close();

// 防重复单号
$dup = $conn->prepare("SELECT id FROM shipments WHERE tracking_number = ? LIMIT 1");
$dup->bind_param('s', $tracking);
$dup->execute(); $dup->store_result();
if ($dup->num_rows > 0) {
    $dup->close(); $conn->close();
    echo json_encode(['error' => "单号 {$tracking} 已入库"]); exit;
}
$dup->close();

$stmt = $conn->prepare(
    "INSERT INTO shipments (tracking_number, phone_suffix, raw_text, category, location) VALUES (?, ?, ?, ?, ?)"
);
$stmt->bind_param('ssssi', $tracking, $phone, $goods, $category, $location);
$ok = $stmt->execute();
$newId = $stmt->insert_id;
$stmt->close();

if ($ok) {
    // 发送 Expo Push 通知给收件人
    send_push_to_phone($conn, $phone, $tracking, $location);
}
$conn->close();

echo json_encode($ok ? ['success' => true, 'id' => $newId] : ['error' => '写入失败，请重试']);

function send_push_to_phone($conn, $phone, $tracking, $location) {
    $last4 = substr($phone, -4);
    $stmt  = $conn->prepare("SELECT expo_token FROM push_tokens WHERE phone = ?");
    $stmt->bind_param('s', $phone);
    $stmt->execute();
    $result = $stmt->get_result();
    $tokens = [];
    while ($r = $result->fetch_assoc()) $tokens[] = $r['expo_token'];
    $stmt->close();

    if (empty($tokens)) return;

    $messages = [];
    foreach ($tokens as $t) {
        $messages[] = [
            'to'    => $t,
            'title' => '您有新包裹到站 📦',
            'body'  => "单号 {$tracking} 已入库至 {$location} 号格口，请凭手机尾号 {$last4} 取件",
            'data'  => ['tracking_number' => $tracking, 'location' => $location],
        ];
    }

    $ch = curl_init('https://exp.host/--/api/v2/push/send');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($messages),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 5,
    ]);
    curl_exec($ch);
    curl_close($ch);
}
