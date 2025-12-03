<?php
declare(strict_types=1);

// Proxy d'upload de CV vers Grist, avec Guzzle.
// Expects POST multipart/form-data: file (binaire), benef_id (rowId).

require __DIR__ . '/vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

// Simple loader .env (clé=valeur) si présent dans ce dossier
function load_env(string $path): void {
    if (!is_file($path)) return;
    foreach (file($path) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (!str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v, " \t\n\r\0\x0B\"'");
        if ($k !== '' && getenv($k) === false) {
          putenv("$k=$v");
          $_ENV[$k] = $v;
          $_SERVER[$k] = $v;
        }
    }
}
load_env(__DIR__ . '/.env');

$GRIST_BASE_URL = rtrim(getenv('GRIST_BASE_URL') ?: 'https://grist.numerique.gouv.fr', '/');
$GRIST_DOC_ID   = getenv('GRIST_DOC_ID')   ?: 'YOUR_DOC_ID';
$GRIST_TABLE    = getenv('GRIST_BENEF_TABLE') ?: 'Beneficiaires';
$GRIST_API_KEY  = getenv('GRIST_API_KEY') ?: 'YOUR_API_KEY';
$TARGET_COL     = getenv('GRIST_CV_COL') ?: 'curriculum_vitae';

// CORS permissif pour appels front
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
//header('Content-Type: application/json');

function respond(int $status, string $msg, array $extra = []): never {
    http_response_code($status);
    echo json_encode(array_merge(['ok' => $status >= 200 && $status < 300, 'message' => $msg], $extra));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, 'Method not allowed');
}

$file = $_FILES['file'] ?? $_FILES['cv'] ?? null;
$benefId = isset($_POST['benef_id']) ? (int)$_POST['benef_id'] : 0;
if (!$file || $benefId <= 0) {
    respond(400, 'Missing file or benef_id', ['debug' => ['files' => $_FILES, 'post' => $_POST]]);
}
$tmp = $file['tmp_name'] ?? '';
if (!$tmp || !is_readable($tmp)) {
    respond(400, 'Fichier manquant ou illisible');
}

$client = new Client([
    'headers' => [
        'Authorization' => "Bearer {$GRIST_API_KEY}",
    ],
    'http_errors' => false,
    'verify' => true,
]);

try {
    // 1) Upload attachment
    $attachUrl = "{$GRIST_BASE_URL}/api/docs/{$GRIST_DOC_ID}/attachments";
    
    $resp = $client->post($attachUrl, [
        'multipart' => [
            [
                'name'     => 'upload',
                'contents' => fopen($tmp, 'rb'),
                'filename' => basename($file['name'] ?? 'file'),
                'headers'  => ['Content-Type' => $file['type'] ?: 'application/octet-stream'],
            ],
        ],
    ]);

    $status = $resp->getStatusCode();
    $body = (string)$resp->getBody();

    if ($status < 200 || $status >= 300) {
        respond(502, 'Upload attachment failed', ['status' => $status, 'response' => $body]);
    }
    $json = json_decode($body, true);
    $attachmentId = null;
    if (is_array($json)) {
        if (isset($json[0]) && is_numeric($json[0])) $attachmentId = $json[0];
        if (isset($json['id'])) $attachmentId = $json['id'];
        if (isset($json['attachmentId'])) $attachmentId = $json['attachmentId'];
    }
    if (!$attachmentId) {
        respond(500, 'No attachment ID returned by Grist', ['response' => $json]);
    }

    // 2) Update Beneficiaires row
    $updateUrl = "{$GRIST_BASE_URL}/api/docs/{$GRIST_DOC_ID}/tables/{$GRIST_TABLE}/records";
    
    $payload = [
        'records' => [
            [
                'id' => $benefId,
                'fields' => [
                    $TARGET_COL => ["L",$attachmentId],
                ],
            ],
        ],
    ];
    
    $resp2 = $client->patch($updateUrl, [
        'json' => $payload,
    ]);
    $status2 = $resp2->getStatusCode();
    $body2 = (string)$resp2->getBody();
    if ($status2 < 200 || $status2 >= 300) {
        respond(502, 'Update record failed', ['status' => $status2, 'response' => $body2]);
    }

    respond(200, 'CV uploaded', ['attachment_id' => $attachmentId]);
} catch (GuzzleException $e) {
    respond(500, 'Unexpected error', ['error' => $e->getMessage()]);
}
