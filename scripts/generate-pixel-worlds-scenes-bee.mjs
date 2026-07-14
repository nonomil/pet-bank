import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const promptRoot = path.join(root, 'tmp', 'pixel-worlds-prompts');
const runRoot = path.join(root, 'tmp', 'pixel-worlds-bee-scenes');
const logPath = path.join(root, 'tmp', 'pixel-worlds-bee-scenes.log');
const delayBetweenJobs = Number(process.env.PIXEL_SCENE_BEE_DELAY_MS || 5000);
const timeoutMs = Number(process.env.PIXEL_SCENE_BEE_TIMEOUT_MS || 420000);
const retries = Number(process.env.PIXEL_SCENE_BEE_RETRIES || 1);

const jobs = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])].flatMap((track) => (track.nodes || []).map((node) => ({
    id: node.levelId,
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

function append(line) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`, 'utf8');
    console.log(line);
}

function runProcess(command, args, options = {}) {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...options,
        });
        let output = '';
        child.stdout.on('data', (chunk) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk) => { output += chunk.toString(); });
        const timer = setTimeout(() => {
            child.kill();
            resolve({ code: null, output, timedOut: true });
        }, timeoutMs);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, output, timedOut: false });
        });
        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({ code: null, output: `${output}\n${error.message}`, timedOut: false });
        });
    });
}

async function generate(job) {
    const runDir = path.join(runRoot, job.id);
    const pngPath = path.join(runDir, `${job.id}.png`);
    fs.mkdirSync(runDir, { recursive: true });
    const args = [
        '-X', 'utf8',
        '.codex/skills/gpt-image-bee-workflow/scripts/bee_image_workflow.py',
        'generate',
        '--prompt-file', job.prompt,
        '--out', runDir,
        '--prefix', job.id,
        '--size', '1536x1024',
        '--retries', String(retries),
        '--timeout', String(Math.ceil(timeoutMs / 1000)),
    ];
    const generated = await runProcess('python', args);
    if (generated.timedOut || generated.code !== 0 || !isUsable(pngPath)) {
        const reason = generated.timedOut ? 'timeout' : `code=${generated.code}`;
        append(`FAIL ${job.id} ${reason} output=${generated.output.trim().slice(-600)}`);
        return false;
    }

    const conversion = await runProcess('python', [
        '-X', 'utf8', '-c',
        [
            'from pathlib import Path',
            'from PIL import Image',
            'import sys',
            'src = Path(sys.argv[1])',
            'dst = Path(sys.argv[2])',
            'image = Image.open(src)',
            'image.load()',
            'assert image.width >= 1200 and image.height >= 800, image.size',
            'image.convert("RGB").save(dst, "WEBP", quality=92, method=6)',
            'image.close()',
            'check = Image.open(dst)',
            'check.load()',
            'print(f"size={check.width}x{check.height} bytes={dst.stat().st_size}")',
            'check.close()',
        ].join('; '),
        pngPath,
        job.out,
    ]);
    if (conversion.code !== 0 || !isUsable(job.out)) {
        append(`FAIL ${job.id} conversion output=${conversion.output.trim().slice(-600)}`);
        return false;
    }
    append(`OK ${job.id} ${job.out} ${conversion.output.trim()}`);
    return true;
}

const pending = jobs.filter((job) => !isUsable(job.out));
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, `START pending=${pending.length} total=${jobs.length} model=gpt-image-2 size=1536x1024\n`, 'utf8');
append(`PENDING ${pending.map((job) => job.id).join(', ') || 'none'}`);

let succeeded = jobs.length - pending.length;
let failed = 0;
for (const [index, job] of pending.entries()) {
    append(`BEGIN ${job.id} ${index + 1}/${pending.length}`);
    if (await generate(job)) succeeded += 1;
    else failed += 1;
    if (index < pending.length - 1) await new Promise((resolve) => setTimeout(resolve, delayBetweenJobs));
}
append(`DONE success=${succeeded} failed=${failed} total=${jobs.length}`);
if (failed > 0) process.exitCode = 2;
