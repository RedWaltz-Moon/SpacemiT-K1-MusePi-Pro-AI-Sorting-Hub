<?php
session_start();

$ops = ['+', '-', '*'];
$op  = $ops[array_rand($ops)];

switch ($op) {
    case '+':
        $a = rand(1, 20); $b = rand(1, 20);
        $answer = $a + $b;
        break;
    case '-':
        $a = rand(5, 20); $b = rand(1, $a);
        $answer = $a - $b;
        break;
    case '*':
        $a = rand(2, 9); $b = rand(2, 9);
        $answer = $a * $b;
        break;
}

$_SESSION['captcha_answer'] = (string)$answer;
$_SESSION['captcha_time']   = time();

// 干扰字符
$noise = '';
for ($i = 0; $i < 6; $i++) {
    $nx = rand(4, 156); $ny = rand(4, 36);
    $c  = chr(rand(65, 90));
    $noise .= "<text x=\"$nx\" y=\"$ny\" font-size=\"11\" fill=\"#ccc\" transform=\"rotate(" . rand(-20,20) . ",$nx,$ny)\">$c</text>";
}

// 干扰线
$lines = '';
for ($i = 0; $i < 4; $i++) {
    $x1 = rand(0,160); $y1 = rand(0,40);
    $x2 = rand(0,160); $y2 = rand(0,40);
    $lines .= "<line x1=\"$x1\" y1=\"$y1\" x2=\"$x2\" y2=\"$y2\" stroke=\"#ddd\" stroke-width=\"1\"/>";
}

$display = "$a $op $b = ?";

header('Content-Type: image/svg+xml');
header('Cache-Control: no-store, no-cache, must-revalidate');
echo <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40" style="background:#f7f8fa;border-radius:6px;">
  $lines
  $noise
  <text x="50%" y="27" font-size="18" font-weight="700"
        font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif"
        fill="#344054" text-anchor="middle" letter-spacing="3">$display</text>
</svg>
SVG;
