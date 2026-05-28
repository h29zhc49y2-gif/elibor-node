<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain');

$db = [
    'host' => 'localhost',
    'name' => 'u568419520_root',
    'user' => 'u568419520_root',
    'pass' => 'Jo86775731'
];

echo "Testing database connection...\n";
echo "Host: " . $db['host'] . "\n";
echo "Database: " . $db['name'] . "\n";
echo "User: " . $db['user'] . "\n\n";

try {
    $pdo = new PDO(
        "mysql:host={$db['host']};dbname={$db['name']}",
        $db['user'],
        $db['pass']
    );
    echo "✅ Database connection successful!\n";
    
    $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM users");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Users table count: " . $result['cnt'] . "\n";
    
} catch (PDOException $e) {
    echo "❌ Database connection failed!\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "Code: " . $e->getCode() . "\n";
}

echo "\n--- PHP Info ---\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "PDO Available: " . (extension_loaded('pdo_mysql') ? 'Yes' : 'No') . "\n";