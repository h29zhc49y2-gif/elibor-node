<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
$db = [
    'host' => 'localhost',
    'name' => 'u568419520_elibor',
    'user' => 'u568419520_root',
    'pass' => 'Joe8675731'
];

try {
    $pdo = new PDO(
        "mysql:host={$db['host']};dbname={$db['name']}",
        $db['user'],
        $db['pass']
    );
} catch (PDOException $e) {
    die(json_encode(['code' => 500, 'message' => 'DB Error']));
}

function res($code, $msg, $data = null) {
    http_response_code($code);
    echo json_encode(['code' => $code, 'message' => $msg, 'data' => $data]);
    exit;
}

function getAuth() {
    $h = getallheaders();
    $a = $h['Authorization'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $a, $m)) {
        return trim($m[1]);
    }
    return null;
}

function getBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Login
if ($method === 'POST' && $path === '/api/users/login') {
    $d = getBody();
    if (empty($d['email']) || empty($d['password'])) res(400, 'Missing params');
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email=?");
    $stmt->execute([$d['email']]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$u || !password_verify($d['password'], $u['password'])) {
        res(401, 'Invalid credentials');
    }
    
    $token = base64_encode(json_encode(['sub' => $u['id'], 'exp' => time() + 86400));
    res(200, 'success', ['token' => $token, 'user_id' => $u['id'], 'credits' => $u['credits']]);
}

// Register
if ($method === 'POST' && $path === '/api/users/register') {
    $d = getBody();
    if (empty($d['email']) || empty($d['password']) || empty($d['username'])) {
        res(400, 'Missing params');
    }
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email=?");
    $stmt->execute([$d['email']]);
    if ($stmt->fetch()) res(409, 'Email exists');
    
    $id = 'u' . uniqid();
    $hash = password_hash($d['password'], PASSWORD_ARGON2ID);
    $stmt = $pdo->prepare("INSERT INTO users (id,email,password,username,credits,level,plan,max_souls,daily_interventions,current_interventions) VALUES (?,?,?,?,100,'free','free',1,2,2)");
    $stmt->execute([$id, $d['email'], $hash, $d['username']]);
    
    $token = base64_encode(json_encode(['sub' => $id, 'exp' => time() + 86400]));
    res(200, 'success', ['token' => $token, 'user_id' => $id]);
}

// Me
if ($method === 'GET' && $path === '/api/users/me') {
    $uid = getAuth();
    if (!$uid) res(401, 'Unauthorized');
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id=?");
    $stmt->execute([$uid]);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $stmt = $pdo->prepare("SELECT * FROM souls WHERE user_id=?");
    $stmt->execute([$uid]);
    $souls = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    res(200, 'success', [
        'id' => $u['id'],
        'username' => $u['username'],
        'credits' => $u['credits'],
        'current_interventions' => $u['current_interventions'],
        'daily_interventions' => $u['daily_interventions'],
        'plan' => $u['plan'],
        'souls' => $souls
    ]);
}

// Souls
if ($method === 'GET' && $path === '/api/souls') {
    $uid = getAuth();
    if (!$uid) res(401, 'Unauthorized');
    
    $stmt = $pdo->prepare("SELECT * FROM souls WHERE user_id=?");
    $stmt->execute([$uid]);
    res(200, 'success', $stmt->fetchAll(PDO::FETCH_ASSOC));
}

// Create Soul
if ($method === 'POST' && $path === '/api/souls') {
    $uid = getAuth();
    if (!$uid) res(401, 'Unauthorized');
    
    $d = getBody();
    if (empty($d['name'])) res(400, 'Missing name');
    
    $id = 's' . uniqid();
    $stmt = $pdo->prepare("INSERT INTO souls (id,user_id,name,age,stage,profession,hunger,energy,social,learning,fatigue,emotion,current_action) VALUES (?,?,?,0,'child','miner',100,100,50,50,80,'idle')");
    $stmt->execute([$id, $uid, $d['name']]);
    
    res(200, 'success', ['id' => $id, 'name' => $d['name']]);
}

// Planet Stats
if ($method === 'GET' && $path === '/api/planet/stats') {
    res(200, 'success', [
        'industry' => 25,
        'agriculture' => 20,
        'housing' => 15,
        'technology' => 10,
        'energy' => 30,
        'overall' => 20
    ]);
}

// Interventions
if ($method === 'GET' && $path === '/api/interventions/available') {
    $uid = getAuth();
    if (!$uid) res(401, 'Unauthorized');
    
    res(200, 'success', [
        ['id' => 'feed', 'name' => '喂食'],
        ['id' => 'rest', 'name' => '休息'],
        ['id' => 'work', 'name' => '工作'],
        ['id' => 'social', 'name' => '社交'],
        ['id' => 'learn', 'name' => '学习'],
        ['id' => 'exercise', 'name' => '锻炼']
    ]);
}

// Facilities
if ($method === 'GET' && $path === '/api/facilities/types') {
    res(200, 'success', [
        ['type' => 'mine', 'name' => '采矿站', 'description' => '开采矿石', 'cost' => ['minerals' => 100, 'materials' => 50], 'production' => ['minerals' => 5]],
        ['type' => 'farm', 'name' => '农场', 'description' => '种植食物', 'cost' => ['minerals' => 80, 'materials' => 40], 'production' => ['food' => 4]],
        ['type' => 'power_plant', 'name' => '发电站', 'description' => '产生能源', 'cost' => ['minerals' => 120, 'materials' => 60], 'production' => ['energy' => 6]]
    ]);
}

// Payments Plans
if ($method === 'GET' && $path === '/api/payments/plans') {
    res(200, 'success', [
        ['id' => 'pro_monthly', 'name' => 'Pro月度', 'price' => 30],
        ['id' => 'pro_yearly', 'name' => 'Pro年度', 'price' => 300],
        ['id' => 'max_monthly', 'name' => 'MAX月度', 'price' => 68],
        ['id' => 'max_yearly', 'name' => 'MAX年度', 'price' => 680]
    ]);
}

res(404, 'API Not Found');
