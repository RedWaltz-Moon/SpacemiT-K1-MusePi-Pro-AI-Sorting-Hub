<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$user  = require_auth();
$role  = $user['role'];
$phone = $user['phone'];

$conn = db();

$daily  = [];
$weekly = [];

for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $daily[$d] = 0;
}
for ($i = 7; $i >= 0; $i--) {
    $w = date('o-\WW', strtotime("-{$i} weeks"));
    $weekly[$w] = 0;
}

if ($role === 'admin') {
    $stmt = $conn->prepare(
        "SELECT created_at FROM shipments WHERE status = 1 AND created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)"
    );
} else {
    $stmt = $conn->prepare(
        "SELECT created_at FROM shipments WHERE status = 1 AND phone_suffix = ?
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)"
    );
    $stmt->bind_param('s', $phone);
}
$stmt->execute();
$result = $stmt->get_result();
while ($row = $result->fetch_assoc()) {
    $ts   = strtotime($row['created_at']);
    $dKey = date('Y-m-d', $ts);
    $wKey = date('o-\WW', $ts);
    if (isset($daily[$dKey]))  $daily[$dKey]++;
    if (isset($weekly[$wKey])) $weekly[$wKey]++;
}
$stmt->close();
$conn->close();

$dailyArr = [];
foreach ($daily as $date => $count) {
    $dailyArr[] = ['date' => $date, 'label' => date('n/j', strtotime($date)), 'count' => $count];
}
$weeklyArr = [];
foreach ($weekly as $week => $count) {
    [$year, $w] = explode('-W', $week);
    $monday = date('n/j', strtotime("$year-W$w-1"));
    $weeklyArr[] = ['week' => $week, 'label' => $monday . '周', 'count' => $count];
}

echo json_encode(['daily' => $dailyArr, 'weekly' => $weeklyArr]);
