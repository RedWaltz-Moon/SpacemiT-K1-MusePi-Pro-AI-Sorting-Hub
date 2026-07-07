<?php
// require_once 'db.php' 和 'cors.php' 必须在本文件之前 include
// 用法: $user = require_auth();          // 任意登录用户
//       $user = require_auth('admin');   // 仅管理员

function require_auth($requireRole = null) {
    global $currentUser;

    // 优先 Bearer token（App 端）
    $authHeader = '';
    if (function_exists('getallheaders')) {
        $h = getallheaders();
        $authHeader = $h['Authorization'] ?? $h['authorization'] ?? '';
    }
    if ($authHeader === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    if (str_starts_with($authHeader, 'Bearer ')) {
        $token = substr($authHeader, 7);
        $conn  = db();
        $stmt  = $conn->prepare("SELECT phone, role, display_name FROM user_tokens WHERE token = ? LIMIT 1");
        $stmt->bind_param('s', $token);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $conn->close();

        if ($row) {
            $currentUser = $row;
            if ($requireRole && $currentUser['role'] !== $requireRole) {
                http_response_code(403);
                echo json_encode(['error' => '无权限']);
                exit;
            }
            return $currentUser;
        }
        http_response_code(401);
        echo json_encode(['error' => 'Token 无效或已过期，请重新登录']);
        exit;
    }

    // 回退到 Session（Web 端）
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!empty($_SESSION['logged_in'])) {
        $currentUser = [
            'phone'        => $_SESSION['phone']        ?? '',
            'role'         => $_SESSION['role']         ?? 'user',
            'display_name' => $_SESSION['display_name'] ?? '',
        ];
        if ($requireRole && $currentUser['role'] !== $requireRole) {
            http_response_code(403);
            echo json_encode(['error' => '无权限']);
            exit;
        }
        return $currentUser;
    }

    http_response_code(401);
    echo json_encode(['error' => '请先登录']);
    exit;
}
