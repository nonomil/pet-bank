import { spawnSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const ROOT = process.cwd();
const BASE_URL = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const TASKS = [
    { label: 'regression runner contract', cmd: 'node', args: ['prj/regression_runner_contract.test.mjs'] },
    { label: 'runtime loader route base contract', cmd: 'node', args: ['prj/runtime_loader_route_base_contract.test.mjs'] },
    { label: 'audio contract', cmd: 'node', args: ['prj/audio_battle_feedback_contract.test.mjs'] },
    { label: 'math pk guided feedback contract', cmd: 'node', args: ['prj/math_pk_guided_feedback_contract.test.mjs'] },
    { label: 'core gameplay', cmd: 'node', args: ['prj/gameplay_core_flows_simulation.mjs'] },
    { label: 'full game loop', cmd: 'node', args: ['prj/full_game_loop_simulation.mjs'] },
    { label: 'learning and card progression', cmd: 'node', args: ['prj/learning_and_card_progression_simulation.mjs'] },
    { label: 'hanzi and english playground', cmd: 'node', args: ['prj/hanzi_and_english_playground_simulation.mjs'] },
    { label: 'exploration battle guided feedback', cmd: 'node', args: ['prj/exploration_battle_guided_feedback.test.mjs'] },
    { label: 'word memory bomb throw', cmd: 'node', args: ['prj/word_memory_map_bomb_throw.test.mjs'] },
    { label: 'word memory rewards ui', cmd: 'node', args: ['prj/word_memory_map_rewards_ui.test.mjs'] },
    { label: 'word memory voice playback', cmd: 'node', args: ['prj/word_memory_map_voice_playback.test.mjs'] },
    { label: 'shared prototype voice workflow', cmd: 'node', args: ['prj/shared_prototype_voice_workflow.test.mjs'] },
    { label: 'learning arcade hanzi voice reuse', cmd: 'node', args: ['prj/learning_arcade_hanzi_voice_reuse.test.mjs'] },
    { label: 'exploration story and state resume', cmd: 'node', args: ['prj/exploration_story_and_state_resume_simulation.mjs'] },
    { label: 'cloud family social pk', cmd: 'node', args: ['prj/cloud_family_social_pk_simulation.mjs'] },
    { label: 'walk standalone', cmd: 'node', args: ['prj/walk_page_standalone_simulation.mjs'] },
    { label: 'learning center deep pages', cmd: 'node', args: ['prj/learning_center_deep_pages_simulation.mjs'] },
    { label: 'pet archive standalone', cmd: 'node', args: ['prj/pet_archive_standalone_simulation.mjs'] },
    { label: 'shop inventory standalone', cmd: 'node', args: ['prj/shop_inventory_standalone_simulation.mjs'] },
    { label: 'local profiles standalone', cmd: 'node', args: ['prj/local_profiles_standalone_simulation.mjs'] },
    { label: 'settings parent management standalone', cmd: 'node', args: ['prj/settings_parent_management_standalone_simulation.mjs'] },
    { label: 'edge states standalone', cmd: 'node', args: ['prj/edge_states_standalone_simulation.mjs'] },
    { label: 'leaderboard standalone', cmd: 'node', args: ['prj/leaderboard_standalone_simulation.mjs'] },
    { label: 'cloud contract smoke', cmd: 'python', args: ['prj/test_cloud_contract_smoke.py'] },
    { label: 'async pk contract', cmd: 'python', args: ['prj/test_async_pk_contract.py'] },
    { label: 'cloud restore contract', cmd: 'python', args: ['prj/test_cloud_restore_contract.py'] }
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
        env: {
            ...process.env,
            PETBANK_BASE_URL: BASE_URL
        }
    });
    return {
        label: task.label,
        code: result.status ?? 1
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
            failures.push(result);
            break;
        }
    }

    if (failures.length) {
        console.error('\nRegression failed at:');
        failures.forEach((item) => console.error(`- ${item.label} (exit ${item.code})`));
        process.exit(1);
    }

    console.log(`\nAll ${TASKS.length} regression tasks passed.`);
}

await main();
