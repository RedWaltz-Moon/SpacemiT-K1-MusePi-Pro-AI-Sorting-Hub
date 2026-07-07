<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$user  = require_auth();
$role  = $user['role'];
$phone = $user['phone'];

$conn   = db();
$limit     = isset($_GET['limit'])  ? max(1, min(500, intval($_GET['limit']))) : 200;
$statusRaw = $_GET['status'] ?? '0';
$allStatus = ($statusRaw === 'all' && $role === 'admin');
$status    = $allStatus ? 0 : intval($statusRaw);
if (!$allStatus && $status !== 0 && $status !== 1) $status = 0;

if ($role === 'admin' && $allStatus) {
    $stmt = $conn->prepare(
        "SELECT id, tracking_number, phone_suffix, raw_text, category, location, created_at, status
         FROM shipments ORDER BY id DESC LIMIT ?"
    );
    $stmt->bind_param('i', $limit);
} elseif ($role === 'admin') {
    $stmt = $conn->prepare(
        "SELECT id, tracking_number, phone_suffix, raw_text, category, location, created_at, status
         FROM shipments WHERE status = ? ORDER BY id DESC LIMIT ?"
    );
    $stmt->bind_param('ii', $status, $limit);
} else {
    $stmt = $conn->prepare(
        "SELECT id, tracking_number, phone_suffix, raw_text, category, location, created_at, status
         FROM shipments WHERE (phone_suffix = ? OR ? LIKE CONCAT('%', phone_suffix)) AND status = ? ORDER BY id DESC LIMIT ?"
    );
    $stmt->bind_param('ssii', $phone, $phone, $status, $limit);
}

$stmt->execute();
$result = $stmt->get_result();
$data   = [];
while ($row = $result->fetch_assoc()) $data[] = $row;
$stmt->close();
$conn->close();

echo json_encode($data);
