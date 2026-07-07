<?php
// 返回当前进行中的取件请求（供管理端货架高亮展示）
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');

require_auth('admin');

$conn   = db();
$result = $conn->query(
    "SELECT locker, status, phone FROM pickup_requests
     WHERE status IN ('pending','processing') ORDER BY created_at ASC"
);
$rows = [];
while ($row = $result->fetch_assoc()) $rows[] = ['locker' => (int)$row['locker'], 'status' => $row['status']];
$conn->close();
echo json_encode($rows);
