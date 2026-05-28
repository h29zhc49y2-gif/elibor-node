<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['REQUEST_URI'] = '/api/users/login';
$_SERVER['HTTP_CONTENT_TYPE'] = 'application/json';

$body = json_encode(['email' => 'test@elibor.com', 'password' => 'test123456']);

$ch = curl_init('http://127.0.0.1:8080/api/users/login');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$error = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

file_put_contents('/tmp/api_response.txt', "Code: $httpCode\nResponse: $response\nError: $error\n");
echo "HTTP Code: $httpCode\nResponse: $response\n";
if ($error) echo "Error: $error\n";
?>