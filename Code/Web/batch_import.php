<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['logged_in']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => '无权限']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$rows  = $input['rows'] ?? [];

if (!is_array($rows) || count($rows) === 0) {
    echo json_encode(['error' => '无有效数据']);
    exit;
}

$conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
if ($conn->connect_error) { echo json_encode(['error' => '连接失败']); exit; }

// 提取本批次所有单号，查询已存在的
$trackingList = array_filter(array_map(fn($r) => trim($r['tracking_number'] ?? ''), $rows));
$existingSet  = [];

if (!empty($trackingList)) {
    $placeholders = implode(',', array_fill(0, count($trackingList), '?'));
    $chk = $conn->prepare(
        "SELECT tracking_number FROM shipments WHERE tracking_number IN ($placeholders)"
    );
    $types = str_repeat('s', count($trackingList));
    $chk->bind_param($types, ...array_values($trackingList));
    $chk->execute();
    $chkResult = $chk->get_result();
    while ($row = $chkResult->fetch_assoc()) {
        $existingSet[$row['tracking_number']] = true;
    }
    $chk->close();
}

$stmt = $conn->prepare(
    "INSERT INTO shipments (tracking_number, phone_suffix, raw_text, category, location) VALUES (?, ?, ?, ?, ?)"
);

$imported  = 0;
$skipped   = 0;
$duplicates = [];

foreach ($rows as $r) {
    $tracking = trim($r['tracking_number'] ?? '');
    $phone    = trim($r['phone_suffix']    ?? '');
    $goods    = trim($r['goods']           ?? '');
    $category = trim($r['category']        ?? '其他');
    $location = intval($r['location']      ?? 0);

    if ($tracking === '' || $location < 1 || $location > 6) { $skipped++; continue; }

    if (isset($existingSet[$tracking])) {
        $duplicates[] = $tracking;
        $skipped++;
        continue;
    }

    $stmt->bind_param('ssssi', $tracking, $phone, $goods, $category, $location);
    if ($stmt->execute()) {
        $imported++;
        $existingSet[$tracking] = true; // 防止同批次重复
    } else {
        $skipped++;
    }
}

$stmt->close();
$conn->close();

$resp = ['success' => true, 'imported' => $imported, 'skipped' => $skipped];
if (!empty($duplicates)) {
    $resp['duplicates'] = array_slice($duplicates, 0, 10); // 最多返回10条示例
    $resp['duplicate_count'] = count($duplicates);
}

echo json_encode($resp);
