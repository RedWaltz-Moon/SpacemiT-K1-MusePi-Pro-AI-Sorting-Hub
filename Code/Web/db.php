<?php
function db() {
    $conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
    if ($conn->connect_error) {
        http_response_code(503);
        echo json_encode(['error' => '数据库连接失败']);
        exit;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}
