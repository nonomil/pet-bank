import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json'), 'utf8'));
const promptRoot = path.join(root, 'tmp', 'pixel-worlds-prompts');
const logPath = path.join(root, 'tmp', 'pixel-worlds-scene-generation.log');
const concurrency = Number(process.env.PIXEL_SCENE_CONCURRENCY || 1);
const perJobTimeout = Number(process.env.PIXEL_SCENE_JOB_TIMEOUT_MS || 330000);
const delayBetweenJobs = Number(process.env.PIXEL_SCENE_DELAY_MS || 15000);

const jobs = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])].flatMap((track) => (track.nodes || []).map((node) => ({
    id: node.levelId,
    trackId: track.id,
    prompt: path.join(promptRoot, `${node.levelId}.txt`),
    out: path.join(root, node.background),
})));

function isUsable(file) {
    try {
        return fs.statSync(file).size > 20_000;
    } catch {
        return false;
    }
}

const pending = jobs.filter((job) => !isUsable(job.out));
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, `START pending=${pending.length} concurrency=${concurrency}\n`, 'utf8');

function append(line) {
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`, 'utf8');
    console.log(line);
}

function run(job) {
    return new Promise((resolve) => {
        fs.mkdirSync(path.dirname(job.out), { recursive: true });
        const child = spawn('python', ['-X', 'utf8', 'scripts/token24-image-generate.py', '--prompt-file', job.prompt, '--out', job.out, '--size', '1536x1024', '--quality', 'medium'], {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        child.stdout.on('data', (chunk) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk) => { output += chunk.toString(); });
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            append(`TIMEOUT ${job.id} timeoutMs=${perJobTimeout}`);
            resolve(false);
        }, perJobTimeout);
        child.on('close', (code) => {
            clearTimeout(timer);
            const rateLimited = /429|Too Many Requests/i.test(output);
            if (code === 0 && isUsable(job.out)) append(`OK ${job.id} ${job.out}`);
            else append(`${rateLimited ? 'RATE_LIMIT' : 'FAIL'} ${job.id} code=${code} output=${output.trim().slice(-800)}`);
            resolve({ ok: code === 0 && isUsable(job.out), rateLimited });
        });
        child.on('error', (error) => {
            append(`FAIL ${job.id} spawn=${error.message}`);
            resolve({ ok: false, rateLimited: false });
        });
    });
}

let cursor = 0;
let succeeded = jobs.length - pending.length;
let failed = 0;
async function worker() {
    while (cursor < pending.length) {
        const job = pending[cursor++];
        const result = await run(job);
        if (result.ok) succeeded += 1;
        else failed += 1;
        if (result.rateLimited) {
            append(`PAUSED rate-limit remaining=${pending.length - cursor}`);
            break;
        }
        if (cursor < pending.length) await new Promise((resolve) => setTimeout(resolve, delayBetweenJobs));
    }
}
await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
append(`DONE success=${succeeded} failed=${failed} total=${jobs.length}`);
if (failed > 0) process.exitCode = 2;
