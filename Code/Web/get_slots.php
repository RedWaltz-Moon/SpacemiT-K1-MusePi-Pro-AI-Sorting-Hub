<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');

$conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
if ($conn->connect_error) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// 查询当前仍在库（status=0）的格子编号；status=1 表示已取走，视为空闲
$result   = $conn->query("SELECT DISTINCT location FROM shipments WHERE location BETWEEN 1 AND 6 AND status = 0");
$occupied = [];
while ($row = $result->fetch_assoc()) {
    $occupied[] = (int)$row['location'];
}
$conn->close();

// state=1：空闲可入库；state=0：已有包裹（占用）
$slots = [];
for ($i = 1; $i <= 6; $i++) {
    $slots[] = [
        'id'    => $i,
        'state' => in_array($i, $occupied) ? 0 : 1,
    ];
}

echo json_encode($slots);
