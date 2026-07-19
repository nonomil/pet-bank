import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(process.env.PETBANK_STATIC_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const host = process.env.PETBANK_HOST || '127.0.0.1';
const port = Number(process.env.PETBANK_PORT || 7000);
const testMode = process.env.PETBANK_TEST_MODE === '1';

if (testMode && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('PETBANK_TEST_MODE is only allowed on a loopback host.');
}

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webp': 'image/webp',
};

function isInsideRoot(candidate) {
    const relative = path.relative(repoRoot, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function decodeRequestPath(requestUrl) {
    const pathname = new URL(requestUrl || '/', `http://${host}`).pathname;
    return decodeURIComponent(pathname);
}

function resolveFile(requestUrl) {
    const requestPath = decodeRequestPath(requestUrl);
    const candidate = path.resolve(repoRoot, `.${requestPath}`);
    if (!isInsideRoot(candidate)) return null;

    try {
        if (fs.statSync(candidate).isFile()) return candidate;
        if (fs.statSync(candidate).isDirectory()) {
            const indexPath = path.join(candidate, 'index.html');
            if (fs.existsSync(indexPath)) return indexPath;
        }
    } catch (_) {
        // A missing path is handled by the route fallback or a normal 404.
    }

    // Browsers may resolve relative shell assets against a deep route before
    // the runtime base element is applied. Serve those requests as aliases to
    // the shared root assets during local development.
    const deepAssetMatch = requestPath.match(/^\/(?:app|parent|settings)(?:\/[^/]+)*\/(css|js|assets|data|prj)\/(.+)$/);
    if (deepAssetMatch) {
        const rootAsset = path.resolve(repoRoot, `./${deepAssetMatch[1]}/${deepAssetMatch[2]}`);
        if (isInsideRoot(rootAsset)) {
            try {
                if (fs.statSync(rootAsset).isFile()) return rootAsset;
            } catch (_) {
                // Continue to the normal route fallback or 404.
            }
        }
    }

    // Match the static Pages shell for direct app/parent/settings deep links.
    if (!path.extname(requestPath) && /^(?:\/app|\/parent|\/settings)(?:\/|$)/.test(requestPath)) {
        return path.join(repoRoot, 'index.html');
    }
    return null;
}

function sendFile(response, filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const headers = {
        'Cache-Control': extension === '.html' ? 'no-store' : 'no-cache',
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    };
    if (testMode && extension === '.html') {
        const source = fs.readFileSync(filePath, 'utf8');
        const marker = '<script>window.__PETBANK_TEST_MODE__ = true;</script>';
        response.writeHead(200, headers);
        response.end(source.replace('<head>', `<head>${marker}`));
        return;
    }
    response.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer((request, response) => {
    try {
        const filePath = resolveFile(request.url);
        if (!filePath) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('404 Not Found');
            return;
        }
        if (request.method === 'HEAD') {
            response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
            response.end();
            return;
        }
        sendFile(response, filePath);
    } catch (error) {
        console.error('[local-server] request failed:', error);
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('500 Internal Server Error');
    }
});

server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`[local-server] listening at http://${host}:${actualPort}/${testMode ? ' (TEST MODE: local access gate bypassed)' : ''}`);
});

function shutdown() {
    server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
