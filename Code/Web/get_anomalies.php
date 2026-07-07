<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

require_auth('admin');

$conn = db();
$stmt = $conn->prepare(
    "SELECT id, `type`, phone_suffix, tracking_number, raw_text, category, location,
            description, status, created_at
     FROM anomaly_reports ORDER BY id DESC LIMIT 500"
);
$stmt->execute();
$result = $stmt->get_result();
$data   = [];
while ($row = $result->fetch_assoc()) $data[] = $row;
$stmt->close();
$conn->close();

echo json_encode($data);
