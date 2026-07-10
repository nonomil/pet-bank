import { spawnSync } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const ROOT = process.cwd();
const BASE_URL = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const TASKS = [
    { label: 'regression runner contract', cmd: 'node', args: ['prj/regression_runner_contract.test.mjs'] },
    { label: 'runtime loader route base contract', cmd: 'node', args: ['prj/runtime_loader_route_base_contract.test.mjs'] },
    { label: 'route-aware shell contract', cmd: 'node', args: ['prj/route_aware_shell_contract.test.mjs'] },
    { label: 'audio contract', cmd: 'node', args: ['prj/audio_battle_feedback_contract.test.mjs'] },
    { label: 'battle milestones contract', cmd: 'node', args: ['prj/battle_milestones_contract.test.mjs'] },
    { label: 'pk brawl shared design contract', cmd: 'node', args: ['prj/pk_brawl_shared_design_contract.test.mjs'] },
    { label: 'pk brawl shared experience contract', cmd: 'node', args: ['prj/pk_brawl_shared_experience_contract.test.mjs'] },
    { label: 'homepage focus layout contract', cmd: 'python', args: ['prj/test_homepage_focus_layout_contract.py'] },
    { label: 'family review contract', cmd: 'python', args: ['prj/test_family_review_contract.py'] },
    { label: 'activity feed contract', cmd: 'python', args: ['prj/test_activity_feed_contract.py'] },
    { label: 'friend home visit page contract', cmd: 'python', args: ['prj/test_friend_home_visit_page_contract.py'] },
    { label: 'friend house preview contract', cmd: 'python', args: ['prj/test_friend_house_preview_contract.py'] },
    { label: 'registration invite contract', cmd: 'python', args: ['prj/test_registration_invite_contract.py'] },
    { label: 'registration invite management contract', cmd: 'python', args: ['prj/test_registration_invite_management_contract.py'] },
    { label: 'friend graph contract', cmd: 'python', args: ['prj/test_friend_graph_contract.py'] },
    { label: 'house visit contract', cmd: 'python', args: ['prj/test_house_visit_contract.py'] },
    { label: 'profile sync contract', cmd: 'python', args: ['prj/test_profile_sync_contract.py'] },
    { label: 'multi-child sync contract', cmd: 'python', args: ['prj/test_multi_child_sync_contract.py'] },
    { label: 'children schema contract', cmd: 'python', args: ['prj/test_children_schema_contract.py'] },
    { label: 'child access controls contract', cmd: 'python', args: ['prj/test_child_access_controls_contract.py'] },
    { label: 'async pk results contract', cmd: 'python', args: ['prj/test_async_pk_results_contract.py'] },
    { label: 'child social profile contract', cmd: 'python', args: ['prj/test_child_social_profile_contract.py'] },
    { label: 'cloud config persistence contract', cmd: 'python', args: ['prj/test_cloud_config_persistence_contract.py'] },
    { label: 'cloud diagnostics contract', cmd: 'python', args: ['prj/test_cloud_diagnostics_contract.py'] },
    { label: 'cloud loader pages contract', cmd: 'python', args: ['prj/test_cloud_loader_pages_contract.py'] },
    { label: 'cloud sync contract', cmd: 'python', args: ['prj/test_cloud_sync_contract.py'] },
    { label: 'family social ops contract', cmd: 'python', args: ['prj/test_family_social_ops_contract.py'] },
    { label: 'family social scope contract', cmd: 'python', args: ['prj/test_family_social_scope_contract.py'] },
    { label: 'household contract', cmd: 'python', args: ['prj/test_household_contract.py'] },
    { label: 'household invite issue contract', cmd: 'python', args: ['prj/test_household_invite_issue_contract.py'] },
    { label: 'household peer social contract', cmd: 'python', args: ['prj/test_household_peer_social_contract.py'] },
    { label: 'social walk action contract', cmd: 'python', args: ['prj/test_social_walk_action_contract.py'] },
    { label: 'social walk invite flow contract', cmd: 'python', args: ['prj/test_social_walk_invite_flow_contract.py'] },
    { label: 'home background theme contract', cmd: 'python', args: ['prj/test_home_background_theme_contract.py'] },
    { label: 'walk scene adventure contract', cmd: 'python', args: ['prj/test_walk_scene_adventure_contract.py'] },
    { label: 'explore rescue card contract', cmd: 'python', args: ['prj/test_explore_rescue_card_contract.py'] },
    { label: 'home dashboard nav contract', cmd: 'python', args: ['prj/test_home_dashboard_nav_contract.py'] },
    { label: 'pet walk page contract', cmd: 'python', args: ['prj/test_pet_walk_page_contract.py'] },
    { label: 'points exchange cards contract', cmd: 'python', args: ['prj/test_points_exchange_cards_contract.py'] },
    { label: 'url routing and settings subpages contract', cmd: 'node', args: ['prj/url_routing_and_settings_subpages.test.mjs'] },
    { label: 'top nav hub menu contract', cmd: 'node', args: ['prj/top_nav_hub_menu.test.mjs'] },
    { label: 'parent settings sections contract', cmd: 'node', args: ['prj/parent_settings_sections_contract.test.mjs'] },
    { label: 'parent management hidden interfaces contract', cmd: 'node', args: ['prj/parent_management_hidden_interfaces.test.mjs'] },
    { label: 'mayihaoke resource snapshot contract', cmd: 'node', args: ['prj/mayihaoke_resource_snapshot_contract.test.mjs'] },
    { label: 'pet asset integrity', cmd: 'node', args: ['prj/pet_asset_integrity.test.mjs'] },
    { label: 'petbank ui alignment regression', cmd: 'node', args: ['prj/petbank_ui_alignment_regression.test.mjs'] },
    { label: 'math pk guided feedback contract', cmd: 'node', args: ['prj/math_pk_guided_feedback_contract.test.mjs'] },
    { label: 'math pk support cards contract', cmd: 'node', args: ['prj/math_pk_support_cards_contract.test.mjs'] },
    { label: 'playground hanzi hub contract', cmd: 'node', args: ['prj/playground_hanzi_hub.test.mjs'] },
    { label: 'vocab registry contract', cmd: 'node', args: ['prj/vocab_registry_contract.test.mjs'] },
    { label: 'minecraft vocab selector contract', cmd: 'node', args: ['prj/minecraft_vocab_selector_contract.test.mjs'] },
    { label: 'minecraft vocab views contract', cmd: 'node', args: ['prj/minecraft_vocab_views_contract.test.mjs'] },
    { label: 'minecraft core vocab expansion contract', cmd: 'node', args: ['prj/minecraft_core_vocab_expansion_contract.test.mjs'] },
    { label: 'learning center english quiz vocab contract', cmd: 'node', args: ['prj/learning_center_english_quiz_vocab_contract.test.mjs'] },
    { label: 'word memory external vocab merge contract', cmd: 'node', args: ['prj/word_memory_external_vocab_merge_contract.test.mjs'] },
    { label: 'word memory world pack selector', cmd: 'node', args: ['prj/word_memory_world_pack_selector.test.mjs'] },
    { label: 'core gameplay', cmd: 'node', args: ['prj/gameplay_core_flows_simulation.mjs'] },
    { label: 'full game loop', cmd: 'node', args: ['prj/full_game_loop_simulation.mjs'] },
    { label: 'extended whole-game progression', cmd: 'node', args: ['prj/extended_whole_game_progression_simulation.mjs'] },
    { label: 'profile isolation journey', cmd: 'node', args: ['prj/profile_isolation_journey_simulation.mjs'] },
    { label: 'whole-game completion audit', cmd: 'node', args: ['prj/whole_game_completion_audit.mjs'] },
    { label: 'cross-surface journey', cmd: 'node', args: ['prj/cross_surface_journey_simulation.mjs'] },
    { label: 'parent light modules', cmd: 'node', args: ['prj/parent_light_modules_simulation.mjs'] },
    { label: 'learning and card progression', cmd: 'node', args: ['prj/learning_and_card_progression_simulation.mjs'] },
    { label: 'hanzi and english playground', cmd: 'node', args: ['prj/hanzi_and_english_playground_simulation.mjs'] },
    { label: 'exploration battle guided feedback', cmd: 'node', args: ['prj/exploration_battle_guided_feedback.test.mjs'] },
    { label: 'pinyin star scout voice contract', cmd: 'node', args: ['prj/pinyin_star_scout_voice_contract.test.mjs'] },
    { label: 'word memory bomb throw', cmd: 'node', args: ['prj/word_memory_map_bomb_throw.test.mjs'] },
    { label: 'word memory movement fx', cmd: 'node', args: ['prj/word_memory_map_movement_fx.test.mjs'] },
    { label: 'word memory rewards ui', cmd: 'node', args: ['prj/word_memory_map_rewards_ui.test.mjs'] },
    { label: 'word memory voice contract', cmd: 'node', args: ['prj/word_memory_map_voice_contract.test.mjs'] },
    { label: 'word memory voice playback', cmd: 'node', args: ['prj/word_memory_map_voice_playback.test.mjs'] },
    { label: 'word memory walk cycle', cmd: 'node', args: ['prj/word_memory_map_walk_cycle.test.mjs'] },
    { label: 'word memory minecraft adapter contract', cmd: 'node', args: ['prj/word_memory_minecraft_adapter_contract.test.mjs'] },
    { label: 'shared prototype voice workflow', cmd: 'node', args: ['prj/shared_prototype_voice_workflow.test.mjs'] },
    { label: 'learning arcade hanzi voice reuse', cmd: 'node', args: ['prj/learning_arcade_hanzi_voice_reuse.test.mjs'] },
    { label: 'exploration story and state resume', cmd: 'node', args: ['prj/exploration_story_and_state_resume_simulation.mjs'] },
    { label: 'cloud family social pk', cmd: 'node', args: ['prj/cloud_family_social_pk_simulation.mjs'] },
    { label: 'social two-pet visual contract', cmd: 'node', args: ['prj/social_two_pet_visual_contract.test.mjs'] },
    { label: 'social walk profile-switch contract', cmd: 'node', args: ['prj/social_walk_profile_switch_info_contract.test.mjs'] },
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
