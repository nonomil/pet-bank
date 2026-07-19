import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const artifactArg = process.argv[2];
const options = parseOptions(process.argv.slice(3));

if (!artifactArg || options.help) {
    console.log('Usage: node scripts/audit-pages-artifact-size.mjs <artifact-dir> [--json] [--top=N] [--max-mib=N] [--manifest-dir=PATH] [--require-manifest-budgets] [--require-manifest-coverage]');
    process.exit(options.help ? 0 : 2);
}

const artifactRoot = path.resolve(artifactArg);
if (!fs.existsSync(artifactRoot) || !fs.statSync(artifactRoot).isDirectory()) {
    console.error(`[artifact-audit] artifact directory not found: ${artifactRoot}`);
    process.exit(2);
}

const files = collectFiles(artifactRoot);
const report = buildReport(artifactRoot, files, options);

if (options.json) {
    console.log(JSON.stringify(report, null, 2));
} else {
    printHumanReport(report);
}

if (report.budget.exceeded || report.manifestBudget.failed || report.manifestCoverage.failed) process.exitCode = 1;

function parseOptions(args) {
    const options = {
        json: false,
        top: 30,
        maxMiB: null,
        manifestDir: null,
        requireManifestBudgets: false,
        requireManifestCoverage: false,
        help: false
    };
    for (const arg of args) {
        if (arg === '--json') {
            options.json = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg.startsWith('--top=')) {
            options.top = parsePositiveInteger(arg.slice('--top='.length), '--top');
        } else if (arg.startsWith('--max-mib=')) {
            options.maxMiB = parseNonNegativeNumber(arg.slice('--max-mib='.length), '--max-mib');
        } else if (arg.startsWith('--manifest-dir=')) {
            const value = arg.slice('--manifest-dir='.length).trim();
            if (!value) throw new Error('--manifest-dir must not be empty');
            options.manifestDir = path.resolve(value);
        } else if (arg === '--require-manifest-budgets') {
            options.requireManifestBudgets = true;
        } else if (arg === '--require-manifest-coverage') {
            options.requireManifestCoverage = true;
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

function buildReport(root, files, options) {
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const manifests = collectManifestReports(files, options.manifestDir);
    const topLevel = summarizeTopLevel(files);
    const byExtension = summarizeExtensions(files);
    const largestFiles = files
        .slice()
        .sort(compareFiles)
        .slice(0, options.top)
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
        manifests,
        manifestBudget: summarizeManifestBudget(manifests, options.requireManifestBudgets),
        manifestCoverage: summarizeManifestCoverage(manifests, options.requireManifestCoverage),
        budget: {
            maxMiB: options.maxMiB,
            exceeded: options.maxMiB !== null && totalBytes / 1024 / 1024 > options.maxMiB
        }
    };
}

function collectManifestReports(files, configuredManifestDir) {
    const manifestDir = configuredManifestDir || path.join(process.cwd(), 'scripts', 'runtime-asset-manifests');
    if (!fs.existsSync(manifestDir)) return [];
    return fs.readdirSync(manifestDir)
        .filter((fileName) => fileName.endsWith('.json'))
        .sort()
        .map((fileName) => {
            const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, fileName), 'utf8'));
            const exactFiles = new Set((manifest.runtimeFiles || []).map((value) => toPublishedManifestPath(value, manifest)));
            const prefixes = [
                ...(manifest.runtimePrefixes || []),
                ...(manifest.audioSets || []).map((audioSet) => audioSet.runtimePrefix).filter(Boolean)
            ].map((value) => toPublishedManifestPath(value, manifest).replace(/\/$/, ''));
            const matched = files.filter((file) => exactFiles.has(file.path) || prefixes.some((prefix) =>
                file.path === prefix || file.path.startsWith(`${prefix}/`)
            ));
            const bytes = matched.reduce((sum, file) => sum + file.bytes, 0);
            const configuredBudget = manifest.budgetMiB
                ?? manifest.budgetsMiB?.fullRuntimePool
                ?? manifest.budgetsMiB?.runtimeShell
                ?? null;
            return {
                id: manifest.id || path.basename(fileName, '.json'),
                manifest: `scripts/runtime-asset-manifests/${fileName}`,
                files: matched.length,
                bytes,
                MiB: roundMiB(bytes),
                budgetMiB: configuredBudget,
                budgetExceeded: configuredBudget !== null && bytes / 1024 / 1024 > configuredBudget,
                covered: matched.length > 0
            };
        });
}

function summarizeManifestBudget(manifests, required) {
    const missing = manifests.filter((manifest) => manifest.budgetMiB === null).map((manifest) => manifest.id);
    const exceeded = manifests.filter((manifest) => manifest.budgetExceeded).map((manifest) => manifest.id);
    return {
        required,
        missing,
        exceeded,
        failed: required && (missing.length > 0 || exceeded.length > 0)
    };
}

function summarizeManifestCoverage(manifests, required) {
    const uncovered = manifests.filter((manifest) => !manifest.covered).map((manifest) => manifest.id);
    return {
        required,
        uncovered,
        failed: required && uncovered.length > 0
    };
}

function toPublishedManifestPath(value, manifest) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const packageRoot = String(manifest.publishRoot || manifest.packageRoot || '').replace(/\\/g, '/').replace(/\/$/, '');
    if (!packageRoot || normalized.startsWith(`${packageRoot}/`)) return normalized;
    return `${packageRoot}/${normalized}`;
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
    console.log('[artifact-audit] manifests:');
    for (const manifest of report.manifests) {
        const budget = manifest.budgetMiB === null ? '' : ` budget=${manifest.budgetExceeded ? 'FAIL' : 'PASS'} max=${manifest.budgetMiB} MiB`;
        console.log(`  ${manifest.id}: ${manifest.MiB} MiB (${manifest.files} files)${budget}`);
    }
    if (report.manifestBudget.required) {
        console.log(`[artifact-audit] manifest budgets=${report.manifestBudget.failed ? 'FAIL' : 'PASS'}`);
        if (report.manifestBudget.missing.length) console.log(`  missing budget: ${report.manifestBudget.missing.join(', ')}`);
        if (report.manifestBudget.exceeded.length) console.log(`  exceeded budget: ${report.manifestBudget.exceeded.join(', ')}`);
    }
    if (report.manifestCoverage.required) {
        console.log(`[artifact-audit] manifest coverage=${report.manifestCoverage.failed ? 'FAIL' : 'PASS'}`);
        if (report.manifestCoverage.uncovered.length) console.log(`  uncovered: ${report.manifestCoverage.uncovered.join(', ')}`);
    }
    if (report.budget.maxMiB !== null) {
        const status = report.budget.exceeded ? 'FAIL' : 'PASS';
        console.log(`[artifact-audit] budget=${status} max=${report.budget.maxMiB} MiB`);
    }
}
