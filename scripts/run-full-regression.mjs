import { spawnSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const ROOT = process.cwd();
const BASE_URL = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const TASK_TIMEOUT_MS = Number(process.env.PETBANK_REGRESSION_TASK_TIMEOUT_MS || 120000);

const TASKS = [
    { label: 'regression runner integrity', cmd: 'node', args: ['scripts/test-regression-runner-integrity.mjs'] },
    { label: 'current P0 architecture audit', cmd: 'node', args: ['scripts/p0-audit.js'] },
    { label: 'task catalog contract', cmd: 'node', args: ['scripts/test-task-catalog.mjs'] },
    { label: 'page router contract', cmd: 'node', args: ['scripts/test-page-router-contract.mjs'] },
    { label: 'runtime loader retry contract', cmd: 'node', args: ['scripts/test-runtime-loader-retry.mjs'] },
    { label: 'no legacy account runtime', cmd: 'node', args: ['scripts/test-no-legacy-account-runtime.mjs'] },
    { label: 'runtime loader route base contract', cmd: 'node', args: ['prj/runtime_loader_route_base_contract.test.mjs'] },
    { label: 'route-aware shell contract', cmd: 'node', args: ['prj/route_aware_shell_contract.test.mjs'] },
    { label: 'profile isolation journey', cmd: 'node', args: ['prj/profile_isolation_journey_simulation.mjs'] },
    { label: 'growth review insights contract', cmd: 'node', args: ['prj/growth_review_insights_contract.test.mjs'] },
    { label: 'parent SQLite account boundary', cmd: 'node', args: ['prj/parent_sqlite_account_boundary_contract.test.mjs'] },
    { label: 'parent account browser journey', cmd: 'node', args: ['scripts/test-parent-account-browser.mjs'] },
    { label: 'petbank server config', cmd: 'node', args: ['--test', 'prj/petbank-server/test/config.test.mjs'] },
    { label: 'petbank server database', cmd: 'node', args: ['--test', 'prj/petbank-server/test/database.test.mjs'] },
    { label: 'word memory prototype', cmd: 'node', args: ['prj/单词记忆射击场原型/verify.mjs'] },
    { label: 'learning arcade prototype', cmd: 'node', args: ['prj/学习机玩法原型/verify.mjs'] },
    { label: 'learning arcade browser smoke', cmd: 'node', args: ['prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs'] },
    { label: 'word shooter progression contract', cmd: 'node', args: ['prj/学习机玩法原型/scripts/test-word-shooter-progression.mjs'] },
    { label: 'word shooter stage mechanics', cmd: 'node', args: ['prj/学习机玩法原型/scripts/test-word-shooter-mechanics.mjs'] },
    { label: 'learning arcade published artifact', cmd: 'node', args: ['prj/学习机玩法原型/scripts/test-word-shooter-published-artifact.mjs'] },
    { label: 'typing defense prototype', cmd: 'node', args: ['prj/消灭苦力怕打字游戏/web/verify.mjs'] },
    { label: 'typing defense simulation', cmd: 'node', args: ['prj/消灭苦力怕打字游戏/web/simulate.mjs'] },
    { label: 'child journey feedback', cmd: 'node', args: ['scripts/test-child-journey-feedback.mjs'] },
    { label: 'child journey home', cmd: 'node', args: ['scripts/test-child-journey-home.mjs'] },
    { label: 'space growth detective runtime', cmd: 'node', args: ['scripts/test-space-growth-detective-runtime.mjs'] },
    { label: 'space growth detective map contract', cmd: 'node', args: ['scripts/test-space-growth-detective-map-contract.mjs'] },
    { label: 'space growth detective browser journey', cmd: 'node', args: ['scripts/test-space-growth-detective-browser.mjs'] },
    { label: 'pixel story contract', cmd: 'node', args: ['scripts/test-pixel-story-contract.mjs'] },
    { label: 'pixel worlds contract', cmd: 'node', args: ['scripts/test-pixel-worlds-contract.mjs'] },
    { label: 'pixel story browser journey', cmd: 'node', args: ['scripts/test-pixel-story-browser.mjs'] },
    { label: 'pixel worlds route browser journey', cmd: 'node', args: ['scripts/test-exploration-entry-browser.mjs'] },
    { label: 'pixel worlds all route browser journey', cmd: 'node', args: ['scripts/test-pixel-story-all-chapters-browser.mjs'] },
    { label: 'pixel story published artifact', cmd: 'node', args: ['scripts/test-pixel-story-published-artifact.mjs'] },
    { label: 'core reward feedback', cmd: 'node', args: ['scripts/test-core-reward-feedback.mjs'] },
    { label: 'core reward policy', cmd: 'node', args: ['scripts/test-core-reward-policy.mjs'] },
    { label: 'core reward presentation', cmd: 'node', args: ['scripts/test-core-reward-presentation.mjs'] },
    { label: 'daily state', cmd: 'node', args: ['scripts/test-daily-state.mjs'] },
    { label: 'date key contract', cmd: 'node', args: ['scripts/test-date-key-contract.mjs'] },
    { label: 'cloud sync outbox storage', cmd: 'node', args: ['scripts/test-cloud-sync-outbox.mjs'] },
    { label: 'cloud sync profile contract', cmd: 'node', args: ['scripts/test-cloud-sync-profile-contract.mjs'] },
    { label: 'cloud sync profile integration', cmd: 'node', args: ['scripts/test-cloud-sync-profile-integration.mjs'] },
    { label: 'high priority state sync', cmd: 'node', args: ['scripts/test-high-priority-sync.mjs'] },
    { label: 'cloud conflict UI contract', cmd: 'node', args: ['scripts/test-cloud-conflict-ui-contract.mjs'] },
    { label: 'page lifecycle contract', cmd: 'node', args: ['scripts/test-page-lifecycle-contract.mjs'] },
    { label: 'english vocab profile scope', cmd: 'node', args: ['scripts/test-english-vocab-profile-scope.mjs'] },
    { label: 'mayihaoke Minecraft vocabulary snapshot', cmd: 'node', args: ['scripts/test-mayihaoke-minecraft-words.mjs'] },
    { label: 'Minecraft vocab content completeness', cmd: 'node', args: ['scripts/test-minecraft-vocab-content.mjs'] },
    { label: 'Minecraft vocab session contract', cmd: 'node', args: ['scripts/test-minecraft-vocab-session.mjs'] },
    { label: 'Minecraft vocab browser journey', cmd: 'node', args: ['scripts/test-minecraft-vocab-browser.mjs'] },
    { label: 'game reward receipts', cmd: 'node', args: ['scripts/test-game-reward-receipts.mjs'] },
    { label: 'localStorage registry', cmd: 'node', args: ['scripts/test-localstorage-registry.mjs'] },
    { label: 'profile storage policy', cmd: 'node', args: ['scripts/test-profile-storage-policy.mjs'] },
    { label: 'narrative closure', cmd: 'node', args: ['scripts/test-narrative-closure.mjs'] },
    { label: 'Pages fast gate contract', cmd: 'node', args: ['scripts/test-pages-fast-gate-contract.mjs'] },
    { label: 'points entry contract', cmd: 'node', args: ['scripts/test-points-entry-contract.mjs'] },
    { label: 'shop transaction contract', cmd: 'node', args: ['scripts/test-shop-transaction-contract.mjs'] },
    { label: 'learning state contract', cmd: 'node', args: ['scripts/test-learning-state-contract.mjs'] },
    { label: 'pet adventure retention', cmd: 'node', args: ['scripts/test-pet-adventure-retention.mjs'] },
    { label: 'pet care daily state', cmd: 'node', args: ['scripts/test-pet-care-daily-state.mjs'] },
    { label: 'pet growth feedback', cmd: 'node', args: ['scripts/test-pet-growth-feedback.mjs'] },
    { label: 'pet growth history', cmd: 'node', args: ['scripts/test-pet-growth-history.mjs'] },
    { label: 'playground entry shell', cmd: 'node', args: ['scripts/test-playground-entry-shell.mjs'] },
    { label: 'repository boundaries', cmd: 'node', args: ['scripts/test-repository-boundaries.mjs'] },
    { label: 'short travel chapter browser', cmd: 'node', args: ['scripts/test-short-travel-chapter-browser.mjs'] },
    { label: 'static route entries', cmd: 'node', args: ['scripts/test-static-route-entries.mjs'] },
    { label: 'task reward events', cmd: 'node', args: ['scripts/test-task-reward-events.mjs'] },
    { label: 'travel memory assets', cmd: 'node', args: ['scripts/test-travel-memory-assets.mjs'] },
    { label: 'travel memory published artifact', cmd: 'node', args: ['scripts/test-travel-memory-published-artifact.mjs'] },
    { label: 'travel memory browser', cmd: 'node', args: ['scripts/test-travel-memory-browser.mjs'] },
    { label: 'travel memory real journey', cmd: 'node', args: ['scripts/test-travel-memory-real-journey.mjs'] }
];

function checkBaseUrl(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        const req = client.get(url, (res) => {
            res.resume();
            resolve(res.statusCode && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

function runTask(task) {
    console.log(`\n==> ${task.label}`);
    console.log(`${task.cmd} ${task.args.join(' ')}`);
    const result = spawnSync(task.cmd, task.args, {
        cwd: ROOT,
        stdio: 'inherit',
        shell: false,
        timeout: TASK_TIMEOUT_MS,
        killSignal: 'SIGTERM',
        env: {
            ...process.env,
            PETBANK_BASE_URL: BASE_URL
        }
    });
    return {
        label: task.label,
        code: result.status ?? 1,
        timedOut: result.error?.code === 'ETIMEDOUT'
    };
}

async function main() {
    console.log(`Regression root: ${path.resolve(ROOT)}`);
    console.log(`PETBANK_BASE_URL=${BASE_URL}`);

    const healthy = await checkBaseUrl(`${BASE_URL}/index.html`);
    if (!healthy) {
        console.error('\nBase URL is not reachable.');
        console.error(`Please start a local static server first, for example: python -m http.server 8765 --bind 127.0.0.1`);
        process.exit(1);
    }

    const failures = [];
    for (const task of TASKS) {
        const result = runTask(task);
        if (result.code !== 0) {
            failures.push({ ...result, reason: result.timedOut ? `timeout after ${TASK_TIMEOUT_MS}ms` : `exit ${result.code}` });
            break;
        }
    }

    if (failures.length) {
        console.error('\nRegression failed at:');
        failures.forEach((item) => console.error(`- ${item.label} (${item.reason})`));
        process.exit(1);
    }

    console.log(`\nAll ${TASKS.length} regression tasks passed.`);
}

await main();
