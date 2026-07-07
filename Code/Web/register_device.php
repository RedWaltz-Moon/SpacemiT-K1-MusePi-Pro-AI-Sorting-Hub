<?php
require_once __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

$file = __DIR__ . '/k1_ip.json';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = json_decode(file_get_contents('php://input'), true)['ip'] ?? '';
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid ip']);
        exit;
    }
    file_put_contents($file, json_encode(['ip' => $ip, 'ts' => time()]));
    echo json_encode(['ok' => true]);
} else {
    if (!file_exists($file)) {
        echo json_encode(['ip' => null]);
        exit;
    }
    $data = json_decode(file_get_contents($file), true);
    // 超过 10 分钟视为离线
    if (time() - ($data['ts'] ?? 0) > 600) {
        echo json_encode(['ip' => null, 'reason' => 'stale']);
    } else {
        echo json_encode(['ip' => $data['ip']]);
    }
}
