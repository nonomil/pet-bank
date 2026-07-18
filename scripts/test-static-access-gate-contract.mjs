import fs from 'node:fs';
import path from 'node:path';

const nginxStaticPath = path.join(process.cwd(), 'prj', 'petbank-server', 'deploy', 'nginx-static-gate.conf');
const nginxApiPath = path.join(process.cwd(), 'prj', 'petbank-server', 'deploy', 'nginx-api.conf');
const staticConfig = fs.readFileSync(nginxStaticPath, 'utf8');
const apiConfig = fs.readFileSync(nginxApiPath, 'utf8');

function fail(message) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
}

for (const required of [
    'auth_request /_petbank_static_auth;',
    'location = / {',
    'location = /app/picturebooks {',
    'location ^~ /app/picturebooks/ {',
    'location = /app/playground {',
    'location ^~ /app/playground/ {',
    'location = /parent/ {',
    'location = /settings {',
    'location = /settings/ {',
    'location ^~ /settings/family/ {',
    'location ^~ /settings/account/ {',
    'location ^~ /parent/settings/family/ {',
    'location ^~ /app/ {',
    'location ^~ /settings/ {',
    'error_page 401 403 =302 /parent/;',
]) {
    if (!staticConfig.includes(required)) fail(`static gate must contain ${required}`);
}

for (const required of [
    'location = /_petbank_static_auth {',
    'proxy_pass http://127.0.0.1:3000/api/v1/auth/check;',
    'proxy_set_header Cookie $http_cookie;',
    'location /api/ {',
]) {
    if (!apiConfig.includes(required)) fail(`API gate contract must contain ${required}`);
}

if (staticConfig.includes('location ^~ / {')) fail('static gate must not make every path public');
if (process.exitCode) process.exit(process.exitCode);
console.log('PASS static access gate contract');
