<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Testing API...<br>";

$db = [
    'host' => 'srv1759.hstgr.io',
    'name' => 'u568419520_elibor',
    'user' => 'u568419520_elibor',
    'pass' => 'Joe8675731?!'
];

try {
    echo "Connecting to database...<br>";
    $pdo = new PDO(
        "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
        $db['user'],
        $db['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo "✅ Database connected!<br>";
    
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM users");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Users count: " . $result['cnt'] . "<br>";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "<br>";
    echo "Code: " . $e->getCode() . "<br>";
}
?>