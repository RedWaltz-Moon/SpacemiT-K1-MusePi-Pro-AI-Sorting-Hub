<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$phone    = trim($input['phone'] ?? '');
$password = $input['password'] ?? '';
$confirm  = $input['confirm_password'] ?? '';
$captcha  = trim($input['captcha'] ?? '');

if ($phone === '' || $password === '' || $confirm === '' || $captcha === '') {
    echo json_encode(['error' => '请填写所有字段']);
    exit;
}

// 验证码校验（10 分钟有效期）
$storedAnswer = $_SESSION['captcha_answer'] ?? '';
$captchaTime  = $_SESSION['captcha_time']   ?? 0;
unset($_SESSION['captcha_answer'], $_SESSION['captcha_time']); // 用完即销

if ($storedAnswer === '' || (time() - $captchaTime) > 600) {
    echo json_encode(['error' => '验证码已过期，请刷新重试', 'refresh_captcha' => true]);
    exit;
}
if ($captcha !== $storedAnswer) {
    echo json_encode(['error' => '验证码错误，请重新输入', 'refresh_captcha' => true]);
    exit;
}

if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
    echo json_encode(['error' => '请输入有效的11位手机号']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['error' => '密码至少6位']);
    exit;
}

if ($password !== $confirm) {
    echo json_encode(['error' => '两次密码不一致']);
    exit;
}

$conn = new mysqli('localhost', 'redwaltz', '123456', 'qiansai');
if ($conn->connect_error) {
    echo json_encode(['error' => '数据库连接失败']);
    exit;
}

// 检查手机号是否已注册
$stmt = $conn->prepare("SELECT id FROM users WHERE phone = ? LIMIT 1");
$stmt->bind_param('s', $phone);
$stmt->execute();
$stmt->store_result();
$exists = $stmt->num_rows > 0;
$stmt->close();

if ($exists) {
    $conn->close();
    echo json_encode(['error' => '该手机号已注册，请直接登录']);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO users (phone, password_hash) VALUES (?, ?)");
$stmt->bind_param('ss', $phone, $hash);
$ok = $stmt->execute();
$stmt->close();
$conn->close();

if ($ok) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['error' => '注册失败，请重试']);
}
