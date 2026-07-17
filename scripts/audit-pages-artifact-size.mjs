import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const artifactArg = process.argv[2];
const options = parseOptions(process.argv.slice(3));

if (!artifactArg || options.help) {
    console.log('Usage: node scripts/audit-pages-artifact-size.mjs <artifact-dir> [--json] [--top=N] [--max-mib=N]');
    process.exit(options.help ? 0 : 2);
}

const artifactRoot = path.resolve(artifactArg);
if (!fs.existsSync(artifactRoot) || !fs.statSync(artifactRoot).isDirectory()) {
    console.error(`[artifact-audit] artifact directory not found: ${artifactRoot}`);
    process.exit(2);
}

const files = collectFiles(artifactRoot);
const report = buildReport(artifactRoot, files, options.top, options.maxMiB);

if (options.json) {
    console.log(JSON.stringify(report, null, 2));
} else {
    printHumanReport(report);
}

if (report.budget.exceeded) process.exitCode = 1;

function parseOptions(args) {
    const options = { json: false, top: 30, maxMiB: null, help: false };
    for (const arg of args) {
        if (arg === '--json') {
            options.json = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg.startsWith('--top=')) {
            options.top = parsePositiveInteger(arg.slice('--top='.length), '--top');
        } else if (arg.startsWith('--max-mib=')) {
            options.maxMiB = parseNonNegativeNumber(arg.slice('--max-mib='.length), '--max-mib');
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    return options;
}

function parsePositiveInteger(value, name) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
    return parsed;
}

function parseNonNegativeNumber(value, name) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number`);
    return parsed;
}

function collectFiles(root) {
    const result = [];
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                pending.push(fullPath);
            } else if (entry.isFile()) {
                const relativePath = toPosix(path.relative(root, fullPath));
                result.push({
                    fullPath,
                    path: relativePath,
                    bytes: fs.statSync(fullPath).size,
                    extension: path.extname(entry.name).toLowerCase() || '<none>'
                });
            }
        }
    }
    return result;
}

function buildReport(root, files, top, maxMiB) {
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const topLevel = summarizeTopLevel(files);
    const byExtension = summarizeExtensions(files);
    const largestFiles = files
        .slice()
        .sort(compareFiles)
        .slice(0, top)
        .map(({ path: filePath, bytes, extension }) => ({
            path: filePath,
            bytes,
            MiB: roundMiB(bytes),
            extension
        }));

    return {
        root,
        files: files.length,
        totalBytes,
        totalMiB: roundMiB(totalBytes),
        topLevel,
        byExtension,
        largestFiles,
        duplicateGroups: findDuplicateGroups(files),
        budget: {
            maxMiB,
            exceeded: maxMiB !== null && totalBytes / 1024 / 1024 > maxMiB
        }
    };
}

function summarizeTopLevel(files) {
    const groups = new Map();
    for (const file of files) {
        const [topLevel] = file.path.split('/');
        const key = file.path.includes('/') ? topLevel : '.';
        const current = groups.get(key) || { path: key, files: 0, bytes: 0 };
        current.files += 1;
        current.bytes += file.bytes;
        groups.set(key, current);
    }
    return [...groups.values()].sort(compareSummaries).map(withMiB);
}

function summarizeExtensions(files) {
    const groups = new Map();
    for (const file of files) {
        const current = groups.get(file.extension) || { extension: file.extension, files: 0, bytes: 0 };
        current.files += 1;
        current.bytes += file.bytes;
        groups.set(file.extension, current);
    }
    return [...groups.values()].sort(compareSummaries).map(withMiB);
}

function findDuplicateGroups(files) {
    const bySize = new Map();
    for (const file of files) {
        const group = bySize.get(file.bytes) || [];
        group.push(file);
        bySize.set(file.bytes, group);
    }

    const byHash = new Map();
    for (const candidates of bySize.values()) {
        if (candidates.length < 2) continue;
        for (const file of candidates) {
            const hash = createHash('sha256').update(fs.readFileSync(file.fullPath)).digest('hex');
            const key = `${file.bytes}:${hash}`;
            const group = byHash.get(key) || { bytes: file.bytes, hash, paths: [] };
            group.paths.push(file.path);
            byHash.set(key, group);
        }
    }

    return [...byHash.values()]
        .filter((group) => group.paths.length > 1)
        .sort((a, b) => b.bytes - a.bytes || a.hash.localeCompare(b.hash))
        .map((group) => ({ ...group, MiB: roundMiB(group.bytes), paths: group.paths.sort() }));
}

function withMiB(summary) {
    return { ...summary, MiB: roundMiB(summary.bytes) };
}

function compareSummaries(a, b) {
    return b.bytes - a.bytes || a.path?.localeCompare(b.path) || a.extension?.localeCompare(b.extension);
}

function compareFiles(a, b) {
    return b.bytes - a.bytes || a.path.localeCompare(b.path);
}

function roundMiB(bytes) {
    return Number((bytes / 1024 / 1024).toFixed(2));
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function printHumanReport(report) {
    console.log(`[artifact-audit] root=${report.root}`);
    console.log(`[artifact-audit] files=${report.files} total=${report.totalMiB} MiB`);
    console.log('[artifact-audit] top-level:');
    for (const item of report.topLevel) console.log(`  ${item.path}: ${item.MiB} MiB (${item.files} files)`);
    console.log('[artifact-audit] largest files:');
    for (const item of report.largestFiles) console.log(`  ${item.MiB} MiB ${item.path}`);
    console.log(`[artifact-audit] duplicate groups=${report.duplicateGroups.length}`);
    for (const group of report.duplicateGroups) console.log(`  ${group.MiB} MiB ${group.paths.join(' = ')}`);
    if (report.budget.maxMiB !== null) {
        const status = report.budget.exceeded ? 'FAIL' : 'PASS';
        console.log(`[artifact-audit] budget=${status} max=${report.budget.maxMiB} MiB`);
    }
}
