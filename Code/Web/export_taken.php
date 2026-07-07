<?php
session_start();

if (empty($_SESSION['logged_in']) || ($_SESSION['role'] ?? '') !== 'admin') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => '无权限']);
    exit;
}

$conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => '数据库连接失败']);
    exit;
}

$dateFrom = $_GET['from'] ?? '';
$dateTo   = $_GET['to']   ?? '';

$sql    = "SELECT id, tracking_number, phone_suffix, raw_text, category, location, created_at
           FROM shipments WHERE status = 1";
$types  = '';
$params = [];

if ($dateFrom !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    $sql      .= " AND created_at >= ?";
    $types    .= 's';
    $params[]  = $dateFrom . ' 00:00:00';
}
if ($dateTo !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    $sql      .= " AND created_at <= ?";
    $types    .= 's';
    $params[]  = $dateTo . ' 23:59:59';
}
$sql .= " ORDER BY created_at DESC LIMIT 5000";

$stmt = $conn->prepare($sql);
if ($types !== '') {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();

$filename = '取件记录_' . date('Ymd_His');
if ($dateFrom !== '' || $dateTo !== '') {
    $filename .= '_' . ($dateFrom ?: 'start') . '_to_' . ($dateTo ?: 'now');
}
$filename .= '.csv';

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache, must-revalidate');

// UTF-8 BOM 保证 Excel 正常打开中文
echo "\xEF\xBB\xBF";

$out = fopen('php://output', 'w');
fputcsv($out, ['ID', '快递单号', '手机号', '物品信息', '分类', '原位置', '入库时间']);

while ($row = $result->fetch_assoc()) {
    fputcsv($out, [
        $row['id'],
        $row['tracking_number'],
        $row['phone_suffix'],
        $row['raw_text'],
        $row['category'],
        $row['location'],
        $row['created_at'],
    ]);
}

fclose($out);
$stmt->close();
$conn->close();
