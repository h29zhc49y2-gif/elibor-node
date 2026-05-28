<?php
require '/var/www/server/lib/Database.php';
require '/var/www/server/models/User.php';

$user = new User();
$existing = $user->getByEmail('test@elibor.com');

if ($existing) {
    echo "User found: " . $existing['email'] . "\n";
    echo "Password hash: " . substr($existing['password'], 0, 20) . "...\n";
    
    $test = password_verify('test123456', $existing['password']);
    echo "Password verify: " . ($test ? 'OK' : 'FAIL') . "\n";
} else {
    echo "User not found\n";
}
?>