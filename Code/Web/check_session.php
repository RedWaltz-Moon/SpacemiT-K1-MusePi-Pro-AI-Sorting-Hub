<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!empty($_SESSION['logged_in'])) {
    echo json_encode([
        'logged_in'    => true,
        'role'         => $_SESSION['role'],
        'display_name' => $_SESSION['display_name'],
        'phone'        => $_SESSION['phone'],
    ]);
} else {
    echo json_encode(['logged_in' => false]);
}
