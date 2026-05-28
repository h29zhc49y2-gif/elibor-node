<?php
require '/var/www/server/bootstrap.php';

$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/api/users/login';
$_POST = ['email' => 'test@elibor.com', 'password' => 'test123456'];

ob_start();
try {
    $router = new Router();
    require '/var/www/server/routes.php';
    $router->dispatch();
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
$output = ob_get_clean();
echo "Output: " . $output;
?>