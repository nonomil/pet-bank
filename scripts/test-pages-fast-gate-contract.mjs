import fs from 'node:fs';
import path from 'node:path';

const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'deploy.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const requiredCommands = [
    'python scripts/convert-runtime-image-variants.py --check',
    'python scripts/convert-runtime-audio-variants.py --check',
    'node --check js/app.js',
    'node scripts/test-initial-media-loading-contract.mjs',
    'node scripts/test-pages-vocab-publish-contract.mjs',
    'node scripts/test-static-route-entries.mjs',
    'node scripts/test-static-access-policy-contract.mjs',
    'node prj/runtime_loader_route_base_contract.test.mjs',
    'node prj/route_aware_shell_contract.test.mjs',
    'node prj/profile_isolation_journey_simulation.mjs',
];
const contractCommand = 'node scripts/test-pages-fast-gate-contract.mjs';

function fail(message) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
}

const gateIndex = workflow.indexOf('      - name: Run Pages fast gate');
const assembleIndex = workflow.indexOf('      - name: Assemble static site artifact');
const nextStepIndex = gateIndex === -1 ? -1 : workflow.indexOf('\n      - ', gateIndex + 1);
const gateBlock = gateIndex === -1
    ? ''
    : workflow.slice(gateIndex, nextStepIndex === -1 ? workflow.length : nextStepIndex);

if (!/uses:\s*actions\/setup-node@v4[\s\S]*?node-version:\s*['\"]?20['\"]?/.test(workflow)) {
    fail('Pages deployment must configure Node.js 20 before the fast gate');
}
if (!workflow.includes('python -m pip install --disable-pip-version-check pillow soundfile')) {
    fail('Pages deployment must install Pillow and soundfile before asset validation');
}
if (gateIndex === -1) {
    fail('Pages deployment must name the fast gate step');
} else if (!/run:\s*\|/.test(gateBlock)) {
    fail('Pages fast gate must use a multi-command run block');
} else if (assembleIndex === -1 || gateIndex > assembleIndex) {
    fail('Pages fast gate must run before artifact assembly');
}

for (const command of requiredCommands) {
    if (!gateBlock.includes(command)) {
        fail(`Pages fast-gate run block must run: ${command}`);
    }
}
if (!gateBlock.includes(contractCommand)) {
    fail(`Pages fast-gate run block must run its workflow contract: ${contractCommand}`);
}
if (gateBlock.includes('scripts/run-full-regression.mjs')) {
    fail('Pages fast gate must not run the local-server full regression');
}

if (process.exitCode) {
    process.exit(process.exitCode);
}

console.log('PASS Pages fast gate workflow contract');
