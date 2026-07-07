<?php
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$account  = trim($input['account']  ?? '');
$password = $input['password']       ?? '';

if ($account === '' || $password === '') {
    echo json_encode(['error' => '请填写账号和密码']); exit;
}

function make_token($conn, $phone, $role, $displayName) {
    $token = bin2hex(random_bytes(32));
    $stmt  = $conn->prepare(
        "INSERT INTO user_tokens (token, phone, role, display_name) VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param('ssss', $token, $phone, $role, $displayName);
    $stmt->execute();
    $stmt->close();
    return $token;
}

// 管理员固定账号
if ($account === 'root' && $password === '123456') {
    // Session（Web 端）
    if (session_status() === PHP_SESSION_NONE) session_start();
    $_SESSION['logged_in']    = true;
    $_SESSION['role']         = 'admin';
    $_SESSION['phone']        = '';
    $_SESSION['display_name'] = '管理员';

    $conn  = db();
    $token = make_token($conn, '', 'admin', '管理员');
    $conn->close();

    echo json_encode([
        'success'      => true,
        'role'         => 'admin',
        'token'        => $token,
        'display_name' => '管理员',
        'phone'        => '',
    ]);
    exit;
}

// 普通用户
$conn = db();
$stmt = $conn->prepare("SELECT id, phone, password_hash FROM users WHERE phone = ? LIMIT 1");
$stmt->bind_param('s', $account);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $conn->close();
    echo json_encode(['error' => '手机号或密码错误']); exit;
}

$displayName = substr($user['phone'], 0, 3) . '****' . substr($user['phone'], -4);
$token       = make_token($conn, $user['phone'], 'user', $displayName);
$conn->close();

// Session（Web 端兼容）
if (session_status() === PHP_SESSION_NONE) session_start();
$_SESSION['logged_in']    = true;
$_SESSION['role']         = 'user';
$_SESSION['phone']        = $user['phone'];
$_SESSION['display_name'] = $displayName;

echo json_encode([
    'success'      => true,
    'role'         => 'user',
    'token'        => $token,
    'display_name' => $displayName,
    'phone'        => $user['phone'],
]);
