<?php

require dirname(__DIR__).'/vendor/autoload.php';

foreach (['APP_KEY' => 'base64:'.base64_encode(random_bytes(32)), 'KEY_FINGERPRINT_SECRET' => bin2hex(random_bytes(32))] as $name => $value) {
    putenv($name.'='.$value);
    $_ENV[$name] = $_SERVER[$name] = $value;
}
