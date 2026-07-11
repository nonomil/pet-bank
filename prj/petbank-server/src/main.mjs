import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { createServer } from './server.mjs';

const config = loadConfig();
const database = openDatabase(config);
const server = createServer({ config, database });

function close() {
    server.close(() => {
        database.close();
        process.exit(0);
    });
}

process.once('SIGINT', close);
process.once('SIGTERM', close);
server.listen(config.port, config.host, () => {
    console.log(`petbank-server listening on http://${config.host}:${config.port}`);
});
