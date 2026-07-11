import http from 'node:http';

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(payload));
}

export function createServer({ config, database }) {
    return http.createServer((request, response) => {
        const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        if (request.method === 'GET' && url.pathname === '/api/v1/health') {
            const migrationCount = database.prepare('select count(*) as count from schema_migrations').get().count;
            return sendJson(response, 200, { ok: true, service: 'petbank-server', migrationCount });
        }
        return sendJson(response, 404, { error: 'not_found', message: 'API route not found.' });
    });
}
