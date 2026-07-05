import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HELP_TEXT = `
family-social-ops

用于家庭账号社交体系的本地联调 / 运维辅助脚本。
默认读取项目根目录 .env，也可通过命令行覆盖。

环境变量：
  SUPABASE_URL 或 APP_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

用法：
  node scripts/family-social-ops.mjs registration:list [--status pending] [--limit 20] [--json]
  node scripts/family-social-ops.mjs registration:issue [--count 3] [--prefix PARENT-BETA] [--label 双家长联调-A] [--days 30] [--metadata '{"batch":"pilot-1"}'] [--codes CODE1,CODE2]
  node scripts/family-social-ops.mjs registration:revoke --code PARENT-BETA-001
  node scripts/family-social-ops.mjs registration:seed-sql [--count 3] [--prefix PARENT-BETA] [--days 30] [--batch pilot-1] [--output <path>] [--force]

  node scripts/family-social-ops.mjs household-invites:list [--household <uuid>] [--status pending] [--limit 20] [--json]
  node scripts/family-social-ops.mjs household-invites:revoke --code HOUSE-INVITE-001

  node scripts/family-social-ops.mjs household:inspect --household <uuid> [--activity-limit 10] [--invite-limit 10] [--json]
  node scripts/family-social-ops.mjs child:inspect --child <uuid> [--activity-limit 10] [--json]
  node scripts/family-social-ops.mjs pk:inspect --match <uuid> [--activity-limit 10] [--json]
  node scripts/family-social-ops.mjs pair:inspect --child-a <uuid> --child-b <uuid> [--visit-limit 10] [--pk-limit 10] [--activity-limit 10] [--json]
  node scripts/family-social-ops.mjs diagnostics:compare --left-json <path> --right-json <path> [--json]
  node scripts/family-social-ops.mjs pilot:overview [--recent-days 7] [--json]
  node scripts/family-social-ops.mjs pilot:doctor [--date 2026-07-05] [--env-file ./.env] [--json]
  node scripts/family-social-ops.mjs pilot:report [--recent-days 7] [--date 2026-07-05] [--output <path>] [--json-input <path>] [--force]
  node scripts/family-social-ops.mjs pilot:bundle [--recent-days 7] [--date 2026-07-05] [--output-dir <path>] [--json-input <path>] [--force]
  node scripts/family-social-ops.mjs logs:report --json-input <path> [--date 2026-07-05] [--output <path>] [--force]
  node scripts/family-social-ops.mjs deploy:bundle [--date 2026-07-05] [--project-ref abcdef] [--url https://<project>.supabase.co] [--anon-key <key>] [--service-role-key <key>] [--site-url http://127.0.0.1:5500] [--output-dir <path>] [--force]
  node scripts/family-social-ops.mjs config:install-local [--url https://<project>.supabase.co] [--anon-key <key>] [--site-url http://127.0.0.1:5500] [--output cloud-config.local.js] [--force]
  node scripts/family-social-ops.mjs config:inspect [--env-file ./.env] [--cloud-config-file cloud-config.local.js] [--json]
  node scripts/family-social-ops.mjs template:manual-run [--date 2026-07-05] [--output <path>] [--force]
  node scripts/family-social-ops.mjs template:deploy-log [--date 2026-07-05] [--output <path>] [--force]
  node scripts/family-social-ops.mjs template:go-no-go [--date 2026-07-05] [--output <path>] [--force]
  node scripts/family-social-ops.mjs template:all [--date 2026-07-05] [--force]

可选覆盖：
  --url https://<project>.supabase.co
  --service-role-key <service-role-key>
  --env-file ./.env
  --dry-run
`;

function parseArgs(args) {
    const parsed = { _: [] };

    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!token.startsWith('--')) {
            parsed._.push(token);
            continue;
        }

        const key = token.slice(2);
        const nextToken = args[index + 1];
        if (!nextToken || nextToken.startsWith('--')) {
            parsed[key] = true;
            continue;
        }

        parsed[key] = nextToken;
        index += 1;
    }

    return parsed;
}

function getRepoRoot() {
    return process.cwd();
}

function getScriptDir() {
    return path.dirname(fileURLToPath(import.meta.url));
}

function toPosixPath(filePath) {
    return String(filePath).replace(/\\/g, '/');
}

const EXPECTED_MIGRATIONS = [
    '20260705_001_base_extensions.sql',
    '20260705_002_households.sql',
    '20260705_003_children_and_pet_state.sql',
    '20260705_004_friend_graph.sql',
    '20260705_005_house_visits.sql',
    '20260705_006_async_pk.sql',
    '20260705_007_child_live_state.sql',
    '20260705_008_registration_invites.sql',
    '20260705_009_child_social_profiles.sql',
    '20260705_010_activity_feed.sql',
    '20260705_011_child_access_controls.sql',
];

const EXPECTED_FUNCTIONS = [
    'accept-household-invite',
    'claim-registration-invite',
    'issue-household-invite',
    'issue-pk-match',
    'issue-registration-invite',
    'list-registration-invites',
    'redeem-friend-code',
    'revoke-household-invite',
    'revoke-registration-invite',
    'submit-pk-attempt',
    'validate-registration-invite',
];

const EXPECTED_TEMPLATES = [
    'manual-run-template.md',
    'deploy-log-template.md',
    'go-no-go-template.md',
];
const PLACEHOLDER_SUPABASE_URL = 'https://<project>.supabase.co';
const PLACEHOLDER_SUPABASE_ANON_KEY = '<anon-key>';
const PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY = '<service-role-key>';

function parseEnvFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return {};
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const result = {};

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        result[key] = value;
    }

    return result;
}

function asInt(value, fallbackValue) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function safeJsonParse(text, fallbackValue = null) {
    try {
        return JSON.parse(text);
    } catch (error) {
        return fallbackValue;
    }
}

function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function writeTextFile(filePath, content, force) {
    const outputPath = path.resolve(getRepoRoot(), filePath);
    ensureDirectory(path.dirname(outputPath));
    if (fs.existsSync(outputPath) && !force) {
        throw new Error(`目标文件已存在：${toPosixPath(outputPath)}。如需覆盖，请追加 --force`);
    }
    fs.writeFileSync(outputPath, content, 'utf8');
    return outputPath;
}

function writeJsonFile(filePath, payload, force) {
    return writeTextFile(filePath, JSON.stringify(payload, null, 2), force);
}

function todayDateString() {
    return new Date().toISOString().slice(0, 10);
}

function resolveDateString(options) {
    const date = String(options.date || todayDateString()).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('--date 必须是 YYYY-MM-DD 格式，例如 2026-07-05');
    }
    return date;
}

function renderTemplate(template, replacements) {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
        return Object.prototype.hasOwnProperty.call(replacements, key)
            ? String(replacements[key])
            : '';
    });
}

function readDocTemplate(templateFileName) {
    const filePath = path.resolve(getScriptDir(), '..', 'docs', '家庭账号社交体系', '联调上线', templateFileName);
    return fs.readFileSync(filePath, 'utf8');
}

function printCreatedFile(title, outputPath) {
    console.log(`${title}: ${toPosixPath(outputPath)}`);
}

function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || '').trim().replace(/\/+$/, '');
}

function resolveConfig(options) {
    const envFile = path.resolve(process.cwd(), String(options['env-file'] || '.env'));
    const envFromFile = parseEnvFile(envFile);
    const mergedEnv = { ...envFromFile, ...process.env };

    const supabaseUrl = normalizeBaseUrl(options.url || mergedEnv.SUPABASE_URL || mergedEnv.APP_SUPABASE_URL);
    const serviceRoleKey = String(options['service-role-key'] || mergedEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl) {
        throw new Error('缺少 Supabase URL。请在 .env 中设置 SUPABASE_URL 或 APP_SUPABASE_URL，或通过 --url 传入。');
    }
    if (!serviceRoleKey) {
        throw new Error('缺少 SUPABASE_SERVICE_ROLE_KEY。这个脚本需要 service role key 才能做联调运维查询。');
    }

    return {
        supabaseUrl,
        serviceRoleKey,
        dryRun: Boolean(options['dry-run']),
    };
}

function requireOption(options, key, label) {
    const value = options[key];
    if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`缺少必填参数 ${label || `--${key}`}`);
    }
    return String(value).trim();
}

function parseMetadata(text) {
    if (!text) {
        return {};
    }
    const parsed = safeJsonParse(text, null);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('--metadata 必须是 JSON object，例如 {"batch":"pilot-1"}');
    }
    return parsed;
}

function sqlString(value) {
    return String(value ?? '').replace(/'/g, "''");
}

function sqlJson(value) {
    return JSON.stringify(value ?? {}).replace(/'/g, "''");
}

function sanitizePrefix(prefix) {
    return String(prefix || 'PARENT-BETA')
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'PARENT-BETA';
}

function generateInviteCodes(prefix, count) {
    const safePrefix = sanitizePrefix(prefix);
    const seed = Date.now().toString(36).toUpperCase();
    return Array.from({ length: count }, (_, index) => (
        `${safePrefix}-${seed}-${String(index + 1).padStart(2, '0')}`
    ));
}

function parseExplicitCodes(options, defaultPrefix, defaultCount) {
    if (options.codes) {
        const codes = String(options.codes)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        if (!codes.length) {
            throw new Error('--codes 不能为空');
        }
        return codes;
    }

    if (options.code) {
        return [String(options.code).trim()];
    }

    const count = Math.max(1, asInt(options.count, defaultCount));
    return generateInviteCodes(defaultPrefix, count);
}

function buildHeaders(config, extraHeaders = {}) {
    return {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        ...extraHeaders,
    };
}

async function requestJson(config, method, resource, { searchParams, body, headers } = {}) {
    const url = new URL(`${config.supabaseUrl}/rest/v1/${resource}`);
    if (searchParams) {
        for (const [key, value] of Object.entries(searchParams)) {
            if (value === undefined || value === null || value === '') {
                continue;
            }
            url.searchParams.set(key, String(value));
        }
    }

    const requestHeaders = buildHeaders(config, {
        Accept: 'application/json',
        ...headers,
    });
    const init = {
        method,
        headers: requestHeaders,
    };

    if (body !== undefined) {
        requestHeaders['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const parsedBody = contentType.includes('application/json')
        ? safeJsonParse(responseText, responseText)
        : responseText;

    if (!response.ok) {
        const detail = typeof parsedBody === 'string'
            ? parsedBody
            : JSON.stringify(parsedBody, null, 2);
        throw new Error(`${method} ${url.pathname} 失败 (${response.status})\n${detail}`);
    }

    return {
        data: parsedBody === '' ? null : parsedBody,
        headers: response.headers,
        url: url.toString(),
    };
}

function parseCountFromHeaders(headers) {
    const contentRange = headers.get('content-range') || headers.get('Content-Range') || '';
    const match = /\/(\d+)$/.exec(contentRange);
    return match ? Number.parseInt(match[1], 10) : 0;
}

async function requestCount(config, resource, { searchParams, selectField } = {}) {
    const countSearchParams = {
        ...(searchParams || {}),
        select: selectField || 'id',
        limit: 1,
    };
    const { headers } = await requestJson(config, 'GET', resource, {
        searchParams: countSearchParams,
        headers: { Prefer: 'count=exact' },
    });
    return parseCountFromHeaders(headers);
}

function formatDate(value) {
    if (!value) {
        return '-';
    }
    return String(value).replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function printJson(payload) {
    console.log(JSON.stringify(payload, null, 2));
}

function printTable(columns, rows) {
    if (!rows.length) {
        console.log('(空)');
        return;
    }

    const widths = columns.map((column) => column.label.length);
    const normalizedRows = rows.map((row) => columns.map((column) => String(row[column.key] ?? '-')));

    normalizedRows.forEach((cells) => {
        cells.forEach((cell, index) => {
            widths[index] = Math.max(widths[index], cell.length);
        });
    });

    const header = columns
        .map((column, index) => column.label.padEnd(widths[index], ' '))
        .join('  ');
    const divider = widths.map((width) => '-'.repeat(width)).join('  ');

    console.log(header);
    console.log(divider);
    normalizedRows.forEach((cells) => {
        console.log(cells.map((cell, index) => cell.padEnd(widths[index], ' ')).join('  '));
    });
}

function printSection(title) {
    console.log(`\n[${title}]`);
}

function formatBoolean(value, yes = 'YES', no = 'NO') {
    return value ? yes : no;
}

function formatSecretStatus(hasValue, length) {
    return hasValue ? `已配置（长度 ${length}）` : '未配置';
}

function defaultCloudConfigReport() {
    return {
        exists: false,
        path: '',
        valid: false,
        sourceKey: '',
        sourceLabel: '',
        supabaseUrl: '',
        anonKey: '',
        hasAnonKey: false,
        anonKeyLength: 0,
        siteUrl: '',
        hasPlaceholderSupabaseUrl: false,
        hasPlaceholderAnonKey: false,
        hasPlaceholderValues: false,
        error: '',
    };
}

function inspectCloudConfigFile(filePath) {
    const resolvedPath = path.resolve(getRepoRoot(), String(filePath || 'cloud-config.local.js').trim());
    const report = {
        ...defaultCloudConfigReport(),
        exists: fs.existsSync(resolvedPath),
        path: resolvedPath,
    };

    if (!report.exists) {
        return report;
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const sandboxWindow = {};
    sandboxWindow.window = sandboxWindow;

    try {
        const context = vm.createContext({ window: sandboxWindow });
        vm.runInContext(content, context, {
            filename: resolvedPath,
            timeout: 1000,
        });

        const runtimeConfig = sandboxWindow.__PETBANK_CLOUD_CONFIG__;
        report.sourceKey = String(sandboxWindow.__PETBANK_CLOUD_CONFIG_SOURCE__ || '').trim();
        report.sourceLabel = String(sandboxWindow.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ || '').trim();

        if (!runtimeConfig || typeof runtimeConfig !== 'object') {
            report.error = `${toPosixPath(resolvedPath)} 缺少 window.__PETBANK_CLOUD_CONFIG__`;
            return report;
        }

        report.valid = true;
        report.supabaseUrl = normalizeBaseUrl(runtimeConfig.supabaseUrl || runtimeConfig.url);
        report.anonKey = String(runtimeConfig.supabaseAnonKey || runtimeConfig.anonKey || '').trim();
        report.hasAnonKey = Boolean(report.anonKey);
        report.anonKeyLength = report.anonKey.length;
        report.siteUrl = String(runtimeConfig.siteUrl || '').trim();
        report.hasPlaceholderSupabaseUrl = (
            report.supabaseUrl === PLACEHOLDER_SUPABASE_URL
            || report.supabaseUrl.includes('<project>.supabase.co')
        );
        report.hasPlaceholderAnonKey = (
            report.anonKey === PLACEHOLDER_SUPABASE_ANON_KEY
            || report.anonKey.includes('<anon-key>')
        );
        report.hasPlaceholderValues = report.hasPlaceholderSupabaseUrl || report.hasPlaceholderAnonKey;
        return report;
    } catch (error) {
        report.error = `解析失败：${error.message || error}`;
        return report;
    }
}

function pickEffectiveStaticDefault(env, cloudConfigReport) {
    if (cloudConfigReport && cloudConfigReport.exists && cloudConfigReport.valid) {
        return {
            sourceKey: cloudConfigReport.sourceKey || path.basename(cloudConfigReport.path),
            sourceLabel: cloudConfigReport.sourceLabel || `静态脚本 ${path.basename(cloudConfigReport.path)}`,
            supabaseUrl: cloudConfigReport.supabaseUrl,
            hasAnonKey: cloudConfigReport.hasAnonKey,
            siteUrl: cloudConfigReport.siteUrl,
        };
    }

    if (env && (env.supabaseUrl || env.anonKey || env.siteUrl)) {
        return {
            sourceKey: 'env-preview',
            sourceLabel: '.env / 命令行预览（尚未写入静态站点）',
            supabaseUrl: env.supabaseUrl,
            hasAnonKey: Boolean(env.anonKey),
            siteUrl: env.siteUrl,
        };
    }

    return {
        sourceKey: 'none',
        sourceLabel: '未配置',
        supabaseUrl: '',
        hasAnonKey: false,
        siteUrl: '',
    };
}

function formatDaysLeft(value) {
    if (!value) return '-';
    const now = Date.now();
    const target = new Date(value).getTime();
    if (!Number.isFinite(target)) return '-';
    const diff = target - now;
    return `${Math.ceil(diff / (24 * 60 * 60 * 1000))} 天`;
}

function isExpiringSoon(value, days) {
    if (!value) return false;
    const target = new Date(value).getTime();
    if (!Number.isFinite(target)) return false;
    const diff = target - Date.now();
    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function printListOrEmpty(title, columns, rows, emptyText) {
    printSection(title);
    if (!rows.length) {
        console.log(emptyText || '(空)');
        return;
    }
    printTable(columns, rows);
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function readJsonInputFile(inputPath) {
    const resolvedPath = path.resolve(getRepoRoot(), String(inputPath || '').trim());
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`找不到 JSON 输入文件：${toPosixPath(resolvedPath)}`);
    }
    const parsed = safeJsonParse(fs.readFileSync(resolvedPath, 'utf8'), null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON 输入文件格式无效：${toPosixPath(resolvedPath)}`);
    }
    return {
        filePath: resolvedPath,
        data: parsed,
    };
}

function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function formatDurationCompact(durationMs) {
    const totalMs = Number(durationMs || 0);
    if (!Number.isFinite(totalMs) || totalMs <= 0) {
        return '-';
    }
    const totalSeconds = Math.round(totalMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
        return `${minutes}分${String(seconds).padStart(2, '0')}秒`;
    }
    return `${totalSeconds}秒`;
}

const PK_DIFFICULTY_LABELS = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
};

const HANZI_MODE_LABELS = {
    'choose-char-by-pinyin': '看拼音选字',
    'fill-blank': '例句填空',
};

function getPkGameLabel(gameType) {
    return gameType === 'hanzi' ? '汉字 PK' : '数学 PK';
}

function getHanziLevelLabel(level) {
    if (!level) return '启蒙';
    if (String(level).toLowerCase() === 'hsk1') return 'HSK 1';
    return String(level);
}

function getPkQuestionCount(payload) {
    const safePayload = ensureObject(payload);
    const questions = ensureArray(safePayload.questions);
    if (questions.length) {
        return questions.length;
    }
    const totalRounds = Number(safePayload.totalRounds || safePayload.total_rounds || 0);
    return Number.isFinite(totalRounds) && totalRounds > 0 ? totalRounds : 0;
}

function buildPkQuestionSetSummary(match, questionSet) {
    const safeMatch = ensureObject(match);
    const safeQuestionSet = ensureObject(questionSet);
    const payload = ensureObject(safeQuestionSet.payload_json || safeQuestionSet.payloadJson);
    const gameType = String(safeQuestionSet.game_type || safeQuestionSet.gameType || safeMatch.game_type || safeMatch.gameType || 'mathpk').trim() || 'mathpk';
    const questionCount = getPkQuestionCount(payload);
    const base = {
        id: safeQuestionSet.id || safeMatch.question_set_id || safeMatch.questionSetId || '',
        gameType,
        createdAt: safeQuestionSet.created_at || safeQuestionSet.createdAt || '',
        difficulty: String(safeQuestionSet.difficulty || safeMatch.difficulty || payload.difficulty || '').trim(),
        questionCount,
        totalRounds: Number(payload.totalRounds || payload.total_rounds || questionCount || 0) || questionCount,
        summaryText: `${getPkGameLabel(gameType)} · ${questionCount} 题同题挑战`,
        modeLabel: '',
        level: String(payload.level || '').trim(),
        levelLabel: '',
        preview: ensureArray(payload.questions).slice(0, 5).map((item) => {
            const safeItem = ensureObject(item);
            return safeItem.char || safeItem.prompt || safeItem.answer || safeItem.expr || safeItem.question || '';
        }).filter(Boolean),
        payloadJson: payload,
    };

    if (gameType === 'hanzi') {
        const uniqueModes = [...new Set(ensureArray(payload.questions).map((item) => {
            const safeItem = ensureObject(item);
            return String(safeItem.mode || '').trim();
        }).filter(Boolean))];
        let modeLabel = '识字练习';
        if (uniqueModes.length === 1) {
            modeLabel = HANZI_MODE_LABELS[uniqueModes[0]] || uniqueModes[0];
        } else if (uniqueModes.length > 1) {
            modeLabel = uniqueModes.map((mode) => HANZI_MODE_LABELS[mode] || mode).join(' / ');
        }
        const levelLabel = getHanziLevelLabel(payload.level);
        return {
            ...base,
            modeLabel,
            level: String(payload.level || '').trim(),
            levelLabel,
            summaryText: `${levelLabel} · ${modeLabel} · ${questionCount} 题同题挑战`,
        };
    }

    const difficulty = base.difficulty || 'easy';
    const difficultyLabel = PK_DIFFICULTY_LABELS[difficulty] || difficulty || '简单';
    return {
        ...base,
        difficulty,
        difficultyLabel,
        modeLabel: difficultyLabel,
        summaryText: `${difficultyLabel} · ${questionCount} 题同题挑战`,
    };
}

function normalizePkAttempt(attemptRow) {
    const safeAttempt = ensureObject(attemptRow);
    if (!Object.keys(safeAttempt).length) {
        return null;
    }
    return {
        id: safeAttempt.id || '',
        matchId: safeAttempt.match_id || safeAttempt.matchId || '',
        childId: safeAttempt.child_id || safeAttempt.childId || '',
        score: Number(safeAttempt.score || 0),
        correctCount: Number(safeAttempt.correct_count || safeAttempt.correctCount || 0),
        durationMs: Number(safeAttempt.duration_ms || safeAttempt.durationMs || 0),
        payloadJson: ensureObject(safeAttempt.payload_json || safeAttempt.payloadJson),
        completedAt: safeAttempt.completed_at || safeAttempt.completedAt || '',
    };
}

function decidePkWinner(challengerAttempt, opponentAttempt, challengerChildId, opponentChildId) {
    const challenger = normalizePkAttempt(challengerAttempt);
    const opponent = normalizePkAttempt(opponentAttempt);
    if (!challenger || !opponent) {
        return {
            winnerChildId: '',
            winnerReason: 'pending',
            isDraw: false,
        };
    }

    if (challenger.score > opponent.score) {
        return { winnerChildId: challengerChildId, winnerReason: 'score', isDraw: false };
    }
    if (challenger.score < opponent.score) {
        return { winnerChildId: opponentChildId, winnerReason: 'score', isDraw: false };
    }

    const challengerDuration = Number.isFinite(challenger.durationMs) ? challenger.durationMs : Number.MAX_SAFE_INTEGER;
    const opponentDuration = Number.isFinite(opponent.durationMs) ? opponent.durationMs : Number.MAX_SAFE_INTEGER;
    if (challengerDuration < opponentDuration) {
        return { winnerChildId: challengerChildId, winnerReason: 'duration', isDraw: false };
    }
    if (challengerDuration > opponentDuration) {
        return { winnerChildId: opponentChildId, winnerReason: 'duration', isDraw: false };
    }

    return {
        winnerChildId: '',
        winnerReason: 'draw',
        isDraw: true,
    };
}

function getWinnerReasonLabel(reason) {
    if (reason === 'score') return '分数';
    if (reason === 'duration') return '同分比用时';
    if (reason === 'draw') return '平局';
    return '待完成';
}

function normalizePkActivityRows(rows, matchId) {
    return ensureArray(rows)
        .filter((row) => {
            const payload = ensureObject(row && (row.payload_json || row.payloadJson));
            return String(payload.matchId || payload.match_id || '').trim() === String(matchId || '').trim();
        })
        .sort((left, right) => String(right.created_at || right.createdAt || '').localeCompare(String(left.created_at || left.createdAt || '')));
}

function findDirectedFriendship(friendships, sourceChildId, targetChildId) {
    return ensureArray(friendships).find((row) => (
        row
        && row.child_id === sourceChildId
        && row.friend_child_id === targetChildId
        && row.status === 'active'
    )) || null;
}

function summarizeFriendshipState(aToB, bToA) {
    if (aToB && bToA) return 'mutual';
    if (aToB) return 'a_to_b_only';
    if (bToA) return 'b_to_a_only';
    return 'none';
}

function getFriendshipStateLabel(state) {
    if (state === 'mutual') return '双向好友';
    if (state === 'a_to_b_only') return '仅 A -> B';
    if (state === 'b_to_a_only') return '仅 B -> A';
    return '不是好友';
}

function buildPairDirectionState(sourceChild, targetChild, options = {}) {
    const source = ensureObject(sourceChild);
    const target = ensureObject(targetChild);
    const sameHousehold = Boolean(options.sameHousehold);
    const sourceToTargetFriend = Boolean(options.sourceToTargetFriend);
    const targetToSourceFriend = Boolean(options.targetToSourceFriend);

    const canViewSocialProfile = sameHousehold || targetToSourceFriend;
    const canViewHouse = sameHousehold || (target.home_visibility === 'friends' && canViewSocialProfile);
    const canVisit = sameHousehold || (target.visit_access === 'friends' && sourceToTargetFriend);
    const canChallenge = sameHousehold || (target.pk_access === 'friends' && sourceToTargetFriend);

    const socialReason = sameHousehold
        ? '同家庭，默认可见社交资料'
        : targetToSourceFriend
            ? '目标孩子已把对方加入好友'
            : '缺少目标孩子 -> 当前孩子的活跃好友关系';
    const houseReason = sameHousehold
        ? '同家庭，默认可看小屋'
        : target.home_visibility !== 'friends'
            ? '目标孩子把小屋可见性设为 private'
            : canViewSocialProfile
                ? '目标孩子开放好友可见，且好友关系满足查看条件'
                : '小屋可见性已开放，但社交资料查看条件未满足';
    const visitReason = sameHousehold
        ? '同家庭，默认可串门'
        : target.visit_access !== 'friends'
            ? '目标孩子把串门权限设为 private'
            : sourceToTargetFriend
                ? '目标孩子开放好友串门，且当前孩子拥有活跃好友边'
                : '串门需要当前孩子 -> 目标孩子的活跃好友关系';
    const challengeReason = sameHousehold
        ? '同家庭，默认可发起 PK'
        : target.pk_access !== 'friends'
            ? '目标孩子把 PK 权限设为 private'
            : sourceToTargetFriend
                ? '目标孩子开放好友 PK，且当前孩子拥有活跃好友边'
                : '发起 PK 需要当前孩子 -> 目标孩子的活跃好友关系';

    return {
        sourceChildId: source.id || '',
        sourceName: source.display_name || '',
        targetChildId: target.id || '',
        targetName: target.display_name || '',
        sameHousehold,
        sourceToTargetFriend,
        targetToSourceFriend,
        canViewSocialProfile,
        canViewHouse,
        canVisit,
        canChallenge,
        socialReason,
        houseReason,
        visitReason,
        challengeReason,
    };
}

function normalizePairVisits(rows, childAId, childBId) {
    return ensureArray(rows)
        .filter((row) => {
            const fromChildId = row && (row.from_child_id || row.fromChildId);
            const toChildId = row && (row.to_child_id || row.toChildId);
            return (
                (fromChildId === childAId && toChildId === childBId)
                || (fromChildId === childBId && toChildId === childAId)
            );
        })
        .sort((left, right) => String(right.created_at || right.createdAt || '').localeCompare(String(left.created_at || left.createdAt || '')));
}

function normalizePairPkMatches(rows, childAId, childBId) {
    return ensureArray(rows)
        .filter((row) => {
            const challengerId = row && (row.challenger_child_id || row.challengerChildId);
            const opponentId = row && (row.opponent_child_id || row.opponentChildId);
            return (
                (challengerId === childAId && opponentId === childBId)
                || (challengerId === childBId && opponentId === childAId)
            );
        })
        .sort((left, right) => String(right.created_at || right.createdAt || '').localeCompare(String(left.created_at || left.createdAt || '')));
}

function isPairRelatedActivityRow(row, childAId, childBId) {
    const payload = ensureObject(row && (row.payload_json || row.payloadJson));
    const directChildId = row && (row.child_id || row.childId);
    const fromChildId = payload.fromChildId || payload.from_child_id || '';
    const toChildId = payload.toChildId || payload.to_child_id || '';
    const childId = payload.childId || payload.child_id || '';
    const peerChildId = payload.peerChildId || payload.peer_child_id || '';
    const challengerChildId = payload.challengerChildId || payload.challenger_child_id || '';
    const opponentChildId = payload.opponentChildId || payload.opponent_child_id || '';
    const friendChildId = payload.friendChildId || payload.friend_child_id || '';

    const pairChecks = [
        [fromChildId, toChildId],
        [childId, peerChildId],
        [challengerChildId, opponentChildId],
        [directChildId, friendChildId],
        [childId, friendChildId],
    ];

    return pairChecks.some(([left, right]) => (
        (left === childAId && right === childBId)
        || (left === childBId && right === childAId)
    ));
}

function normalizePairActivityRows(rows, childAId, childBId) {
    return ensureArray(rows)
        .filter((row) => isPairRelatedActivityRow(row, childAId, childBId))
        .sort((left, right) => String(right.created_at || right.createdAt || '').localeCompare(String(left.created_at || left.createdAt || '')));
}

function buildPairInspectData(rawData, meta = {}) {
    const raw = ensureObject(rawData);
    const children = ensureArray(raw.children);
    if (children.length < 2) {
        throw new Error('孩子关系检查输入至少需要 2 个孩子');
    }

    const childA = ensureObject(raw.childA || children[0]);
    const childB = ensureObject(raw.childB || children[1]);
    if (!childA.id || !childB.id) {
        throw new Error('孩子关系检查输入缺少 child id');
    }

    const childAId = childA.id;
    const childBId = childB.id;
    const sameHousehold = Boolean(childA.household_id && childA.household_id === childB.household_id && childAId !== childBId);
    const friendships = ensureArray(raw.friendships);
    const aToBFriend = findDirectedFriendship(friendships, childAId, childBId);
    const bToAFriend = findDirectedFriendship(friendships, childBId, childAId);
    const friendshipState = summarizeFriendshipState(aToBFriend, bToAFriend);
    const recentVisits = normalizePairVisits(raw.visits, childAId, childBId);
    const recentPkMatches = normalizePairPkMatches(raw.pkMatches, childAId, childBId);
    const recentActivity = normalizePairActivityRows(raw.activityFeed, childAId, childBId);
    const aToB = buildPairDirectionState(childA, childB, {
        sameHousehold,
        sourceToTargetFriend: Boolean(aToBFriend),
        targetToSourceFriend: Boolean(bToAFriend),
    });
    const bToA = buildPairDirectionState(childB, childA, {
        sameHousehold,
        sourceToTargetFriend: Boolean(bToAFriend),
        targetToSourceFriend: Boolean(aToBFriend),
    });

    return {
        generatedAt: meta.generatedAt || new Date().toISOString(),
        source: meta.source || 'live-supabase',
        sourceFile: meta.sourceFile ? toPosixPath(meta.sourceFile) : '',
        summary: {
            childAId,
            childAName: childA.display_name || '',
            childBId,
            childBName: childB.display_name || '',
            sameHousehold,
            sharedHouseholdId: sameHousehold ? childA.household_id : '',
            friendshipState,
            friendshipStateLabel: getFriendshipStateLabel(friendshipState),
            visitCount: recentVisits.length,
            pkMatchCount: recentPkMatches.length,
            activityCount: recentActivity.length,
        },
        childA,
        childB,
        aToB,
        bToA,
        recentVisits,
        recentPkMatches,
        recentActivity,
    };
}

function normalizeDiagnosticsChildRow(child) {
    const safeChild = ensureObject(child);
    return {
        id: safeChild.id || '',
        localProfileId: safeChild.localProfileId || safeChild.local_profile_id || '',
        displayName: safeChild.displayName || safeChild.display_name || '',
        emoji: safeChild.emoji || '',
        friendCode: safeChild.friendCode || safeChild.friend_code || '',
        homeVisibility: safeChild.homeVisibility || safeChild.home_visibility || '',
        visitAccess: safeChild.visitAccess || safeChild.visit_access || '',
        pkAccess: safeChild.pkAccess || safeChild.pk_access || '',
        lastSyncedAt: safeChild.lastSyncedAt || safeChild.last_synced_at || '',
    };
}

function normalizeDiagnosticsProfileRow(profile) {
    const safeProfile = ensureObject(profile);
    return {
        id: safeProfile.id || '',
        name: safeProfile.name || '',
        emoji: safeProfile.emoji || '',
    };
}

function normalizeDiagnosticsSnapshot(rawSnapshot, meta = {}) {
    const raw = ensureObject(rawSnapshot);
    const auth = ensureObject(raw.auth);
    const household = ensureObject(raw.household);
    const profiles = ensureObject(raw.profiles);
    const social = ensureObject(raw.social);
    const restore = ensureObject(raw.restore);
    const sync = ensureObject(raw.sync);
    const cloud = ensureObject(raw.cloud);
    const activity = ensureObject(raw.activity);
    const pk = ensureObject(raw.pk);
    const device = ensureObject(raw.device);

    return {
        sourceFile: meta.sourceFile ? toPosixPath(meta.sourceFile) : '',
        generatedAt: raw.generatedAt || '',
        device: {
            label: device.label || '',
            userAgent: device.userAgent || device.user_agent || '',
        },
        auth: {
            userId: auth.userId || auth.user_id || '',
            email: auth.email || '',
            parentName: auth.parentName || auth.parent_name || '',
            status: auth.status || '',
        },
        cloud: {
            configSource: cloud.configSource || '',
            configSourceLabel: cloud.configSourceLabel || '',
            supabaseUrl: cloud.supabaseUrl || '',
            siteUrl: cloud.siteUrl || '',
        },
        household: {
            primaryHouseholdId: household.primaryHouseholdId || household.primary_household_id || '',
            primaryHouseholdName: household.primaryHouseholdName || household.primary_household_name || '',
            cloudChildCount: Number(household.cloudChildCount || household.cloud_child_count || ensureArray(household.children).length || 0),
            children: ensureArray(household.children).map(normalizeDiagnosticsChildRow).filter((row) => row.id),
        },
        profiles: {
            totalProfiles: Number(profiles.totalProfiles || profiles.total_profiles || ensureArray(profiles.profiles).length || 0),
            activeProfileId: profiles.activeProfileId || profiles.active_profile_id || '',
            activeProfileName: profiles.activeProfileName || profiles.active_profile_name || '',
            profiles: ensureArray(profiles.profiles).map(normalizeDiagnosticsProfileRow).filter((row) => row.id),
        },
        social: {
            activeCloudChildId: social.activeCloudChildId || social.active_cloud_child_id || '',
            householdPeerCount: Number(social.householdPeerCount || social.household_peer_count || 0),
            friendCount: Number(social.friendCount || social.friend_count || 0),
        },
        restore: {
            lastHydratedAt: restore.lastHydratedAt || restore.last_hydrated_at || '',
            info: restore.info || '',
            error: restore.error || '',
        },
        sync: {
            lastOutcome: sync.lastOutcome || sync.last_outcome || '',
            lastLocalProfileId: sync.lastLocalProfileId || sync.last_local_profile_id || '',
            lastKnownChildId: sync.lastKnownChildId || sync.last_known_child_id || '',
            lastSucceededAt: sync.lastSucceededAt || sync.last_succeeded_at || '',
        },
        activity: {
            entryCount: Number(activity.entryCount || activity.entry_count || 0),
        },
        pk: {
            matchCount: Number(pk.matchCount || pk.match_count || 0),
            pendingCount: Number(pk.pendingCount || pk.pending_count || 0),
        },
        issues: ensureArray(raw.issues).map((item) => String(item || '').trim()).filter(Boolean),
    };
}

function diffStringSets(leftValues, rightValues) {
    const leftSet = new Set((leftValues || []).filter(Boolean));
    const rightSet = new Set((rightValues || []).filter(Boolean));
    const onlyOnLeft = [...leftSet].filter((value) => !rightSet.has(value)).sort();
    const onlyOnRight = [...rightSet].filter((value) => !leftSet.has(value)).sort();
    return {
        onlyOnLeft,
        onlyOnRight,
        aligned: onlyOnLeft.length === 0 && onlyOnRight.length === 0,
    };
}

function buildDiagnosticsCompareData(leftRaw, rightRaw, meta = {}) {
    const left = normalizeDiagnosticsSnapshot(leftRaw, {
        sourceFile: meta.leftFile,
    });
    const right = normalizeDiagnosticsSnapshot(rightRaw, {
        sourceFile: meta.rightFile,
    });

    const leftCloudChildIds = left.household.children.map((row) => row.id);
    const rightCloudChildIds = right.household.children.map((row) => row.id);
    const leftLocalProfileIds = left.profiles.profiles.map((row) => row.id);
    const rightLocalProfileIds = right.profiles.profiles.map((row) => row.id);
    const cloudChildDiff = diffStringSets(leftCloudChildIds, rightCloudChildIds);
    const localProfileDiff = diffStringSets(leftLocalProfileIds, rightLocalProfileIds);
    const sameUserId = Boolean(left.auth.userId && left.auth.userId === right.auth.userId);
    const samePrimaryHouseholdId = Boolean(
        left.household.primaryHouseholdId
        && left.household.primaryHouseholdId === right.household.primaryHouseholdId
    );

    const leftChildrenById = new Map(left.household.children.map((row) => [row.id, row]));
    const rightChildrenById = new Map(right.household.children.map((row) => [row.id, row]));
    const leftProfilesById = new Map(left.profiles.profiles.map((row) => [row.id, row]));
    const rightProfilesById = new Map(right.profiles.profiles.map((row) => [row.id, row]));
    const differences = [];
    const localProfileDifferences = [];
    const sharedChildFieldDifferences = [];

    cloudChildDiff.onlyOnLeft.forEach((childId) => {
        const row = leftChildrenById.get(childId) || {};
        differences.push({
            type: 'cloud_child_missing_on_right',
            childId,
            displayName: row.displayName || '',
            localProfileId: row.localProfileId || '',
            summary: `${row.displayName || childId} 只出现在左侧设备的云端孩子列表`,
        });
    });
    cloudChildDiff.onlyOnRight.forEach((childId) => {
        const row = rightChildrenById.get(childId) || {};
        differences.push({
            type: 'cloud_child_missing_on_left',
            childId,
            displayName: row.displayName || '',
            localProfileId: row.localProfileId || '',
            summary: `${row.displayName || childId} 只出现在右侧设备的云端孩子列表`,
        });
    });
    localProfileDiff.onlyOnLeft.forEach((profileId) => {
        const row = leftProfilesById.get(profileId) || {};
        localProfileDifferences.push({
            type: 'local_profile_missing_on_right',
            localProfileId: profileId,
            displayName: row.name || '',
            summary: `${row.name || profileId} 只出现在左侧设备的本地档案列表`,
        });
    });
    localProfileDiff.onlyOnRight.forEach((profileId) => {
        const row = rightProfilesById.get(profileId) || {};
        localProfileDifferences.push({
            type: 'local_profile_missing_on_left',
            localProfileId: profileId,
            displayName: row.name || '',
            summary: `${row.name || profileId} 只出现在右侧设备的本地档案列表`,
        });
    });

    const sharedChildIds = [...leftChildrenById.keys()]
        .filter((childId) => rightChildrenById.has(childId))
        .sort();
    const comparableChildFields = [
        'localProfileId',
        'friendCode',
        'homeVisibility',
        'visitAccess',
        'pkAccess',
    ];

    sharedChildIds.forEach((childId) => {
        const leftChild = leftChildrenById.get(childId) || {};
        const rightChild = rightChildrenById.get(childId) || {};
        comparableChildFields.forEach((field) => {
            const leftValue = String(leftChild[field] || '').trim();
            const rightValue = String(rightChild[field] || '').trim();
            if (leftValue === rightValue) {
                return;
            }
            const difference = {
                type: 'shared_child_field_mismatch',
                childId,
                displayName: leftChild.displayName || rightChild.displayName || '',
                field,
                leftValue,
                rightValue,
                summary: `${leftChild.displayName || rightChild.displayName || childId} 的 ${field} 左右设备不一致`,
            };
            sharedChildFieldDifferences.push(difference);
            differences.push(difference);
        });
    });

    differences.push(...localProfileDifferences);

    return {
        generatedAt: meta.generatedAt || new Date().toISOString(),
        source: 'diagnostics-json-compare',
        left,
        right,
        summary: {
            sameUserId,
            samePrimaryHouseholdId,
            sharedPrimaryHouseholdId: samePrimaryHouseholdId ? left.household.primaryHouseholdId : '',
            leftCloudChildCount: left.household.cloudChildCount,
            rightCloudChildCount: right.household.cloudChildCount,
            leftLocalProfileCount: left.profiles.totalProfiles,
            rightLocalProfileCount: right.profiles.totalProfiles,
            cloudChildrenAligned: cloudChildDiff.aligned,
            localProfilesAligned: localProfileDiff.aligned,
            sharedChildFieldsAligned: sharedChildFieldDifferences.length === 0,
            sharedChildFieldMismatchCount: sharedChildFieldDifferences.length,
            leftIssueCount: left.issues.length,
            rightIssueCount: right.issues.length,
        },
        onlyOnLeft: {
            cloudChildIds: cloudChildDiff.onlyOnLeft,
            localProfileIds: localProfileDiff.onlyOnLeft,
        },
        onlyOnRight: {
            cloudChildIds: cloudChildDiff.onlyOnRight,
            localProfileIds: localProfileDiff.onlyOnRight,
        },
        sharedChildFieldDifferences,
        differences,
    };
}

function buildPkInspectData(rawData, meta = {}) {
    const raw = ensureObject(rawData);
    const match = ensureObject(raw.match);
    if (!match.id) {
        throw new Error('PK 检查输入缺少 match.id');
    }

    const questionSet = buildPkQuestionSetSummary(match, raw.questionSet);
    const children = new Map(ensureArray(raw.children).map((row) => [row.id, row]));
    const challengerChildId = match.challenger_child_id || match.challengerChildId || '';
    const opponentChildId = match.opponent_child_id || match.opponentChildId || '';
    const challengerChild = ensureObject(children.get(challengerChildId));
    const opponentChild = ensureObject(children.get(opponentChildId));
    const attempts = ensureArray(raw.attempts).map(normalizePkAttempt).filter(Boolean);
    const challengerAttempt = attempts.find((row) => row.childId === challengerChildId) || null;
    const opponentAttempt = attempts.find((row) => row.childId === opponentChildId) || null;
    const outcome = decidePkWinner(challengerAttempt, opponentAttempt, challengerChildId, opponentChildId);
    const recentActivity = normalizePkActivityRows(raw.activityFeed, match.id);
    const winnerName = outcome.winnerChildId === challengerChildId
        ? challengerChild.display_name || ''
        : outcome.winnerChildId === opponentChildId
            ? opponentChild.display_name || ''
            : '';

    return {
        generatedAt: meta.generatedAt || new Date().toISOString(),
        source: meta.source || 'live-supabase',
        sourceFile: meta.sourceFile ? toPosixPath(meta.sourceFile) : '',
        summary: {
            matchId: match.id,
            gameType: match.game_type || match.gameType || questionSet.gameType,
            gameLabel: getPkGameLabel(match.game_type || match.gameType || questionSet.gameType),
            status: match.status || '',
            questionSetId: questionSet.id,
            questionCount: questionSet.questionCount,
            attemptCount: attempts.length,
            activityCount: recentActivity.length,
            challengerChildId,
            challengerName: challengerChild.display_name || '',
            opponentChildId,
            opponentName: opponentChild.display_name || '',
            winnerChildId: outcome.winnerChildId,
            winnerName,
            winnerReason: outcome.winnerReason,
            winnerReasonLabel: getWinnerReasonLabel(outcome.winnerReason),
        },
        match: {
            ...match,
        },
        questionSet,
        challenger: {
            child: challengerChild,
            attempt: challengerAttempt,
        },
        opponent: {
            child: opponentChild,
            attempt: opponentAttempt,
        },
        recentActivity,
    };
}

function pickFirstString(entry, candidatePaths) {
    for (const candidatePath of candidatePaths) {
        let current = entry;
        let missing = false;
        for (const segment of candidatePath) {
            if (!current || typeof current !== 'object' || !(segment in current)) {
                missing = true;
                break;
            }
            current = current[segment];
        }
        if (missing) continue;
        if (current === undefined || current === null) continue;
        const text = String(current).trim();
        if (text) return text;
    }
    return '';
}

function extractArrayLike(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object') return [];
    const candidates = ['entries', 'logs', 'events', 'result', 'items', 'data'];
    for (const key of candidates) {
        if (Array.isArray(value[key])) return value[key];
    }
    return [];
}

function normalizeLogLevel(rawLevel) {
    const value = String(rawLevel || 'info').trim().toLowerCase();
    if (!value) return 'info';
    if (value.includes('fatal')) return 'fatal';
    if (value.includes('error') || value === 'err') return 'error';
    if (value.includes('warn')) return 'warn';
    if (value.includes('debug')) return 'debug';
    return 'info';
}

function isErrorLevel(level) {
    return level === 'error' || level === 'fatal';
}

function isWarnLevel(level) {
    return level === 'warn';
}

function normalizeFunctionLogEntries(payload) {
    const entries = extractArrayLike(payload);
    return entries.map((entry, index) => {
        const functionName = pickFirstString(entry, [
            ['function'],
            ['function_name'],
            ['functionName'],
            ['metadata', 'function'],
            ['context', 'function'],
            ['attributes', 'function'],
        ]) || 'unknown-function';
        const level = normalizeLogLevel(pickFirstString(entry, [
            ['level'],
            ['severity'],
            ['status'],
            ['metadata', 'level'],
            ['context', 'level'],
        ]));
        const message = pickFirstString(entry, [
            ['message'],
            ['error'],
            ['text'],
            ['event_message'],
            ['metadata', 'message'],
            ['context', 'message'],
        ]) || '(empty)';
        const timestamp = pickFirstString(entry, [
            ['timestamp'],
            ['created_at'],
            ['time'],
            ['ts'],
            ['metadata', 'timestamp'],
        ]);
        const requestId = pickFirstString(entry, [
            ['request_id'],
            ['requestId'],
            ['trace_id'],
            ['metadata', 'request_id'],
            ['context', 'request_id'],
        ]);

        return {
            index,
            functionName,
            level,
            message,
            timestamp,
            requestId,
            raw: entry,
        };
    });
}

function buildLogsReportData(payload, options) {
    const date = resolveDateString(options);
    const entries = normalizeFunctionLogEntries(payload);
    const functionStatsMap = new Map();
    const messageStatsMap = new Map();
    const recentErrors = [];
    let errorCount = 0;
    let warnCount = 0;

    entries.forEach((entry) => {
        const stats = functionStatsMap.get(entry.functionName) || {
            functionName: entry.functionName,
            totalCount: 0,
            errorCount: 0,
            warnCount: 0,
            latestAt: '',
            latestErrorAt: '',
        };

        stats.totalCount += 1;
        if (!stats.latestAt || (entry.timestamp && entry.timestamp > stats.latestAt)) {
            stats.latestAt = entry.timestamp || stats.latestAt;
        }

        if (isErrorLevel(entry.level)) {
            errorCount += 1;
            stats.errorCount += 1;
            if (!stats.latestErrorAt || (entry.timestamp && entry.timestamp > stats.latestErrorAt)) {
                stats.latestErrorAt = entry.timestamp || stats.latestErrorAt;
            }
            recentErrors.push(entry);
            const messageKey = `${entry.functionName}:::${entry.message}`;
            const messageStat = messageStatsMap.get(messageKey) || {
                functionName: entry.functionName,
                message: entry.message,
                count: 0,
                latestAt: '',
            };
            messageStat.count += 1;
            if (!messageStat.latestAt || (entry.timestamp && entry.timestamp > messageStat.latestAt)) {
                messageStat.latestAt = entry.timestamp || messageStat.latestAt;
            }
            messageStatsMap.set(messageKey, messageStat);
        } else if (isWarnLevel(entry.level)) {
            warnCount += 1;
            stats.warnCount += 1;
        }

        functionStatsMap.set(entry.functionName, stats);
    });

    const functionStats = [...functionStatsMap.values()].sort((a, b) => (
        b.errorCount - a.errorCount
        || b.warnCount - a.warnCount
        || b.totalCount - a.totalCount
        || a.functionName.localeCompare(b.functionName)
    ));
    const topErrorMessages = [...messageStatsMap.values()].sort((a, b) => (
        b.count - a.count
        || String(b.latestAt || '').localeCompare(String(a.latestAt || ''))
    ));
    recentErrors.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

    return {
        summary: {
            generatedAt: new Date().toISOString(),
            date,
            entryCount: entries.length,
            errorCount,
            warnCount,
            functionCount: functionStats.length,
            topFunction: functionStats.length ? functionStats[0].functionName : '',
        },
        functionStats,
        topErrorMessages,
        recentErrors: recentErrors.slice(0, 20),
    };
}

function buildLogsReportMarkdown(data, meta) {
    const summary = data.summary || {};
    const functionStats = ensureArray(data.functionStats);
    const topErrorMessages = ensureArray(data.topErrorMessages);
    const recentErrors = ensureArray(data.recentErrors);

    return [
        `# 家庭账号社交函数日志汇总（${meta.date}）`,
        '',
        `> 生成时间：\`${meta.generatedAt}\``,
        meta.sourceFile ? `> 输入文件：\`${toPosixPath(meta.sourceFile)}\`` : '',
        '',
        '## 概览',
        '',
        renderMarkdownTable(
            ['指标', '值'],
            [
                ['总日志条数', summary.entryCount],
                ['错误条数', summary.errorCount],
                ['警告条数', summary.warnCount],
                ['涉及函数数', summary.functionCount],
                ['最需要关注函数', summary.topFunction || '-'],
            ]
        ),
        '',
        '## 函数维度',
        '',
        renderMarkdownTable(
            ['函数', '总条数', '错误', '警告', '最近日志', '最近错误'],
            functionStats.map((row) => [
                row.functionName,
                row.totalCount,
                row.errorCount,
                row.warnCount,
                formatDate(row.latestAt),
                formatDate(row.latestErrorAt),
            ])
        ),
        '',
        '## 高频错误消息',
        '',
        renderMarkdownTable(
            ['函数', '错误消息', '出现次数', '最近时间'],
            topErrorMessages.slice(0, 20).map((row) => [
                row.functionName,
                row.message,
                row.count,
                formatDate(row.latestAt),
            ])
        ),
        '',
        '## 最近错误',
        '',
        renderMarkdownTable(
            ['时间', '函数', '级别', '消息', 'request_id'],
            recentErrors.map((row) => [
                formatDate(row.timestamp),
                row.functionName,
                row.level,
                row.message,
                row.requestId || '-',
            ])
        ),
        '',
    ].filter(Boolean).join('\n');
}

function escapeMarkdownCell(value) {
    return String(value ?? '-')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>');
}

function renderMarkdownTable(columns, rows) {
    const header = `| ${columns.join(' | ')} |`;
    const divider = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = rows.length
        ? rows.map((row) => `| ${row.map(escapeMarkdownCell).join(' | ')} |`).join('\n')
        : `| ${columns.map(() => '-').join(' | ')} |`;
    return [header, divider, body].join('\n');
}

function renderMarkdownListSection(title, columns, rows, emptyText) {
    const content = rows.length
        ? renderMarkdownTable(columns, rows)
        : (emptyText || '当前没有异常。');
    return `## ${title}\n\n${content}`;
}

function collectMissing(expected, actual) {
    const actualSet = new Set(actual);
    return expected.filter((item) => !actualSet.has(item));
}

function collectExtra(expected, actual) {
    const expectedSet = new Set(expected);
    return actual.filter((item) => !expectedSet.has(item));
}

function makeDoctorCheck(checkId, label, status, detail, action) {
    return {
        checkId,
        label,
        status,
        detail,
        action: action || '',
    };
}

function resolveDoctorEnv(options) {
    const envFile = path.resolve(getRepoRoot(), String(options['env-file'] || '.env'));
    const envExists = fs.existsSync(envFile);
    const envFromFile = envExists ? parseEnvFile(envFile) : {};
    const mergedEnv = { ...envFromFile, ...process.env };

    return {
        envFile,
        envExists,
        mergedEnv,
        supabaseUrl: normalizeBaseUrl(options.url || mergedEnv.SUPABASE_URL || mergedEnv.APP_SUPABASE_URL),
        anonKey: String(options['anon-key'] || mergedEnv.APP_SUPABASE_ANON_KEY || mergedEnv.SUPABASE_ANON_KEY || '').trim(),
        serviceRoleKey: String(options['service-role-key'] || mergedEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
        siteUrl: String(options['site-url'] || mergedEnv.APP_SUPABASE_SITE_URL || '').trim(),
    };
}

function inspectUrl(value, kindLabel, checkKey = kindLabel) {
    if (!value) {
        return makeDoctorCheck(
            `${checkKey}_missing`,
            `${kindLabel} 已配置`,
            'fail',
            `缺少 ${kindLabel}`,
            `请在 .env 中补上 ${kindLabel}`
        );
    }

    try {
        const parsed = new URL(value);
        if (!/^https?:$/.test(parsed.protocol)) {
            return makeDoctorCheck(
                `${checkKey}_invalid_protocol`,
                `${kindLabel} 已配置`,
                'fail',
                `${kindLabel} 协议非法：${parsed.protocol}`,
                '请改成 http:// 或 https://'
            );
        }

        if (parsed.protocol !== 'https:' && kindLabel !== 'APP_SUPABASE_SITE_URL') {
            return makeDoctorCheck(
                `${checkKey}_http_warning`,
                `${kindLabel} 已配置`,
                'warn',
                `${kindLabel} 当前不是 https：${value}`,
                '如果不是本地开发环境，建议切到 https'
            );
        }

        if (checkKey === 'supabase_url' && !String(parsed.hostname || '').includes('supabase')) {
            return makeDoctorCheck(
                `${checkKey}_host_warning`,
                `${kindLabel} 已配置`,
                'warn',
                `${kindLabel} 看起来不像标准 Supabase 域名：${value}`,
                '若为自托管可忽略，否则确认 project URL 是否填错'
            );
        }

        return makeDoctorCheck(
            `${checkKey}_ok`,
            `${kindLabel} 已配置`,
            'pass',
            value,
            ''
        );
    } catch (error) {
        return makeDoctorCheck(
            `${checkKey}_invalid`,
            `${kindLabel} 已配置`,
            'fail',
            `${kindLabel} 不是合法 URL：${value}`,
            '请修正成合法 URL'
        );
    }
}

function inspectSupabaseCli() {
    const result = spawnSync('supabase', ['--version'], {
        encoding: 'utf-8',
        windowsHide: true,
    });

    if (result.error) {
        return makeDoctorCheck(
            'supabase_cli_missing',
            'Supabase CLI 可用',
            'warn',
            '本机未检测到 supabase CLI',
            '如需真实部署，请先安装 Supabase CLI'
        );
    }

    if (result.status !== 0) {
        return makeDoctorCheck(
            'supabase_cli_error',
            'Supabase CLI 可用',
            'warn',
            (result.stderr || result.stdout || 'supabase --version 执行失败').trim(),
            '检查 Supabase CLI 是否安装正确'
        );
    }

    return makeDoctorCheck(
        'supabase_cli_ok',
        'Supabase CLI 可用',
        'pass',
        (result.stdout || '').trim() || '已安装',
        ''
    );
}

function inspectExpectedEntries(dirPath, expectedEntries, label, options = {}) {
    const exists = fs.existsSync(dirPath);
    if (!exists) {
        return makeDoctorCheck(
            `${label}_dir_missing`,
            `${label} 目录存在`,
            'fail',
            `缺少目录：${toPosixPath(dirPath)}`,
            `确认仓库里存在 ${label} 目录`
        );
    }

    const entries = fs.readdirSync(dirPath).sort();
    const missing = collectMissing(expectedEntries, entries);
    const extra = options.allowExtra ? [] : collectExtra(expectedEntries, entries);

    if (missing.length) {
        return makeDoctorCheck(
            `${label}_missing`,
            `${label} 清单完整`,
            'fail',
            `缺少：${missing.join(', ')}`,
            `补齐缺失的 ${label}`
        );
    }

    if (extra.length) {
        return makeDoctorCheck(
            `${label}_extra`,
            `${label} 清单完整`,
            'warn',
            `存在额外项：${extra.join(', ')}`,
            '确认这些额外项是否应纳入当前 rollout'
        );
    }

    return makeDoctorCheck(
        `${label}_ok`,
        `${label} 清单完整`,
        'pass',
        `共 ${entries.length} 项`,
        ''
    );
}

function inspectDatedArtifacts(date) {
    const baseDir = path.join(getRepoRoot(), 'docs', '家庭账号社交体系', '联调上线');
    const files = [
        `manual-run-${date}.md`,
        `deploy-log-${date}.md`,
        `go-no-go-${date}.md`,
    ];
    const missing = files.filter((name) => !fs.existsSync(path.join(baseDir, name)));

    if (missing.length) {
        return makeDoctorCheck(
            'dated_artifacts_missing',
            '当天交接件已生成',
            'warn',
            `缺少：${missing.join(', ')}`,
            `可运行 template:all 或 pilot:bundle 生成 ${date} 的交接件`
        );
    }

    return makeDoctorCheck(
        'dated_artifacts_ok',
        '当天交接件已生成',
        'pass',
        files.join(', '),
        ''
    );
}

function inspectLocalCloudConfig(env) {
    if (!env || !env.supabaseUrl || !env.anonKey) {
        return null;
    }

    const report = inspectCloudConfigFile('cloud-config.local.js');
    if (!report.exists) {
        return makeDoctorCheck(
            'cloud_config_local_missing',
            'cloud-config.local.js 已就绪',
            'warn',
            `缺少 ${toPosixPath(report.path)}`,
            '如需静态站点打开即连云端，请运行 node scripts/family-social-ops.mjs config:install-local --force，或在页面设置里手动保存配置'
        );
    }

    if (!report.valid) {
        return makeDoctorCheck(
            'cloud_config_local_invalid',
            'cloud-config.local.js 已就绪',
            'warn',
            report.error || `${toPosixPath(report.path)} 缺少 window.__PETBANK_CLOUD_CONFIG__`,
            '请重新生成 cloud-config.local.js，或确认该文件是否被其他脚本覆盖'
        );
    }

    if (report.hasPlaceholderValues) {
        return makeDoctorCheck(
            'cloud_config_local_placeholder',
            'cloud-config.local.js 已就绪',
            'warn',
            `${toPosixPath(report.path)} 仍包含占位值`,
            '请用真实 Supabase URL 和 anon key 重新生成本地云端配置文件'
        );
    }

    if (report.supabaseUrl !== env.supabaseUrl || report.anonKey !== env.anonKey) {
        return makeDoctorCheck(
            'cloud_config_local_mismatch',
            'cloud-config.local.js 已就绪',
            'warn',
            `${toPosixPath(report.path)} 与当前 .env / 命令行里的 URL 或 anon key 不一致`,
            '请重新生成 cloud-config.local.js，或确认页面应连接的是哪一套 Supabase 配置'
        );
    }

    return makeDoctorCheck(
        'cloud_config_local_ok',
        'cloud-config.local.js 已就绪',
        'pass',
        toPosixPath(report.path),
        ''
    );
}

function collectConfigInspectData(options) {
    const env = resolveDoctorEnv(options);
    const cloudConfigReport = inspectCloudConfigFile(options['cloud-config-file'] || 'cloud-config.local.js');
    const effectiveStaticDefault = pickEffectiveStaticDefault(env, cloudConfigReport);
    const notes = [
        '注意：浏览器里已保存的配置会优先覆盖 cloud-config.local.js 或宿主页面默认配置；如果页面实际连接结果和这里不同，请到设置页检查或清空本地保存的云端配置。',
    ];

    if (!cloudConfigReport.exists && (env.supabaseUrl || env.anonKey)) {
        notes.push('当前 .env / 命令行里已经有可用配置，但静态站点默认还没安装 cloud-config.local.js；如需页面打开即直连云端，可运行 config:install-local。');
    } else if (cloudConfigReport.exists && !cloudConfigReport.valid) {
        notes.push(`cloud config 文件存在但不可解析：${cloudConfigReport.error || '缺少 window.__PETBANK_CLOUD_CONFIG__'}`);
    } else if (cloudConfigReport.hasPlaceholderValues) {
        notes.push('cloud config 文件仍包含占位值，真实联调前请重新生成。');
    } else if (
        cloudConfigReport.valid
        && env.supabaseUrl
        && env.anonKey
        && (cloudConfigReport.supabaseUrl !== env.supabaseUrl || cloudConfigReport.anonKey !== env.anonKey)
    ) {
        notes.push('cloud-config.local.js 与当前 .env / 命令行中的 URL 或 anon key 不一致，建议先统一这两处配置再联调。');
    }

    return {
        generatedAt: new Date().toISOString(),
        envFile: {
            path: toPosixPath(env.envFile),
            exists: env.envExists,
        },
        envConfig: {
            supabaseUrl: env.supabaseUrl,
            hasAnonKey: Boolean(env.anonKey),
            anonKeyLength: env.anonKey.length,
            siteUrl: env.siteUrl,
            hasServiceRoleKey: Boolean(env.serviceRoleKey),
            serviceRoleKeyLength: env.serviceRoleKey.length,
        },
        cloudConfigFile: {
            path: toPosixPath(cloudConfigReport.path),
            exists: cloudConfigReport.exists,
            valid: cloudConfigReport.valid,
            sourceKey: cloudConfigReport.sourceKey,
            sourceLabel: cloudConfigReport.sourceLabel,
            supabaseUrl: cloudConfigReport.supabaseUrl,
            hasAnonKey: cloudConfigReport.hasAnonKey,
            anonKeyLength: cloudConfigReport.anonKeyLength,
            siteUrl: cloudConfigReport.siteUrl,
            hasPlaceholderValues: cloudConfigReport.hasPlaceholderValues,
            error: cloudConfigReport.error,
        },
        effectiveStaticDefault,
        notes,
    };
}

function printConfigInspectReport(data) {
    printSection('env-file');
    printTable(
        [
            { label: '字段', key: 'field' },
            { label: '值', key: 'value' },
        ],
        [
            { field: 'path', value: data.envFile.path },
            { field: 'exists', value: formatBoolean(data.envFile.exists, 'YES', 'NO') },
        ]
    );

    printSection('env-config');
    printTable(
        [
            { label: '字段', key: 'field' },
            { label: '值', key: 'value' },
        ],
        [
            { field: 'supabaseUrl', value: data.envConfig.supabaseUrl || '-' },
            { field: 'anonKey', value: formatSecretStatus(data.envConfig.hasAnonKey, data.envConfig.anonKeyLength) },
            { field: 'siteUrl', value: data.envConfig.siteUrl || '-' },
            { field: 'serviceRoleKey', value: formatSecretStatus(data.envConfig.hasServiceRoleKey, data.envConfig.serviceRoleKeyLength) },
        ]
    );

    printSection('cloud-config-file');
    printTable(
        [
            { label: '字段', key: 'field' },
            { label: '值', key: 'value' },
        ],
        [
            { field: 'path', value: data.cloudConfigFile.path || '-' },
            { field: 'exists', value: formatBoolean(data.cloudConfigFile.exists, 'YES', 'NO') },
            { field: 'valid', value: formatBoolean(data.cloudConfigFile.valid, 'YES', 'NO') },
            { field: 'sourceKey', value: data.cloudConfigFile.sourceKey || '-' },
            { field: 'sourceLabel', value: data.cloudConfigFile.sourceLabel || '-' },
            { field: 'supabaseUrl', value: data.cloudConfigFile.supabaseUrl || '-' },
            { field: 'anonKey', value: formatSecretStatus(data.cloudConfigFile.hasAnonKey, data.cloudConfigFile.anonKeyLength) },
            { field: 'siteUrl', value: data.cloudConfigFile.siteUrl || '-' },
            { field: 'placeholder', value: formatBoolean(data.cloudConfigFile.hasPlaceholderValues, 'YES', 'NO') },
            { field: 'error', value: data.cloudConfigFile.error || '-' },
        ]
    );

    printSection('effective-static-default');
    printTable(
        [
            { label: '字段', key: 'field' },
            { label: '值', key: 'value' },
        ],
        [
            { field: 'sourceKey', value: data.effectiveStaticDefault.sourceKey || '-' },
            { field: 'sourceLabel', value: data.effectiveStaticDefault.sourceLabel || '-' },
            { field: 'supabaseUrl', value: data.effectiveStaticDefault.supabaseUrl || '-' },
            { field: 'anonKey', value: data.effectiveStaticDefault.hasAnonKey ? '已配置' : '未配置' },
            { field: 'siteUrl', value: data.effectiveStaticDefault.siteUrl || '-' },
        ]
    );

    printSection('notes');
    data.notes.forEach((note, index) => {
        console.log(`${index + 1}. ${note}`);
    });
}

function collectPilotDoctorData(options) {
    const date = resolveDateString(options);
    const env = resolveDoctorEnv(options);
    const checks = [];

    checks.push(
        env.envExists
            ? makeDoctorCheck('env_file_ok', '.env 文件存在', 'pass', toPosixPath(env.envFile), '')
            : makeDoctorCheck('env_file_missing', '.env 文件存在', 'warn', `缺少 ${toPosixPath(env.envFile)}`, '如需真实联调，请先准备 .env 或通过命令行传入配置')
    );

    checks.push(inspectUrl(env.supabaseUrl, 'APP_SUPABASE_URL / SUPABASE_URL', 'supabase_url'));
    checks.push(
        env.anonKey
            ? makeDoctorCheck('anon_key_ok', 'APP_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY 已配置', 'pass', `长度 ${env.anonKey.length}`, '')
            : makeDoctorCheck('anon_key_missing', 'APP_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY 已配置', 'fail', '缺少 APP_SUPABASE_ANON_KEY 或 SUPABASE_ANON_KEY', '前端真机联调前补上 anon key，并为函数部署准备同一份 anon key')
    );
    checks.push(
        env.serviceRoleKey
            ? makeDoctorCheck('service_role_key_ok', 'SUPABASE_SERVICE_ROLE_KEY 已配置', 'pass', `长度 ${env.serviceRoleKey.length}`, '')
            : makeDoctorCheck('service_role_key_missing', 'SUPABASE_SERVICE_ROLE_KEY 已配置', 'fail', '缺少 SUPABASE_SERVICE_ROLE_KEY', '联调/运维脚本运行前补上 service role key')
    );
    checks.push(
        env.siteUrl
            ? inspectUrl(env.siteUrl, 'APP_SUPABASE_SITE_URL')
            : makeDoctorCheck('site_url_missing', 'APP_SUPABASE_SITE_URL 已配置', 'warn', '当前未配置 APP_SUPABASE_SITE_URL', '如需真机回跳或多端联调，建议补上 site url')
    );
    checks.push(inspectSupabaseCli());
    checks.push(inspectExpectedEntries(path.join(getRepoRoot(), 'supabase', 'migrations'), EXPECTED_MIGRATIONS, 'migrations'));
    checks.push(inspectExpectedEntries(path.join(getRepoRoot(), 'supabase', 'functions'), EXPECTED_FUNCTIONS, 'functions'));
    const localCloudConfigCheck = inspectLocalCloudConfig(env);
    if (localCloudConfigCheck) {
        checks.push(localCloudConfigCheck);
    }
    checks.push(inspectExpectedEntries(
        path.join(getRepoRoot(), 'docs', '家庭账号社交体系', '联调上线'),
        EXPECTED_TEMPLATES,
        'rollout-templates',
        { allowExtra: true }
    ));
    checks.push(inspectDatedArtifacts(date));

    const summary = {
        generatedAt: new Date().toISOString(),
        date,
        passCount: checks.filter((row) => row.status === 'pass').length,
        warnCount: checks.filter((row) => row.status === 'warn').length,
        failCount: checks.filter((row) => row.status === 'fail').length,
    };
    summary.ready = summary.failCount === 0;

    return { summary, checks };
}

function buildPilotDoctorMarkdown(data, meta) {
    const summary = data.summary || {};
    const checks = ensureArray(data.checks);

    return [
        `# 家庭账号社交联调前体检（${meta.date}）`,
        '',
        `> 生成时间：\`${meta.generatedAt}\``,
        '',
        '## 总览',
        '',
        renderMarkdownTable(
            ['指标', '值'],
            [
                ['日期', summary.date],
                ['通过', summary.passCount],
                ['警告', summary.warnCount],
                ['失败', summary.failCount],
                ['是否可继续', summary.ready ? 'YES' : 'NO'],
            ]
        ),
        '',
        '## 检查项明细',
        '',
        renderMarkdownTable(
            ['检查项', '状态', '详情', '建议动作'],
            checks.map((row) => [row.label, row.status, row.detail, row.action || '-'])
        ),
        '',
    ].join('\n');
}

function buildTemplateReplacements(date) {
    return {
        DATE: date,
        GENERATED_AT: new Date().toISOString(),
        MANUAL_RUN_FILE: `manual-run-${date}.md`,
        DEPLOY_LOG_FILE: `deploy-log-${date}.md`,
        GO_NO_GO_FILE: `go-no-go-${date}.md`,
        OPS_HELP_COMMAND: 'node scripts/family-social-ops.mjs --help',
        HOUSEHOLD_INSPECT_COMMAND: 'node scripts/family-social-ops.mjs household:inspect --household <household-id>',
        CHILD_INSPECT_COMMAND: 'node scripts/family-social-ops.mjs child:inspect --child <child-id>',
        REGISTRATION_ISSUE_COMMAND: 'node scripts/family-social-ops.mjs registration:issue --count 3 --prefix PARENT-BETA --label pilot-1 --days 30 --metadata "{\\"batch\\":\\"pilot-1\\"}"',
        REGISTRATION_LIST_COMMAND: 'node scripts/family-social-ops.mjs registration:list --status pending',
    };
}

function buildDeployBundleContext(options) {
    const env = resolveDoctorEnv(options);
    const projectRef = String(options['project-ref'] || '').trim() || '<your-project-ref>';
    const supabaseUrl = normalizeBaseUrl(options.url || env.supabaseUrl) || PLACEHOLDER_SUPABASE_URL;
    const anonKey = String(options['anon-key'] || env.anonKey || '').trim() || PLACEHOLDER_SUPABASE_ANON_KEY;
    const serviceRoleKey = String(options['service-role-key'] || '').trim() || PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY;
    const siteUrl = String(options['site-url'] || env.siteUrl || '').trim() || 'http://127.0.0.1:5500';
    return {
        projectRef,
        supabaseUrl,
        anonKey,
        serviceRoleKey,
        siteUrl,
    };
}

function ensureConcreteBrowserConfig(context) {
    if (!context) {
        throw new Error('缺少云端配置上下文。');
    }

    const hasConcreteUrl = Boolean(context.supabaseUrl && context.supabaseUrl !== PLACEHOLDER_SUPABASE_URL);
    const hasConcreteAnonKey = Boolean(context.anonKey && context.anonKey !== PLACEHOLDER_SUPABASE_ANON_KEY);

    if (hasConcreteUrl && hasConcreteAnonKey) {
        return context;
    }

    throw new Error(
        'config:install-local 需要真实的 Supabase URL 和 anon key。请通过 --url / --anon-key 传入，或先在 .env 中补上 APP_SUPABASE_URL / SUPABASE_URL 与 APP_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY。'
    );
}

function buildSupabaseDeployPowerShell(context) {
    const functionCommands = EXPECTED_FUNCTIONS
        .map((name) => `supabase functions deploy ${name}`)
        .join('\r\n');

    return `# 家庭账号社交 Supabase 部署脚本
# 生成后请先确认项目 ref / URL / keys 是否正确，再执行。
# 说明：
# - URL / anon key 默认直接写入脚本，便于前端和函数共用同一组测试配置
# - service role key 优先读取当前 PowerShell 会话里的 $env:SUPABASE_SERVICE_ROLE_KEY
# - 如果没有环境变量，会退回到下方占位值；占位值请手动替换后再执行

$ProjectRef = '${sqlString(context.projectRef)}'
$SupabaseUrl = '${sqlString(context.supabaseUrl)}'
$SupabaseAnonKey = '${sqlString(context.anonKey)}'
$SupabaseServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY

if ([string]::IsNullOrWhiteSpace($SupabaseServiceRoleKey)) {
    $SupabaseServiceRoleKey = '${sqlString(context.serviceRoleKey)}'
}

if ($ProjectRef -eq '<your-project-ref>') {
    Write-Host '请先把 $ProjectRef 改成真实 Supabase project ref。' -ForegroundColor Yellow
}
if ($SupabaseUrl -eq 'https://<project>.supabase.co') {
    Write-Host '请先把 $SupabaseUrl 改成真实 Supabase URL。' -ForegroundColor Yellow
}
if ($SupabaseAnonKey -eq '<anon-key>') {
    Write-Host '请先把 $SupabaseAnonKey 改成真实 anon key。' -ForegroundColor Yellow
}
if ($SupabaseServiceRoleKey -eq '<service-role-key>') {
    Write-Host '请先设置 $env:SUPABASE_SERVICE_ROLE_KEY 或把 $SupabaseServiceRoleKey 改成真实值。' -ForegroundColor Yellow
}

supabase login
supabase link --project-ref $ProjectRef
supabase secrets set SUPABASE_URL=$SupabaseUrl SUPABASE_ANON_KEY=$SupabaseAnonKey SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey
supabase db push

${functionCommands}
`;
}

function buildCloudConfigSnippet(context, sourceFileName, sourceLabel) {
    return `window.__PETBANK_CLOUD_CONFIG_SOURCE__ = '${sqlString(sourceFileName || 'runtime-snippet')}';
window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = '${sqlString(sourceLabel || '运行时注入 window.__PETBANK_CLOUD_CONFIG__')}';
window.__PETBANK_CLOUD_CONFIG__ = {
  supabaseUrl: '${sqlString(context.supabaseUrl)}',
  supabaseAnonKey: '${sqlString(context.anonKey)}',
  siteUrl: '${sqlString(context.siteUrl)}'
};
`;
}

function createTemplateFile(templateFileName, defaultRelativeOutput, title, options) {
    const date = resolveDateString(options);
    const template = readDocTemplate(templateFileName);
    const replacements = buildTemplateReplacements(date);
    const rendered = renderTemplate(template, replacements);
    const outputPath = writeTextFile(options.output || defaultRelativeOutput(date), rendered, Boolean(options.force));
    printCreatedFile(title, outputPath);
    return outputPath;
}

async function createManualRunTemplate(_config, options) {
    createTemplateFile(
        'manual-run-template.md',
        (date) => path.join('docs', '家庭账号社交体系', '联调上线', `manual-run-${date}.md`),
        '已生成联调记录模板',
        options
    );
}

async function createDeployLogTemplate(_config, options) {
    createTemplateFile(
        'deploy-log-template.md',
        (date) => path.join('docs', '家庭账号社交体系', '联调上线', `deploy-log-${date}.md`),
        '已生成部署日志模板',
        options
    );
}

async function createGoNoGoTemplate(_config, options) {
    createTemplateFile(
        'go-no-go-template.md',
        (date) => path.join('docs', '家庭账号社交体系', '联调上线', `go-no-go-${date}.md`),
        '已生成上线决策模板',
        options
    );
}

async function createAllTemplates(_config, options) {
    const date = resolveDateString(options);
    const manualPath = createTemplateFile(
        'manual-run-template.md',
        () => path.join('docs', '家庭账号社交体系', '联调上线', `manual-run-${date}.md`),
        '已生成联调记录模板',
        { ...options, date }
    );
    const deployPath = createTemplateFile(
        'deploy-log-template.md',
        () => path.join('docs', '家庭账号社交体系', '联调上线', `deploy-log-${date}.md`),
        '已生成部署日志模板',
        { ...options, date }
    );
    const goNoGoPath = createTemplateFile(
        'go-no-go-template.md',
        () => path.join('docs', '家庭账号社交体系', '联调上线', `go-no-go-${date}.md`),
        '已生成上线决策模板',
        { ...options, date }
    );

    console.log(`\n后续建议：\n- 打开 ${toPosixPath(manualPath)} 记录双设备联调过程\n- 打开 ${toPosixPath(deployPath)} 记录 Supabase 部署与冒烟结果\n- 打开 ${toPosixPath(goNoGoPath)} 汇总结论并做 go/no-go 决策`);
}

async function listRegistrationInvites(config, options) {
    const limit = Math.max(1, asInt(options.limit, 20));
    const searchParams = {
        select: 'id,invite_code,status,label,expires_at,created_at,claimed_at,created_by_account_id,claimed_by_account_id,metadata_json',
        order: 'created_at.desc',
        limit,
    };

    if (options.status) {
        searchParams.status = `eq.${options.status}`;
    }

    const { data } = await requestJson(config, 'GET', 'registration_invites', { searchParams });
    const rows = Array.isArray(data) ? data : [];

    if (options.json) {
        printJson({ count: rows.length, invites: rows });
        return;
    }

    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'status', label: '状态' },
        { key: 'label', label: '标签' },
        { key: 'expires_at', label: '过期时间' },
        { key: 'claimed_at', label: '认领时间' },
    ], rows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        label: row.label || '-',
        expires_at: formatDate(row.expires_at),
        claimed_at: formatDate(row.claimed_at),
    })));
}

async function issueRegistrationInvites(config, options) {
    const codes = parseExplicitCodes(options, options.prefix || 'PARENT-BETA', 1);
    const days = Math.max(1, asInt(options.days, 30));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const metadata = parseMetadata(options.metadata);
    const payload = codes.map((inviteCode) => ({
        invite_code: inviteCode,
        status: 'pending',
        label: options.label ? String(options.label) : null,
        expires_at: expiresAt,
        metadata_json: metadata,
        created_by_account_id: options['created-by'] ? String(options['created-by']) : null,
    }));

    if (config.dryRun) {
        printJson({ dryRun: true, payload });
        return;
    }

    const { data } = await requestJson(config, 'POST', 'registration_invites', {
        body: payload,
        headers: { Prefer: 'return=representation' },
    });
    const rows = Array.isArray(data) ? data : [];

    if (options.json) {
        printJson({ count: rows.length, invites: rows });
        return;
    }

    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'status', label: '状态' },
        { key: 'label', label: '标签' },
        { key: 'expires_at', label: '过期时间' },
    ], rows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        label: row.label || '-',
        expires_at: formatDate(row.expires_at),
    })));
}

function buildDefaultInviteLabels(count) {
    const defaults = [
        '双家长联调-A',
        '双家长联调-B',
        '跨家庭好友联调',
    ];
    return Array.from({ length: count }, (_, index) => defaults[index] || `联调邀请码-${index + 1}`);
}

function buildRegistrationSeedSqlContent(options) {
    const date = resolveDateString(options);
    const codes = parseExplicitCodes(options, options.prefix || 'PARENT-BETA', 3);
    const days = Math.max(1, asInt(options.days, 30));
    const batch = String(options.batch || 'pilot-1').trim();
    const metadata = parseMetadata(options.metadata);
    const labelPrefix = String(options['label-prefix'] || '').trim();
    const labels = buildDefaultInviteLabels(codes.length).map((label, index) => {
        if (labelPrefix) return `${labelPrefix}-${index + 1}`;
        return label;
    });
    const mergedMetadata = Object.assign({}, metadata, { batch, generated_on: date });
    const valuesSql = codes.map((code, index) => {
        const rowMetadata = Object.assign({}, mergedMetadata, {
            seed_index: index + 1,
            seed_code: code,
        });
        return `  ('${sqlString(code)}', 'pending', '${sqlString(labels[index])}', now() + interval '${days} days', '${sqlJson(rowMetadata)}'::jsonb)`;
    }).join(',\n');
    const inClause = codes.map((code) => `'${sqlString(code)}'`).join(', ');

    return `-- 家庭账号社交注册邀请码种子数据
-- 生成日期：${date}
-- 建议用途：贴到 Supabase SQL Editor 执行，作为试运行前的邀请码种子。

insert into public.registration_invites (
  invite_code,
  status,
  label,
  expires_at,
  metadata_json
)
values
${valuesSql};

-- 执行后建议立即确认状态
select invite_code, status, label, expires_at, claimed_at
from public.registration_invites
where invite_code in (${inClause})
order by created_at desc;

-- 如需软回滚，可撤销这一批邀请码
update public.registration_invites
set status = 'revoked'
where invite_code in (${inClause})
  and status = 'pending';
`;
}

async function registrationSeedSql(_config, options) {
    const date = resolveDateString(options);
    const output = options.output || path.join('docs', '家庭账号社交体系', '联调上线', `registration-invites-${date}.sql`);
    const content = buildRegistrationSeedSqlContent(options);
    const outputPath = writeTextFile(output, content, Boolean(options.force));
    printCreatedFile('已生成注册邀请码种子 SQL', outputPath);
    return outputPath;
}

async function revokeRegistrationInvite(config, options) {
    const inviteCode = requireOption(options, 'code', '--code');

    if (config.dryRun) {
        printJson({ dryRun: true, inviteCode, status: 'revoked' });
        return;
    }

    const { data } = await requestJson(config, 'PATCH', 'registration_invites', {
        searchParams: {
            invite_code: `eq.${inviteCode}`,
            status: 'eq.pending',
            select: 'id,invite_code,status,label,expires_at',
        },
        body: { status: 'revoked' },
        headers: { Prefer: 'return=representation' },
    });
    const rows = Array.isArray(data) ? data : [];

    if (!rows.length) {
        throw new Error(`没有找到可撤销的邀请码 ${inviteCode}。它可能已被认领、已过期，或代码不匹配。`);
    }

    if (options.json) {
        printJson({ updated: rows.length, invites: rows });
        return;
    }

    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'status', label: '状态' },
        { key: 'label', label: '标签' },
        { key: 'expires_at', label: '过期时间' },
    ], rows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        label: row.label || '-',
        expires_at: formatDate(row.expires_at),
    })));
}

async function listHouseholdInvites(config, options) {
    const limit = Math.max(1, asInt(options.limit, 20));
    const searchParams = {
        select: 'id,household_id,invite_code,status,role,created_at,expires_at,claimed_at,claimed_by_account_id,invited_by_account_id',
        order: 'created_at.desc',
        limit,
    };

    if (options.household) {
        searchParams.household_id = `eq.${options.household}`;
    }
    if (options.status) {
        searchParams.status = `eq.${options.status}`;
    }

    const { data } = await requestJson(config, 'GET', 'household_invites', { searchParams });
    const rows = Array.isArray(data) ? data : [];

    if (options.json) {
        printJson({ count: rows.length, invites: rows });
        return;
    }

    printTable([
        { key: 'invite_code', label: '家庭邀请码' },
        { key: 'status', label: '状态' },
        { key: 'role', label: '角色' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'expires_at', label: '过期时间' },
    ], rows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        role: row.role,
        household_id: row.household_id,
        expires_at: formatDate(row.expires_at),
    })));
}

async function revokeHouseholdInvite(config, options) {
    const inviteCode = requireOption(options, 'code', '--code');

    if (config.dryRun) {
        printJson({ dryRun: true, inviteCode, status: 'revoked' });
        return;
    }

    const { data } = await requestJson(config, 'PATCH', 'household_invites', {
        searchParams: {
            invite_code: `eq.${inviteCode}`,
            status: 'eq.pending',
            select: 'id,household_id,invite_code,status,role,expires_at',
        },
        body: { status: 'revoked' },
        headers: { Prefer: 'return=representation' },
    });
    const rows = Array.isArray(data) ? data : [];

    if (!rows.length) {
        throw new Error(`没有找到可撤销的家庭邀请码 ${inviteCode}。它可能已被接受、已过期，或代码不匹配。`);
    }

    if (options.json) {
        printJson({ updated: rows.length, invites: rows });
        return;
    }

    printTable([
        { key: 'invite_code', label: '家庭邀请码' },
        { key: 'status', label: '状态' },
        { key: 'role', label: '角色' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'expires_at', label: '过期时间' },
    ], rows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        role: row.role,
        household_id: row.household_id,
        expires_at: formatDate(row.expires_at),
    })));
}

function buildInFilter(values) {
    return `in.(${values.join(',')})`;
}

async function fetchAccountsByIds(config, accountIds) {
    const uniqueIds = [...new Set((accountIds || []).filter(Boolean))];
    if (!uniqueIds.length) {
        return new Map();
    }

    const { data } = await requestJson(config, 'GET', 'accounts', {
        searchParams: {
            select: 'id,email,parent_name,created_at',
            id: buildInFilter(uniqueIds),
        },
    });
    const rows = Array.isArray(data) ? data : [];
    return new Map(rows.map((row) => [row.id, row]));
}

async function fetchProfilesByIds(config, childIds) {
    const uniqueIds = [...new Set((childIds || []).filter(Boolean))];
    if (!uniqueIds.length) {
        return new Map();
    }

    const { data } = await requestJson(config, 'GET', 'child_profiles', {
        searchParams: {
            select: 'id,household_id,display_name,emoji,friend_code,home_visibility,visit_access,pk_access,last_synced_at',
            id: buildInFilter(uniqueIds),
        },
    });
    const rows = Array.isArray(data) ? data : [];
    return new Map(rows.map((row) => [row.id, row]));
}

async function inspectHousehold(config, options) {
    const householdId = requireOption(options, 'household', '--household');
    const activityLimit = Math.max(1, asInt(options['activity-limit'], 10));
    const inviteLimit = Math.max(1, asInt(options['invite-limit'], 10));

    const [{ data: households }, { data: members }, { data: children }, { data: invites }, { data: activity }] = await Promise.all([
        requestJson(config, 'GET', 'households', {
            searchParams: {
                select: 'id,name,owner_account_id,created_at',
                id: `eq.${householdId}`,
            },
        }),
        requestJson(config, 'GET', 'household_members', {
            searchParams: {
                select: 'household_id,account_id,role,status,created_at',
                household_id: `eq.${householdId}`,
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'child_profiles', {
            searchParams: {
                select: 'id,local_profile_id,display_name,emoji,status,friend_code,home_visibility,visit_access,pk_access,last_synced_at,created_at',
                household_id: `eq.${householdId}`,
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'household_invites', {
            searchParams: {
                select: 'invite_code,status,role,created_at,expires_at,claimed_at,invited_by_account_id,claimed_by_account_id',
                household_id: `eq.${householdId}`,
                order: 'created_at.desc',
                limit: inviteLimit,
            },
        }),
        requestJson(config, 'GET', 'activity_feed', {
            searchParams: {
                select: 'event_type,summary,child_id,created_at',
                household_id: `eq.${householdId}`,
                order: 'created_at.desc',
                limit: activityLimit,
            },
        }),
    ]);

    const household = Array.isArray(households) ? households[0] : null;
    if (!household) {
        throw new Error(`没有找到家庭 ${householdId}`);
    }

    const memberRows = Array.isArray(members) ? members : [];
    const childRows = Array.isArray(children) ? children : [];
    const inviteRows = Array.isArray(invites) ? invites : [];
    const activityRows = Array.isArray(activity) ? activity : [];

    const accountsById = await fetchAccountsByIds(config, memberRows.map((row) => row.account_id));
    const summary = {
        householdId,
        householdName: household.name,
        ownerAccountId: household.owner_account_id,
        memberCount: memberRows.length,
        activeMemberCount: memberRows.filter((row) => row.status === 'active').length,
        childCount: childRows.length,
        pendingInviteCount: inviteRows.filter((row) => row.status === 'pending').length,
        recentActivityCount: activityRows.length,
    };

    if (options.json) {
        printJson({
            summary,
            household,
            members: memberRows,
            accounts: Object.fromEntries(accountsById),
            children: childRows,
            recentInvites: inviteRows,
            recentActivity: activityRows,
        });
        return;
    }

    printSection('家庭摘要');
    printTable([
        { key: 'householdId', label: '家庭ID' },
        { key: 'householdName', label: '家庭名' },
        { key: 'memberCount', label: '成员数' },
        { key: 'childCount', label: '孩子数' },
        { key: 'pendingInviteCount', label: '待处理邀请码' },
        { key: 'recentActivityCount', label: '最近活动条数' },
    ], [summary]);

    printSection('家庭成员');
    printTable([
        { key: 'account_id', label: '账号ID' },
        { key: 'parent_name', label: '家长名' },
        { key: 'email', label: '邮箱' },
        { key: 'role', label: '角色' },
        { key: 'status', label: '状态' },
    ], memberRows.map((row) => {
        const account = accountsById.get(row.account_id) || {};
        return {
            account_id: row.account_id,
            parent_name: account.parent_name || '-',
            email: account.email || '-',
            role: row.role,
            status: row.status,
        };
    }));

    printSection('孩子档案');
    printTable([
        { key: 'id', label: '孩子ID' },
        { key: 'display_name', label: '名字' },
        { key: 'local_profile_id', label: '本地档案ID' },
        { key: 'friend_code', label: '好友码' },
        { key: 'home_visibility', label: '小屋可见性' },
        { key: 'visit_access', label: '串门权限' },
        { key: 'pk_access', label: 'PK权限' },
        { key: 'last_synced_at', label: '最近同步' },
    ], childRows.map((row) => ({
        id: row.id,
        display_name: `${row.emoji || ''}${row.display_name}`,
        local_profile_id: row.local_profile_id || '-',
        friend_code: row.friend_code || '-',
        home_visibility: row.home_visibility,
        visit_access: row.visit_access,
        pk_access: row.pk_access,
        last_synced_at: formatDate(row.last_synced_at),
    })));

    printSection('最近家庭邀请码');
    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'status', label: '状态' },
        { key: 'role', label: '角色' },
        { key: 'expires_at', label: '过期时间' },
        { key: 'claimed_at', label: '领取时间' },
    ], inviteRows.map((row) => ({
        invite_code: row.invite_code,
        status: row.status,
        role: row.role,
        expires_at: formatDate(row.expires_at),
        claimed_at: formatDate(row.claimed_at),
    })));

    printSection('最近活动流');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'event_type', label: '事件' },
        { key: 'child_id', label: '孩子ID' },
        { key: 'summary', label: '摘要' },
    ], activityRows.map((row) => ({
        created_at: formatDate(row.created_at),
        event_type: row.event_type,
        child_id: row.child_id || '-',
        summary: row.summary || '-',
    })));
}

async function inspectChild(config, options) {
    const childId = requireOption(options, 'child', '--child');
    const activityLimit = Math.max(1, asInt(options['activity-limit'], 10));

    const [{ data: profiles }, { data: snapshots }, { data: outgoingFriendships }, { data: incomingFriendships }, { data: activity }, { data: outgoingPk }, { data: incomingPk }] = await Promise.all([
        requestJson(config, 'GET', 'child_profiles', {
            searchParams: {
                select: 'id,household_id,local_profile_id,display_name,emoji,status,friend_code,home_visibility,visit_access,pk_access,last_synced_at,created_at,updated_at',
                id: `eq.${childId}`,
            },
        }),
        requestJson(config, 'GET', 'pet_state_snapshots', {
            searchParams: {
                select: 'id,child_id,pet_species_id,pet_name,source,created_at,payload_json',
                child_id: `eq.${childId}`,
                order: 'created_at.desc',
                limit: 1,
            },
        }),
        requestJson(config, 'GET', 'child_friendships', {
            searchParams: {
                select: 'child_id,friend_child_id,status,source,created_at',
                child_id: `eq.${childId}`,
            },
        }),
        requestJson(config, 'GET', 'child_friendships', {
            searchParams: {
                select: 'child_id,friend_child_id,status,source,created_at',
                friend_child_id: `eq.${childId}`,
            },
        }),
        requestJson(config, 'GET', 'activity_feed', {
            searchParams: {
                select: 'event_type,summary,created_at,payload_json',
                child_id: `eq.${childId}`,
                order: 'created_at.desc',
                limit: activityLimit,
            },
        }),
        requestJson(config, 'GET', 'pk_matches', {
            searchParams: {
                select: 'id,game_type,status,difficulty,opponent_child_id,created_at,expires_at',
                challenger_child_id: `eq.${childId}`,
                order: 'created_at.desc',
                limit: 10,
            },
        }),
        requestJson(config, 'GET', 'pk_matches', {
            searchParams: {
                select: 'id,game_type,status,difficulty,challenger_child_id,created_at,expires_at',
                opponent_child_id: `eq.${childId}`,
                order: 'created_at.desc',
                limit: 10,
            },
        }),
    ]);

    const child = Array.isArray(profiles) ? profiles[0] : null;
    if (!child) {
        throw new Error(`没有找到孩子 ${childId}`);
    }

    const latestSnapshot = Array.isArray(snapshots) ? snapshots[0] : null;
    const outgoingRows = Array.isArray(outgoingFriendships) ? outgoingFriendships : [];
    const incomingRows = Array.isArray(incomingFriendships) ? incomingFriendships : [];
    const friendIds = [
        ...outgoingRows.map((row) => row.friend_child_id),
        ...incomingRows.map((row) => row.child_id),
    ];
    const profilesById = await fetchProfilesByIds(config, friendIds);
    const householdRows = await requestJson(config, 'GET', 'households', {
        searchParams: {
            select: 'id,name,owner_account_id,created_at',
            id: `eq.${child.household_id}`,
        },
    });
    const household = Array.isArray(householdRows.data) ? householdRows.data[0] : null;

    const friendshipRows = [...outgoingRows, ...incomingRows].map((row) => {
        const relatedChildId = row.child_id === childId ? row.friend_child_id : row.child_id;
        const relatedProfile = profilesById.get(relatedChildId) || {};
        return {
            related_child_id: relatedChildId,
            display_name: relatedProfile.display_name ? `${relatedProfile.emoji || ''}${relatedProfile.display_name}` : '-',
            household_id: relatedProfile.household_id || '-',
            friend_code: relatedProfile.friend_code || '-',
            status: row.status,
            source: row.source,
            created_at: formatDate(row.created_at),
        };
    });

    const outgoingPkRows = Array.isArray(outgoingPk) ? outgoingPk : [];
    const incomingPkRows = Array.isArray(incomingPk) ? incomingPk : [];
    const summary = {
        childId,
        displayName: `${child.emoji || ''}${child.display_name}`,
        householdId: child.household_id,
        householdName: household?.name || '-',
        friendCount: new Set(friendshipRows.map((row) => row.related_child_id)).size,
        pendingPkCount: [...outgoingPkRows, ...incomingPkRows].filter((row) => row.status === 'pending' || row.status === 'active').length,
        recentActivityCount: Array.isArray(activity) ? activity.length : 0,
        home_visibility: child.home_visibility,
        visit_access: child.visit_access,
        pk_access: child.pk_access,
    };

    if (options.json) {
        printJson({
            summary,
            child,
            household,
            latestSnapshot,
            friendships: friendshipRows,
            outgoingPk: outgoingPkRows,
            incomingPk: incomingPkRows,
            recentActivity: Array.isArray(activity) ? activity : [],
        });
        return;
    }

    printSection('孩子摘要');
    printTable([
        { key: 'childId', label: '孩子ID' },
        { key: 'displayName', label: '名字' },
        { key: 'householdId', label: '家庭ID' },
        { key: 'householdName', label: '家庭名' },
        { key: 'friendCount', label: '好友数' },
        { key: 'pendingPkCount', label: '待处理PK' },
        { key: 'recentActivityCount', label: '最近活动条数' },
    ], [summary]);

    printSection('权限与同步');
    printTable([
        { key: 'local_profile_id', label: '本地档案ID' },
        { key: 'friend_code', label: '好友码' },
        { key: 'home_visibility', label: '小屋可见性' },
        { key: 'visit_access', label: '串门权限' },
        { key: 'pk_access', label: 'PK权限' },
        { key: 'last_synced_at', label: '最近同步' },
    ], [{
        local_profile_id: child.local_profile_id || '-',
        friend_code: child.friend_code || '-',
        home_visibility: child.home_visibility,
        visit_access: child.visit_access,
        pk_access: child.pk_access,
        last_synced_at: formatDate(child.last_synced_at),
    }]);

    printSection('最近宠物快照');
    printTable([
        { key: 'pet_species_id', label: '宠物品类' },
        { key: 'pet_name', label: '宠物名' },
        { key: 'source', label: '来源' },
        { key: 'created_at', label: '写入时间' },
    ], latestSnapshot ? [{
        pet_species_id: latestSnapshot.pet_species_id || '-',
        pet_name: latestSnapshot.pet_name || '-',
        source: latestSnapshot.source,
        created_at: formatDate(latestSnapshot.created_at),
    }] : []);

    printSection('好友关系');
    printTable([
        { key: 'related_child_id', label: '对方孩子ID' },
        { key: 'display_name', label: '对方名字' },
        { key: 'household_id', label: '对方家庭ID' },
        { key: 'friend_code', label: '对方好友码' },
        { key: 'status', label: '状态' },
        { key: 'source', label: '来源' },
    ], friendshipRows);

    printSection('最近活动流');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'event_type', label: '事件' },
        { key: 'summary', label: '摘要' },
    ], (Array.isArray(activity) ? activity : []).map((row) => ({
        created_at: formatDate(row.created_at),
        event_type: row.event_type,
        summary: row.summary || '-',
    })));
}

async function fetchPkInspectRawData(config, options) {
    const matchId = requireOption(options, 'match', '--match');
    const activityLimit = Math.max(1, asInt(options['activity-limit'], 10));
    const matchResult = await requestJson(config, 'GET', 'pk_matches', {
        searchParams: {
            select: 'id,game_type,question_set_id,challenger_child_id,opponent_child_id,status,difficulty,expires_at,created_at',
            id: `eq.${matchId}`,
            limit: 1,
        },
    });
    const matchRows = ensureArray(matchResult.data);
    const match = matchRows[0] || null;
    if (!match) {
        throw new Error(`没有找到 PK ${matchId}`);
    }

    const [questionSetResult, attemptResult, activityResult] = await Promise.all([
        requestJson(config, 'GET', 'pk_question_sets', {
            searchParams: {
                select: 'id,game_type,difficulty,created_at,payload_json',
                id: `eq.${match.question_set_id}`,
                limit: 1,
            },
        }),
        requestJson(config, 'GET', 'pk_match_attempts', {
            searchParams: {
                select: 'id,match_id,child_id,score,correct_count,duration_ms,payload_json,completed_at',
                match_id: `eq.${matchId}`,
                order: 'completed_at.asc',
            },
        }),
        requestJson(config, 'GET', 'activity_feed', {
            searchParams: {
                select: 'event_type,summary,created_at,payload_json,child_id,household_id',
                child_id: buildInFilter([match.challenger_child_id, match.opponent_child_id]),
                event_type: 'in.(pk_match_issued,pk_match_submitted,pk_match_completed)',
                order: 'created_at.desc',
                limit: activityLimit * 4,
            },
        }),
    ]);

    const profilesById = await fetchProfilesByIds(config, [match.challenger_child_id, match.opponent_child_id]);

    return {
        match,
        questionSet: ensureArray(questionSetResult.data)[0] || null,
        children: [profilesById.get(match.challenger_child_id), profilesById.get(match.opponent_child_id)].filter(Boolean),
        attempts: ensureArray(attemptResult.data),
        activityFeed: normalizePkActivityRows(ensureArray(activityResult.data), matchId).slice(0, activityLimit),
    };
}

async function collectPkInspectData(config, options) {
    const generatedAt = new Date().toISOString();
    const jsonInput = options['json-input'];
    if (jsonInput) {
        const input = readJsonInputFile(jsonInput);
        return buildPkInspectData(input.data, {
            generatedAt,
            source: 'json-input',
            sourceFile: input.filePath,
        });
    }

    const liveConfig = config || resolveConfig(options);
    const rawData = await fetchPkInspectRawData(liveConfig, options);
    return buildPkInspectData(rawData, {
        generatedAt,
        source: 'live-supabase',
    });
}

function printPkInspectReport(data) {
    printSection('PK摘要');
    printTable([
        { key: 'matchId', label: 'PKID' },
        { key: 'gameLabel', label: '类型' },
        { key: 'status', label: '状态' },
        { key: 'questionSetId', label: '题组ID' },
        { key: 'questionCount', label: '题目数' },
        { key: 'challengerName', label: '发起方' },
        { key: 'opponentName', label: '应战方' },
        { key: 'winnerName', label: '胜方' },
        { key: 'winnerReasonLabel', label: '判定依据' },
    ], [{
        matchId: data.summary.matchId,
        gameLabel: data.summary.gameLabel,
        status: data.summary.status || '-',
        questionSetId: data.summary.questionSetId,
        questionCount: data.summary.questionCount,
        challengerName: data.summary.challengerName || data.summary.challengerChildId,
        opponentName: data.summary.opponentName || data.summary.opponentChildId,
        winnerName: data.summary.winnerName || (data.summary.winnerChildId ? data.summary.winnerChildId : '待完成'),
        winnerReasonLabel: data.summary.winnerReasonLabel,
    }]);

    printSection('题组摘要');
    printTable([
        { key: 'summaryText', label: '摘要' },
        { key: 'levelLabel', label: '等级' },
        { key: 'modeLabel', label: '题型' },
        { key: 'difficultyLabel', label: '难度' },
        { key: 'createdAt', label: '题组生成时间' },
        { key: 'preview', label: '题目预览' },
    ], [{
        summaryText: data.questionSet.summaryText,
        levelLabel: data.questionSet.levelLabel || '-',
        modeLabel: data.questionSet.modeLabel || '-',
        difficultyLabel: data.questionSet.difficultyLabel || '-',
        createdAt: formatDate(data.questionSet.createdAt),
        preview: data.questionSet.preview && data.questionSet.preview.length ? data.questionSet.preview.join(' / ') : '-',
    }]);

    printSection('双方作答');
    printTable([
        { key: 'role', label: '角色' },
        { key: 'child_id', label: '孩子ID' },
        { key: 'display_name', label: '名字' },
        { key: 'score', label: '分数' },
        { key: 'correctCount', label: '答对题数' },
        { key: 'duration', label: '用时' },
        { key: 'completedAt', label: '提交时间' },
    ], [
        {
            role: '发起方',
            child_id: data.challenger.child.id || data.summary.challengerChildId,
            display_name: `${data.challenger.child.emoji || ''}${data.challenger.child.display_name || '-'}`,
            score: data.challenger.attempt ? data.challenger.attempt.score : '-',
            correctCount: data.challenger.attempt ? data.challenger.attempt.correctCount : '-',
            duration: data.challenger.attempt ? formatDurationCompact(data.challenger.attempt.durationMs) : '-',
            completedAt: data.challenger.attempt ? formatDate(data.challenger.attempt.completedAt) : '-',
        },
        {
            role: '应战方',
            child_id: data.opponent.child.id || data.summary.opponentChildId,
            display_name: `${data.opponent.child.emoji || ''}${data.opponent.child.display_name || '-'}`,
            score: data.opponent.attempt ? data.opponent.attempt.score : '-',
            correctCount: data.opponent.attempt ? data.opponent.attempt.correctCount : '-',
            duration: data.opponent.attempt ? formatDurationCompact(data.opponent.attempt.durationMs) : '-',
            completedAt: data.opponent.attempt ? formatDate(data.opponent.attempt.completedAt) : '-',
        },
    ]);

    printSection('最近相关动态流');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'event_type', label: '事件' },
        { key: 'summary', label: '摘要' },
    ], ensureArray(data.recentActivity).map((row) => ({
        created_at: formatDate(row.created_at || row.createdAt),
        event_type: row.event_type || row.eventType || '-',
        summary: row.summary || '-',
    })));
}

async function inspectPk(config, options) {
    const data = await collectPkInspectData(config, options);
    if (options.json) {
        printJson(data);
        return data;
    }

    printPkInspectReport(data);
    return data;
}

async function fetchPairInspectRawData(config, options) {
    const childAId = requireOption(options, 'child-a', '--child-a');
    const childBId = requireOption(options, 'child-b', '--child-b');
    const visitLimit = Math.max(1, asInt(options['visit-limit'], 10));
    const pkLimit = Math.max(1, asInt(options['pk-limit'], 10));
    const activityLimit = Math.max(1, asInt(options['activity-limit'], 10));
    const pairFilter = buildInFilter([childAId, childBId]);

    const [profilesById, friendshipsResult, visitsResult, pkMatchesResult, activityResult] = await Promise.all([
        fetchProfilesByIds(config, [childAId, childBId]),
        requestJson(config, 'GET', 'child_friendships', {
            searchParams: {
                select: 'child_id,friend_child_id,status,source,created_at',
                child_id: pairFilter,
                friend_child_id: pairFilter,
            },
        }),
        requestJson(config, 'GET', 'house_visits', {
            searchParams: {
                select: 'id,from_child_id,to_child_id,action_type,message,metadata_json,created_at',
                from_child_id: pairFilter,
                to_child_id: pairFilter,
                order: 'created_at.desc',
                limit: visitLimit * 2,
            },
        }),
        requestJson(config, 'GET', 'pk_matches', {
            searchParams: {
                select: 'id,game_type,question_set_id,challenger_child_id,opponent_child_id,status,difficulty,created_at,expires_at',
                challenger_child_id: pairFilter,
                opponent_child_id: pairFilter,
                order: 'created_at.desc',
                limit: pkLimit * 2,
            },
        }),
        requestJson(config, 'GET', 'activity_feed', {
            searchParams: {
                select: 'event_type,summary,created_at,payload_json,child_id,household_id',
                child_id: pairFilter,
                event_type: 'in.(friendship,house_visit,pk_match_issued,pk_match_submitted,pk_match_completed)',
                order: 'created_at.desc',
                limit: activityLimit * 6,
            },
        }),
    ]);

    const childA = profilesById.get(childAId);
    const childB = profilesById.get(childBId);
    if (!childA || !childB) {
        throw new Error(`没有找到孩子组合 ${childAId} / ${childBId}`);
    }

    return {
        children: [childA, childB],
        childA,
        childB,
        friendships: ensureArray(friendshipsResult.data),
        visits: normalizePairVisits(ensureArray(visitsResult.data), childAId, childBId).slice(0, visitLimit),
        pkMatches: normalizePairPkMatches(ensureArray(pkMatchesResult.data), childAId, childBId).slice(0, pkLimit),
        activityFeed: normalizePairActivityRows(ensureArray(activityResult.data), childAId, childBId).slice(0, activityLimit),
    };
}

async function collectPairInspectData(config, options) {
    const generatedAt = new Date().toISOString();
    const jsonInput = options['json-input'];
    if (jsonInput) {
        const input = readJsonInputFile(jsonInput);
        return buildPairInspectData(input.data, {
            generatedAt,
            source: 'json-input',
            sourceFile: input.filePath,
        });
    }

    const liveConfig = config || resolveConfig(options);
    const rawData = await fetchPairInspectRawData(liveConfig, options);
    return buildPairInspectData(rawData, {
        generatedAt,
        source: 'live-supabase',
    });
}

function printPairInspectReport(data) {
    printSection('关系摘要');
    printTable([
        { key: 'childAName', label: '孩子A' },
        { key: 'childBName', label: '孩子B' },
        { key: 'sameHouseholdLabel', label: '同家庭' },
        { key: 'friendshipStateLabel', label: '好友关系' },
        { key: 'visitCount', label: '最近串门数' },
        { key: 'pkMatchCount', label: '最近PK数' },
        { key: 'activityCount', label: '相关动态数' },
    ], [{
        childAName: `${data.childA.emoji || ''}${data.summary.childAName || data.summary.childAId}`,
        childBName: `${data.childB.emoji || ''}${data.summary.childBName || data.summary.childBId}`,
        sameHouseholdLabel: data.summary.sameHousehold ? 'YES' : 'NO',
        friendshipStateLabel: data.summary.friendshipStateLabel,
        visitCount: data.summary.visitCount,
        pkMatchCount: data.summary.pkMatchCount,
        activityCount: data.summary.activityCount,
    }]);

    printSection('A -> B');
    printTable([
        { key: 'canViewSocialProfile', label: '可看社交资料' },
        { key: 'canViewHouse', label: '可看小屋' },
        { key: 'canVisit', label: '可串门' },
        { key: 'canChallenge', label: '可发PK' },
        { key: 'socialReason', label: '社交资料原因' },
        { key: 'houseReason', label: '小屋原因' },
        { key: 'visitReason', label: '串门原因' },
        { key: 'challengeReason', label: 'PK原因' },
    ], [{
        canViewSocialProfile: formatBoolean(data.aToB.canViewSocialProfile, 'YES', 'NO'),
        canViewHouse: formatBoolean(data.aToB.canViewHouse, 'YES', 'NO'),
        canVisit: formatBoolean(data.aToB.canVisit, 'YES', 'NO'),
        canChallenge: formatBoolean(data.aToB.canChallenge, 'YES', 'NO'),
        socialReason: data.aToB.socialReason,
        houseReason: data.aToB.houseReason,
        visitReason: data.aToB.visitReason,
        challengeReason: data.aToB.challengeReason,
    }]);

    printSection('B -> A');
    printTable([
        { key: 'canViewSocialProfile', label: '可看社交资料' },
        { key: 'canViewHouse', label: '可看小屋' },
        { key: 'canVisit', label: '可串门' },
        { key: 'canChallenge', label: '可发PK' },
        { key: 'socialReason', label: '社交资料原因' },
        { key: 'houseReason', label: '小屋原因' },
        { key: 'visitReason', label: '串门原因' },
        { key: 'challengeReason', label: 'PK原因' },
    ], [{
        canViewSocialProfile: formatBoolean(data.bToA.canViewSocialProfile, 'YES', 'NO'),
        canViewHouse: formatBoolean(data.bToA.canViewHouse, 'YES', 'NO'),
        canVisit: formatBoolean(data.bToA.canVisit, 'YES', 'NO'),
        canChallenge: formatBoolean(data.bToA.canChallenge, 'YES', 'NO'),
        socialReason: data.bToA.socialReason,
        houseReason: data.bToA.houseReason,
        visitReason: data.bToA.visitReason,
        challengeReason: data.bToA.challengeReason,
    }]);

    printSection('最近串门');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'from_child_id', label: '发起孩子' },
        { key: 'to_child_id', label: '目标孩子' },
        { key: 'action_type', label: '动作' },
        { key: 'message', label: '留言' },
    ], ensureArray(data.recentVisits).map((row) => ({
        created_at: formatDate(row.created_at || row.createdAt),
        from_child_id: row.from_child_id || row.fromChildId,
        to_child_id: row.to_child_id || row.toChildId,
        action_type: row.action_type || row.actionType || '-',
        message: row.message || '-',
    })));

    printSection('最近PK');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'id', label: 'PKID' },
        { key: 'game_type', label: '类型' },
        { key: 'status', label: '状态' },
        { key: 'challenger_child_id', label: '发起孩子' },
        { key: 'opponent_child_id', label: '应战孩子' },
    ], ensureArray(data.recentPkMatches).map((row) => ({
        created_at: formatDate(row.created_at || row.createdAt),
        id: row.id,
        game_type: row.game_type || row.gameType || '-',
        status: row.status || '-',
        challenger_child_id: row.challenger_child_id || row.challengerChildId,
        opponent_child_id: row.opponent_child_id || row.opponentChildId,
    })));

    printSection('相关动态流');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'event_type', label: '事件' },
        { key: 'summary', label: '摘要' },
    ], ensureArray(data.recentActivity).map((row) => ({
        created_at: formatDate(row.created_at || row.createdAt),
        event_type: row.event_type || row.eventType || '-',
        summary: row.summary || '-',
    })));
}

async function inspectChildPair(config, options) {
    const data = await collectPairInspectData(config, options);
    if (options.json) {
        printJson(data);
        return data;
    }

    printPairInspectReport(data);
    return data;
}

async function compareDiagnosticsSnapshots(_config, options) {
    const leftInput = readJsonInputFile(requireOption(options, 'left-json', '--left-json'));
    const rightInput = readJsonInputFile(requireOption(options, 'right-json', '--right-json'));
    const data = buildDiagnosticsCompareData(leftInput.data, rightInput.data, {
        generatedAt: new Date().toISOString(),
        leftFile: leftInput.filePath,
        rightFile: rightInput.filePath,
    });

    if (options.json) {
        printJson(data);
        return data;
    }

    printSection('对比摘要');
    printTable([
        { key: 'sameUserId', label: '同账号' },
        { key: 'samePrimaryHouseholdId', label: '同家庭' },
        { key: 'leftCloudChildCount', label: '左侧云端孩子' },
        { key: 'rightCloudChildCount', label: '右侧云端孩子' },
        { key: 'leftLocalProfileCount', label: '左侧本地档案' },
        { key: 'rightLocalProfileCount', label: '右侧本地档案' },
        { key: 'cloudChildrenAligned', label: '云端孩子对齐' },
        { key: 'localProfilesAligned', label: '本地档案对齐' },
        { key: 'sharedChildFieldsAligned', label: '共享孩子字段对齐' },
    ], [{
        sameUserId: formatBoolean(data.summary.sameUserId, 'YES', 'NO'),
        samePrimaryHouseholdId: formatBoolean(data.summary.samePrimaryHouseholdId, 'YES', 'NO'),
        leftCloudChildCount: data.summary.leftCloudChildCount,
        rightCloudChildCount: data.summary.rightCloudChildCount,
        leftLocalProfileCount: data.summary.leftLocalProfileCount,
        rightLocalProfileCount: data.summary.rightLocalProfileCount,
        cloudChildrenAligned: formatBoolean(data.summary.cloudChildrenAligned, 'YES', 'NO'),
        localProfilesAligned: formatBoolean(data.summary.localProfilesAligned, 'YES', 'NO'),
        sharedChildFieldsAligned: formatBoolean(data.summary.sharedChildFieldsAligned, 'YES', 'NO'),
    }]);

    printSection('左侧设备');
    printTable([
        { key: 'deviceLabel', label: '设备标签' },
        { key: 'sourceFile', label: '文件' },
        { key: 'email', label: '家长账号' },
        { key: 'userId', label: 'user_id' },
        { key: 'primaryHouseholdId', label: 'household_id' },
        { key: 'activeProfileId', label: 'active_profile_id' },
        { key: 'activeCloudChildId', label: 'active_cloud_child_id' },
        { key: 'lastHydratedAt', label: '最近恢复' },
    ], [{
        deviceLabel: data.left.device.label || '未设置',
        sourceFile: data.left.sourceFile || '-',
        email: data.left.auth.email || '-',
        userId: data.left.auth.userId || '-',
        primaryHouseholdId: data.left.household.primaryHouseholdId || '-',
        activeProfileId: data.left.profiles.activeProfileId || '-',
        activeCloudChildId: data.left.social.activeCloudChildId || '-',
        lastHydratedAt: formatDate(data.left.restore.lastHydratedAt),
    }]);

    printSection('右侧设备');
    printTable([
        { key: 'deviceLabel', label: '设备标签' },
        { key: 'sourceFile', label: '文件' },
        { key: 'email', label: '家长账号' },
        { key: 'userId', label: 'user_id' },
        { key: 'primaryHouseholdId', label: 'household_id' },
        { key: 'activeProfileId', label: 'active_profile_id' },
        { key: 'activeCloudChildId', label: 'active_cloud_child_id' },
        { key: 'lastHydratedAt', label: '最近恢复' },
    ], [{
        deviceLabel: data.right.device.label || '未设置',
        sourceFile: data.right.sourceFile || '-',
        email: data.right.auth.email || '-',
        userId: data.right.auth.userId || '-',
        primaryHouseholdId: data.right.household.primaryHouseholdId || '-',
        activeProfileId: data.right.profiles.activeProfileId || '-',
        activeCloudChildId: data.right.social.activeCloudChildId || '-',
        lastHydratedAt: formatDate(data.right.restore.lastHydratedAt),
    }]);

    printListOrEmpty('仅左侧设备存在', [
        { key: 'kind', label: '类型' },
        { key: 'value', label: '标识' },
    ], [
        ...data.onlyOnLeft.cloudChildIds.map((childId) => ({ kind: 'cloud_child_id', value: childId })),
        ...data.onlyOnLeft.localProfileIds.map((profileId) => ({ kind: 'local_profile_id', value: profileId })),
    ], '当前没有“仅左侧设备存在”的差异。');

    printListOrEmpty('仅右侧设备存在', [
        { key: 'kind', label: '类型' },
        { key: 'value', label: '标识' },
    ], [
        ...data.onlyOnRight.cloudChildIds.map((childId) => ({ kind: 'cloud_child_id', value: childId })),
        ...data.onlyOnRight.localProfileIds.map((profileId) => ({ kind: 'local_profile_id', value: profileId })),
    ], '当前没有“仅右侧设备存在”的差异。');

    printListOrEmpty('差异说明', [
        { key: 'type', label: '类型' },
        { key: 'summary', label: '说明' },
    ], data.differences.map((row) => ({
        type: row.type,
        summary: row.summary || '-',
    })), '当前没有结构化差异。');

    printListOrEmpty('共享孩子字段差异', [
        { key: 'childId', label: '孩子ID' },
        { key: 'field', label: '字段' },
        { key: 'leftValue', label: '左侧值' },
        { key: 'rightValue', label: '右侧值' },
    ], ensureArray(data.sharedChildFieldDifferences).map((row) => ({
        childId: row.childId,
        field: row.field,
        leftValue: row.leftValue || '(空)',
        rightValue: row.rightValue || '(空)',
    })), '当前没有“共享孩子字段不一致”差异。');

    return data;
}

async function collectPilotOverviewData(config, options) {
    const recentDays = Math.max(1, asInt(options['recent-days'], 7));
    const recentSince = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();
    const alertDays = Math.max(1, Math.min(recentDays, 7));

    const [
        accountCount,
        householdCount,
        childCount,
        syncedRecentlyCount,
        registrationPendingCount,
        registrationClaimedCount,
        registrationRevokedCount,
        householdInvitePendingCount,
        householdInviteAcceptedCount,
        householdInviteRevokedCount,
        friendshipActiveCount,
        visitsRecentCount,
        activityRecentCount,
        mathPendingCount,
        mathCompletedCount,
        hanziPendingCount,
        hanziCompletedCount,
        pendingRegistrationInvitesResult,
        pendingHouseholdInvitesResult,
        latestHouseholdsResult,
        latestActivityResult,
        allAccountsResult,
        allHouseholdsResult,
        allHouseholdMembersResult,
        allChildrenResult,
        allSnapshotsResult,
        pendingPkMatchesResult,
    ] = await Promise.all([
        requestCount(config, 'accounts', { selectField: 'id' }),
        requestCount(config, 'households', { selectField: 'id' }),
        requestCount(config, 'child_profiles', { selectField: 'id' }),
        requestCount(config, 'child_profiles', {
            selectField: 'id',
            searchParams: { last_synced_at: `gte.${recentSince}` },
        }),
        requestCount(config, 'registration_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.pending' },
        }),
        requestCount(config, 'registration_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.claimed' },
        }),
        requestCount(config, 'registration_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.revoked' },
        }),
        requestCount(config, 'household_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.pending' },
        }),
        requestCount(config, 'household_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.accepted' },
        }),
        requestCount(config, 'household_invites', {
            selectField: 'id',
            searchParams: { status: 'eq.revoked' },
        }),
        requestCount(config, 'child_friendships', {
            selectField: 'child_id',
            searchParams: { status: 'eq.active' },
        }),
        requestCount(config, 'house_visits', {
            selectField: 'id',
            searchParams: { created_at: `gte.${recentSince}` },
        }),
        requestCount(config, 'activity_feed', {
            selectField: 'id',
            searchParams: { created_at: `gte.${recentSince}` },
        }),
        requestCount(config, 'pk_matches', {
            selectField: 'id',
            searchParams: {
                game_type: 'eq.mathpk',
                or: '(status.eq.pending,status.eq.active)',
            },
        }),
        requestCount(config, 'pk_matches', {
            selectField: 'id',
            searchParams: {
                game_type: 'eq.mathpk',
                status: 'eq.completed',
            },
        }),
        requestCount(config, 'pk_matches', {
            selectField: 'id',
            searchParams: {
                game_type: 'eq.hanzi',
                or: '(status.eq.pending,status.eq.active)',
            },
        }),
        requestCount(config, 'pk_matches', {
            selectField: 'id',
            searchParams: {
                game_type: 'eq.hanzi',
                status: 'eq.completed',
            },
        }),
        requestJson(config, 'GET', 'registration_invites', {
            searchParams: {
                select: 'invite_code,label,status,expires_at,created_at',
                status: 'eq.pending',
                order: 'created_at.desc',
                limit: 10,
            },
        }),
        requestJson(config, 'GET', 'household_invites', {
            searchParams: {
                select: 'invite_code,household_id,status,role,expires_at,created_at',
                status: 'eq.pending',
                order: 'created_at.desc',
                limit: 10,
            },
        }),
        requestJson(config, 'GET', 'households', {
            searchParams: {
                select: 'id,name,owner_account_id,created_at',
                order: 'created_at.desc',
                limit: 10,
            },
        }),
        requestJson(config, 'GET', 'activity_feed', {
            searchParams: {
                select: 'household_id,child_id,event_type,summary,created_at',
                order: 'created_at.desc',
                limit: 10,
            },
        }),
        requestJson(config, 'GET', 'accounts', {
            searchParams: {
                select: 'id,email,parent_name,created_at',
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'households', {
            searchParams: {
                select: 'id,name,owner_account_id,created_at',
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'household_members', {
            searchParams: {
                select: 'household_id,account_id,role,status,created_at',
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'child_profiles', {
            searchParams: {
                select: 'id,household_id,local_profile_id,display_name,emoji,status,friend_code,last_synced_at,created_at',
                order: 'created_at.asc',
            },
        }),
        requestJson(config, 'GET', 'pet_state_snapshots', {
            searchParams: {
                select: 'child_id,created_at,source',
                order: 'created_at.desc',
            },
        }),
        requestJson(config, 'GET', 'pk_matches', {
            searchParams: {
                select: 'id,game_type,status,difficulty,challenger_child_id,opponent_child_id,created_at,expires_at',
                or: '(status.eq.pending,status.eq.active)',
                order: 'created_at.asc',
            },
        }),
    ]);

    const summary = {
        generatedAt: new Date().toISOString(),
        recentDays,
        recentSince,
        accountCount,
        householdCount,
        childCount,
        syncedRecentlyCount,
        registrationPendingCount,
        registrationClaimedCount,
        registrationRevokedCount,
        householdInvitePendingCount,
        householdInviteAcceptedCount,
        householdInviteRevokedCount,
        friendshipActiveCount,
        visitsRecentCount,
        activityRecentCount,
        mathPendingCount,
        mathCompletedCount,
        hanziPendingCount,
        hanziCompletedCount,
    };

    const pendingRegistrationInvites = Array.isArray(pendingRegistrationInvitesResult.data)
        ? pendingRegistrationInvitesResult.data
        : [];
    const pendingHouseholdInvites = Array.isArray(pendingHouseholdInvitesResult.data)
        ? pendingHouseholdInvitesResult.data
        : [];
    const latestHouseholds = Array.isArray(latestHouseholdsResult.data)
        ? latestHouseholdsResult.data
        : [];
    const latestActivity = Array.isArray(latestActivityResult.data)
        ? latestActivityResult.data
        : [];
    const allAccounts = Array.isArray(allAccountsResult.data)
        ? allAccountsResult.data
        : [];
    const allHouseholds = Array.isArray(allHouseholdsResult.data)
        ? allHouseholdsResult.data
        : [];
    const allHouseholdMembers = Array.isArray(allHouseholdMembersResult.data)
        ? allHouseholdMembersResult.data
        : [];
    const allChildren = Array.isArray(allChildrenResult.data)
        ? allChildrenResult.data
        : [];
    const allSnapshots = Array.isArray(allSnapshotsResult.data)
        ? allSnapshotsResult.data
        : [];
    const pendingPkMatches = Array.isArray(pendingPkMatchesResult.data)
        ? pendingPkMatchesResult.data
        : [];

    const childHouseholdIds = new Set(allChildren.map((row) => row.household_id).filter(Boolean));
    const snapshotChildIds = new Set(allSnapshots.map((row) => row.child_id).filter(Boolean));
    const memberAccountIds = new Set(
        allHouseholdMembers
            .filter((row) => row.status === 'active')
            .map((row) => row.account_id)
            .filter(Boolean)
    );

    const householdsWithoutChildren = allHouseholds.filter((row) => !childHouseholdIds.has(row.id));
    const accountsWithoutHousehold = allAccounts.filter((row) => !memberAccountIds.has(row.id));
    const childrenNeverSynced = allChildren.filter((row) => !row.last_synced_at);
    const childrenStaleSync = allChildren.filter((row) => row.last_synced_at && row.last_synced_at < recentSince);
    const childrenWithoutSnapshots = allChildren.filter((row) => !snapshotChildIds.has(row.id));
    const registrationInvitesExpiringSoon = pendingRegistrationInvites.filter((row) => isExpiringSoon(row.expires_at, alertDays));
    const householdInvitesExpiringSoon = pendingHouseholdInvites.filter((row) => isExpiringSoon(row.expires_at, alertDays));
    const stalePkMatches = pendingPkMatches.filter((row) => row.created_at && row.created_at < recentSince);

    const alerts = {
        alertDays,
        householdsWithoutChildren,
        accountsWithoutHousehold,
        childrenNeverSynced,
        childrenStaleSync,
        childrenWithoutSnapshots,
        registrationInvitesExpiringSoon,
        householdInvitesExpiringSoon,
        stalePkMatches,
    };

    summary.alertCount =
        householdsWithoutChildren.length +
        accountsWithoutHousehold.length +
        childrenNeverSynced.length +
        childrenStaleSync.length +
        childrenWithoutSnapshots.length +
        registrationInvitesExpiringSoon.length +
        householdInvitesExpiringSoon.length +
        stalePkMatches.length;
    summary.householdsWithoutChildrenCount = householdsWithoutChildren.length;
    summary.accountsWithoutHouseholdCount = accountsWithoutHousehold.length;
    summary.childrenNeverSyncedCount = childrenNeverSynced.length;
    summary.childrenStaleSyncCount = childrenStaleSync.length;
    summary.childrenWithoutSnapshotsCount = childrenWithoutSnapshots.length;
    summary.registrationInvitesExpiringSoonCount = registrationInvitesExpiringSoon.length;
    summary.householdInvitesExpiringSoonCount = householdInvitesExpiringSoon.length;
    summary.stalePkMatchesCount = stalePkMatches.length;

    return {
        summary,
        alerts,
        pendingRegistrationInvites,
        pendingHouseholdInvites,
        latestHouseholds,
        latestActivity,
    };
}

function printPilotOverviewReport(data, options) {
    const summary = data.summary || {};
    const alerts = data.alerts || {};
    const pendingRegistrationInvites = ensureArray(data.pendingRegistrationInvites);
    const pendingHouseholdInvites = ensureArray(data.pendingHouseholdInvites);
    const latestHouseholds = ensureArray(data.latestHouseholds);
    const latestActivity = ensureArray(data.latestActivity);
    const householdsWithoutChildren = ensureArray(alerts.householdsWithoutChildren);
    const accountsWithoutHousehold = ensureArray(alerts.accountsWithoutHousehold);
    const childrenNeverSynced = ensureArray(alerts.childrenNeverSynced);
    const childrenStaleSync = ensureArray(alerts.childrenStaleSync);
    const childrenWithoutSnapshots = ensureArray(alerts.childrenWithoutSnapshots);
    const registrationInvitesExpiringSoon = ensureArray(alerts.registrationInvitesExpiringSoon);
    const householdInvitesExpiringSoon = ensureArray(alerts.householdInvitesExpiringSoon);
    const stalePkMatches = ensureArray(alerts.stalePkMatches);
    const recentDays = summary.recentDays || 7;
    const alertDays = alerts.alertDays || Math.max(1, Math.min(recentDays, 7));

    if (options.json) {
        printJson({
            summary: summary,
            alerts: alerts,
            pendingRegistrationInvites: pendingRegistrationInvites,
            pendingHouseholdInvites: pendingHouseholdInvites,
            latestHouseholds: latestHouseholds,
            latestActivity: latestActivity,
        });
        return;
    }

    printSection('试运行总览');
    printTable([
        { key: 'accountCount', label: '家长账号数' },
        { key: 'householdCount', label: '家庭数' },
        { key: 'childCount', label: '云端孩子数' },
        { key: 'syncedRecentlyCount', label: `近${recentDays}天同步孩子` },
        { key: 'registrationPendingCount', label: '待处理注册邀请码' },
        { key: 'householdInvitePendingCount', label: '待处理家庭邀请码' },
        { key: 'friendshipActiveCount', label: '活跃好友关系行数' },
        { key: 'visitsRecentCount', label: `近${recentDays}天串门数` },
        { key: 'activityRecentCount', label: `近${recentDays}天动态流条数` },
        { key: 'mathPendingCount', label: '数学PK待处理' },
        { key: 'mathCompletedCount', label: '数学PK已完成' },
        { key: 'hanziPendingCount', label: '汉字PK待处理' },
        { key: 'hanziCompletedCount', label: '汉字PK已完成' },
        { key: 'alertCount', label: '异常总数' },
    ], [summary]);

    printSection('异常雷达');
    printTable([
        { key: 'householdsWithoutChildrenCount', label: '空家庭' },
        { key: 'accountsWithoutHouseholdCount', label: '未入家庭账号' },
        { key: 'childrenNeverSyncedCount', label: '从未同步孩子' },
        { key: 'childrenStaleSyncCount', label: `超${recentDays}天未同步孩子` },
        { key: 'childrenWithoutSnapshotsCount', label: '无快照孩子' },
        { key: 'registrationInvitesExpiringSoonCount', label: `近${alertDays}天到期注册码` },
        { key: 'householdInvitesExpiringSoonCount', label: `近${alertDays}天到期家庭码` },
        { key: 'stalePkMatchesCount', label: `超${recentDays}天挂起PK` },
    ], [summary]);

    printSection('注册邀请码状态');
    printTable([
        { key: 'registrationPendingCount', label: '待处理' },
        { key: 'registrationClaimedCount', label: '已认领' },
        { key: 'registrationRevokedCount', label: '已撤销' },
    ], [summary]);

    printSection('家庭邀请码状态');
    printTable([
        { key: 'householdInvitePendingCount', label: '待处理' },
        { key: 'householdInviteAcceptedCount', label: '已接受' },
        { key: 'householdInviteRevokedCount', label: '已撤销' },
    ], [summary]);

    printSection('最近待处理注册邀请码');
    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'label', label: '标签' },
        { key: 'status', label: '状态' },
        { key: 'expires_at', label: '过期时间' },
    ], pendingRegistrationInvites.map((row) => ({
        invite_code: row.invite_code,
        label: row.label || '-',
        status: row.status,
        expires_at: formatDate(row.expires_at),
    })));

    printSection('最近待处理家庭邀请码');
    printTable([
        { key: 'invite_code', label: '邀请码' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'role', label: '角色' },
        { key: 'expires_at', label: '过期时间' },
    ], pendingHouseholdInvites.map((row) => ({
        invite_code: row.invite_code,
        household_id: row.household_id,
        role: row.role,
        expires_at: formatDate(row.expires_at),
    })));

    printSection('最近创建家庭');
    printTable([
        { key: 'created_at', label: '创建时间' },
        { key: 'id', label: '家庭ID' },
        { key: 'name', label: '家庭名' },
        { key: 'owner_account_id', label: '创建者账号ID' },
    ], latestHouseholds.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        name: row.name,
        owner_account_id: row.owner_account_id,
    })));

    printSection('最近动态流');
    printTable([
        { key: 'created_at', label: '时间' },
        { key: 'event_type', label: '事件' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'child_id', label: '孩子ID' },
        { key: 'summary', label: '摘要' },
    ], latestActivity.map((row) => ({
        created_at: formatDate(row.created_at),
        event_type: row.event_type,
        household_id: row.household_id || '-',
        child_id: row.child_id || '-',
        summary: row.summary || '-',
    })));

    printListOrEmpty('异常家庭：没有孩子档案', [
        { key: 'created_at', label: '创建时间' },
        { key: 'id', label: '家庭ID' },
        { key: 'name', label: '家庭名' },
    ], householdsWithoutChildren.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        name: row.name,
    })), '当前没有“空家庭”异常。');

    printListOrEmpty('异常账号：未加入任何家庭', [
        { key: 'created_at', label: '创建时间' },
        { key: 'id', label: '账号ID' },
        { key: 'parent_name', label: '家长名' },
        { key: 'email', label: '邮箱' },
    ], accountsWithoutHousehold.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        parent_name: row.parent_name || '-',
        email: row.email || '-',
    })), '当前没有“未入家庭账号”异常。');

    printListOrEmpty('异常孩子：从未同步', [
        { key: 'created_at', label: '创建时间' },
        { key: 'id', label: '孩子ID' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'display_name', label: '名字' },
    ], childrenNeverSynced.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        household_id: row.household_id,
        display_name: `${row.emoji || ''}${row.display_name}`,
    })), '当前没有“从未同步孩子”异常。');

    printListOrEmpty(`异常孩子：超${recentDays}天未同步`, [
        { key: 'last_synced_at', label: '最近同步' },
        { key: 'id', label: '孩子ID' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'display_name', label: '名字' },
    ], childrenStaleSync.map((row) => ({
        last_synced_at: formatDate(row.last_synced_at),
        id: row.id,
        household_id: row.household_id,
        display_name: `${row.emoji || ''}${row.display_name}`,
    })), `当前没有“超${recentDays}天未同步”异常。`);

    printListOrEmpty('异常孩子：缺少宠物快照', [
        { key: 'created_at', label: '创建时间' },
        { key: 'id', label: '孩子ID' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'display_name', label: '名字' },
    ], childrenWithoutSnapshots.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        household_id: row.household_id,
        display_name: `${row.emoji || ''}${row.display_name}`,
    })), '当前没有“缺少宠物快照”异常。');

    printListOrEmpty(`异常邀请码：近${alertDays}天到期的注册邀请码`, [
        { key: 'invite_code', label: '邀请码' },
        { key: 'label', label: '标签' },
        { key: 'expires_at', label: '过期时间' },
        { key: 'days_left', label: '剩余' },
    ], registrationInvitesExpiringSoon.map((row) => ({
        invite_code: row.invite_code,
        label: row.label || '-',
        expires_at: formatDate(row.expires_at),
        days_left: formatDaysLeft(row.expires_at),
    })), `当前没有“近${alertDays}天到期的注册邀请码”异常。`);

    printListOrEmpty(`异常邀请码：近${alertDays}天到期的家庭邀请码`, [
        { key: 'invite_code', label: '邀请码' },
        { key: 'household_id', label: '家庭ID' },
        { key: 'expires_at', label: '过期时间' },
        { key: 'days_left', label: '剩余' },
    ], householdInvitesExpiringSoon.map((row) => ({
        invite_code: row.invite_code,
        household_id: row.household_id,
        expires_at: formatDate(row.expires_at),
        days_left: formatDaysLeft(row.expires_at),
    })), `当前没有“近${alertDays}天到期的家庭邀请码”异常。`);

    printListOrEmpty(`异常PK：超${recentDays}天仍未完成`, [
        { key: 'created_at', label: '发起时间' },
        { key: 'id', label: 'PKID' },
        { key: 'game_type', label: '类型' },
        { key: 'status', label: '状态' },
        { key: 'challenger_child_id', label: '发起孩子ID' },
        { key: 'opponent_child_id', label: '对手孩子ID' },
    ], stalePkMatches.map((row) => ({
        created_at: formatDate(row.created_at),
        id: row.id,
        game_type: row.game_type,
        status: row.status,
        challenger_child_id: row.challenger_child_id,
        opponent_child_id: row.opponent_child_id,
    })), `当前没有“超${recentDays}天未完成PK”异常。`);
}

async function pilotOverview(config, options) {
    const data = await collectPilotOverviewData(config, options);
    printPilotOverviewReport(data, options);
}

async function pilotDoctor(_config, options) {
    const data = collectPilotDoctorData(options);
    const summary = data.summary;
    const checks = data.checks;

    if (options.json) {
        printJson({
            summary,
            checks,
        });
        if (!summary.ready) {
            process.exitCode = 1;
        }
        return;
    }

    printSection('联调前体检');
    printTable([
        { key: 'date', label: '日期' },
        { key: 'passCount', label: '通过' },
        { key: 'warnCount', label: '警告' },
        { key: 'failCount', label: '失败' },
        { key: 'ready', label: '是否可继续' },
    ], [{
        date: summary.date,
        passCount: summary.passCount,
        warnCount: summary.warnCount,
        failCount: summary.failCount,
        ready: summary.ready ? 'YES' : 'NO',
    }]);

    printSection('检查项明细');
    printTable([
        { key: 'label', label: '检查项' },
        { key: 'status', label: '状态' },
        { key: 'detail', label: '详情' },
        { key: 'action', label: '建议动作' },
    ], checks);

    if (!summary.ready) {
        process.exitCode = 1;
    }
}

function buildPilotReportMarkdown(data, meta) {
    const summary = data.summary || {};
    const alerts = data.alerts || {};
    const pendingRegistrationInvites = ensureArray(data.pendingRegistrationInvites);
    const pendingHouseholdInvites = ensureArray(data.pendingHouseholdInvites);
    const latestHouseholds = ensureArray(data.latestHouseholds);
    const latestActivity = ensureArray(data.latestActivity);
    const householdsWithoutChildren = ensureArray(alerts.householdsWithoutChildren);
    const accountsWithoutHousehold = ensureArray(alerts.accountsWithoutHousehold);
    const childrenNeverSynced = ensureArray(alerts.childrenNeverSynced);
    const childrenStaleSync = ensureArray(alerts.childrenStaleSync);
    const childrenWithoutSnapshots = ensureArray(alerts.childrenWithoutSnapshots);
    const registrationInvitesExpiringSoon = ensureArray(alerts.registrationInvitesExpiringSoon);
    const householdInvitesExpiringSoon = ensureArray(alerts.householdInvitesExpiringSoon);
    const stalePkMatches = ensureArray(alerts.stalePkMatches);
    const recentDays = summary.recentDays || 7;
    const alertDays = alerts.alertDays || Math.max(1, Math.min(recentDays, 7));

    return [
        `# 家庭账号社交试运行巡检报告（${meta.date}）`,
        '',
        `> 生成时间：\`${meta.generatedAt}\``,
        `> 数据来源：\`${meta.source}\``,
        meta.sourceFile ? `> 输入文件：\`${toPosixPath(meta.sourceFile)}\`` : '',
        '',
        '## 概览',
        '',
        renderMarkdownTable(
            ['指标', '值'],
            [
                ['家长账号数', summary.accountCount],
                ['家庭数', summary.householdCount],
                ['云端孩子数', summary.childCount],
                [`近${recentDays}天同步孩子`, summary.syncedRecentlyCount],
                ['待处理注册邀请码', summary.registrationPendingCount],
                ['待处理家庭邀请码', summary.householdInvitePendingCount],
                [`近${recentDays}天动态流条数`, summary.activityRecentCount],
                ['数学PK待处理', summary.mathPendingCount],
                ['汉字PK待处理', summary.hanziPendingCount],
                ['异常总数', summary.alertCount],
            ]
        ),
        '',
        '## 异常雷达',
        '',
        renderMarkdownTable(
            ['异常项', '数量'],
            [
                ['空家庭', summary.householdsWithoutChildrenCount],
                ['未入家庭账号', summary.accountsWithoutHouseholdCount],
                ['从未同步孩子', summary.childrenNeverSyncedCount],
                [`超${recentDays}天未同步孩子`, summary.childrenStaleSyncCount],
                ['无快照孩子', summary.childrenWithoutSnapshotsCount],
                [`近${alertDays}天到期注册码`, summary.registrationInvitesExpiringSoonCount],
                [`近${alertDays}天到期家庭码`, summary.householdInvitesExpiringSoonCount],
                [`超${recentDays}天挂起PK`, summary.stalePkMatchesCount],
            ]
        ),
        '',
        renderMarkdownListSection(
            '异常家庭：没有孩子档案',
            ['创建时间', '家庭ID', '家庭名'],
            householdsWithoutChildren.map((row) => [formatDate(row.created_at), row.id, row.name]),
            '当前没有“空家庭”异常。'
        ),
        '',
        renderMarkdownListSection(
            '异常账号：未加入任何家庭',
            ['创建时间', '账号ID', '家长名', '邮箱'],
            accountsWithoutHousehold.map((row) => [formatDate(row.created_at), row.id, row.parent_name || '-', row.email || '-']),
            '当前没有“未入家庭账号”异常。'
        ),
        '',
        renderMarkdownListSection(
            '异常孩子：从未同步',
            ['创建时间', '孩子ID', '家庭ID', '名字'],
            childrenNeverSynced.map((row) => [formatDate(row.created_at), row.id, row.household_id, `${row.emoji || ''}${row.display_name}`]),
            '当前没有“从未同步孩子”异常。'
        ),
        '',
        renderMarkdownListSection(
            `异常孩子：超${recentDays}天未同步`,
            ['最近同步', '孩子ID', '家庭ID', '名字'],
            childrenStaleSync.map((row) => [formatDate(row.last_synced_at), row.id, row.household_id, `${row.emoji || ''}${row.display_name}`]),
            `当前没有“超${recentDays}天未同步”异常。`
        ),
        '',
        renderMarkdownListSection(
            '异常孩子：缺少宠物快照',
            ['创建时间', '孩子ID', '家庭ID', '名字'],
            childrenWithoutSnapshots.map((row) => [formatDate(row.created_at), row.id, row.household_id, `${row.emoji || ''}${row.display_name}`]),
            '当前没有“缺少宠物快照”异常。'
        ),
        '',
        renderMarkdownListSection(
            `异常邀请码：近${alertDays}天到期的注册邀请码`,
            ['邀请码', '标签', '过期时间', '剩余'],
            registrationInvitesExpiringSoon.map((row) => [row.invite_code, row.label || '-', formatDate(row.expires_at), formatDaysLeft(row.expires_at)]),
            `当前没有“近${alertDays}天到期的注册邀请码”异常。`
        ),
        '',
        renderMarkdownListSection(
            `异常邀请码：近${alertDays}天到期的家庭邀请码`,
            ['邀请码', '家庭ID', '过期时间', '剩余'],
            householdInvitesExpiringSoon.map((row) => [row.invite_code, row.household_id, formatDate(row.expires_at), formatDaysLeft(row.expires_at)]),
            `当前没有“近${alertDays}天到期的家庭邀请码”异常。`
        ),
        '',
        renderMarkdownListSection(
            `异常PK：超${recentDays}天仍未完成`,
            ['发起时间', 'PKID', '类型', '状态', '发起孩子ID', '对手孩子ID'],
            stalePkMatches.map((row) => [formatDate(row.created_at), row.id, row.game_type, row.status, row.challenger_child_id, row.opponent_child_id]),
            `当前没有“超${recentDays}天未完成PK”异常。`
        ),
        '',
        '## 最近待处理注册邀请码',
        '',
        renderMarkdownTable(
            ['邀请码', '标签', '状态', '过期时间'],
            pendingRegistrationInvites.map((row) => [row.invite_code, row.label || '-', row.status, formatDate(row.expires_at)])
        ),
        '',
        '## 最近待处理家庭邀请码',
        '',
        renderMarkdownTable(
            ['邀请码', '家庭ID', '角色', '过期时间'],
            pendingHouseholdInvites.map((row) => [row.invite_code, row.household_id, row.role, formatDate(row.expires_at)])
        ),
        '',
        '## 最近创建家庭',
        '',
        renderMarkdownTable(
            ['创建时间', '家庭ID', '家庭名', '创建者账号ID'],
            latestHouseholds.map((row) => [formatDate(row.created_at), row.id, row.name, row.owner_account_id])
        ),
        '',
        '## 最近动态流',
        '',
        renderMarkdownTable(
            ['时间', '事件', '家庭ID', '孩子ID', '摘要'],
            latestActivity.map((row) => [formatDate(row.created_at), row.event_type, row.household_id || '-', row.child_id || '-', row.summary || '-'])
        ),
        '',
    ].filter(Boolean).join('\n');
}

async function pilotReport(config, options) {
    const date = resolveDateString(options);
    const generatedAt = new Date().toISOString();
    const output = options.output || path.join('docs', '家庭账号社交体系', '联调上线', `pilot-overview-${date}.md`);
    const jsonInput = options['json-input'];

    let source = 'live-supabase';
    let sourceFile = '';
    let data;

    if (jsonInput) {
        const loaded = readJsonInputFile(jsonInput);
        source = 'json-input';
        sourceFile = loaded.filePath;
        data = loaded.data;
    } else {
        const liveConfig = config || resolveConfig(options);
        data = await collectPilotOverviewData(liveConfig, options);
    }

    const markdown = buildPilotReportMarkdown(data, {
        date,
        generatedAt,
        source,
        sourceFile,
    });

    const outputPath = writeTextFile(output, markdown, Boolean(options.force));
    printCreatedFile('已生成试运行巡检报告', outputPath);
    return outputPath;
}

async function logsReport(_config, options) {
    const date = resolveDateString(options);
    const generatedAt = new Date().toISOString();
    const input = readJsonInputFile(requireOption(options, 'json-input', '--json-input'));
    const data = buildLogsReportData(input.data, options);

    if (options.json) {
        printJson(data);
        return data;
    }

    const output = options.output || path.join('docs', '家庭账号社交体系', '联调上线', `function-logs-${date}.md`);
    const markdown = buildLogsReportMarkdown(data, {
        date,
        generatedAt,
        sourceFile: input.filePath,
    });
    const outputPath = writeTextFile(output, markdown, Boolean(options.force));
    printCreatedFile('已生成函数日志汇总报告', outputPath);
    return outputPath;
}

async function pilotBundle(config, options) {
    const date = resolveDateString(options);
    const generatedAt = new Date().toISOString();
    const outputDir = path.resolve(
        getRepoRoot(),
        String(options['output-dir'] || path.join('docs', '家庭账号社交体系', '联调上线')).trim()
    );
    const jsonInput = options['json-input'];
    const force = Boolean(options.force);

    let source = 'live-supabase';
    let sourceFile = '';
    let data;

    if (jsonInput) {
        const loaded = readJsonInputFile(jsonInput);
        source = 'json-input';
        sourceFile = loaded.filePath;
        data = loaded.data;
    } else {
        const liveConfig = config || resolveConfig(options);
        data = await collectPilotOverviewData(liveConfig, options);
    }

    const bundleJson = {
        generatedAt,
        source,
        sourceFile: sourceFile ? toPosixPath(sourceFile) : '',
        date,
        data,
    };

    const markdown = buildPilotReportMarkdown(data, {
        date,
        generatedAt,
        source,
        sourceFile,
    });
    const doctorData = collectPilotDoctorData(options);
    const doctorJson = {
        generatedAt,
        source: 'local-preflight',
        date,
        data: doctorData,
    };
    const doctorMarkdown = buildPilotDoctorMarkdown(doctorData, {
        date,
        generatedAt,
    });

    const overviewJsonPath = writeJsonFile(path.join(outputDir, `pilot-overview-${date}.json`), bundleJson, force);
    const overviewMdPath = writeTextFile(path.join(outputDir, `pilot-overview-${date}.md`), markdown, force);
    const doctorJsonPath = writeJsonFile(path.join(outputDir, `pilot-doctor-${date}.json`), doctorJson, force);
    const doctorMdPath = writeTextFile(path.join(outputDir, `pilot-doctor-${date}.md`), doctorMarkdown, force);
    const manualRunPath = createTemplateFile(
        'manual-run-template.md',
        () => path.join(outputDir, `manual-run-${date}.md`),
        '已生成联调记录模板',
        { ...options, date, force }
    );
    const deployLogPath = createTemplateFile(
        'deploy-log-template.md',
        () => path.join(outputDir, `deploy-log-${date}.md`),
        '已生成部署日志模板',
        { ...options, date, force }
    );
    const goNoGoPath = createTemplateFile(
        'go-no-go-template.md',
        () => path.join(outputDir, `go-no-go-${date}.md`),
        '已生成上线决策模板',
        { ...options, date, force }
    );

    printCreatedFile('已生成试运行总览 JSON', overviewJsonPath);
    printCreatedFile('已生成试运行巡检报告', overviewMdPath);
    printCreatedFile('已生成联调前体检 JSON', doctorJsonPath);
    printCreatedFile('已生成联调前体检报告', doctorMdPath);

    console.log(`\n交接包内容：\n- ${toPosixPath(overviewJsonPath)}\n- ${toPosixPath(overviewMdPath)}\n- ${toPosixPath(doctorJsonPath)}\n- ${toPosixPath(doctorMdPath)}\n- ${toPosixPath(manualRunPath)}\n- ${toPosixPath(deployLogPath)}\n- ${toPosixPath(goNoGoPath)}`);

    return {
        overviewJsonPath,
        overviewMdPath,
        doctorJsonPath,
        doctorMdPath,
        manualRunPath,
        deployLogPath,
        goNoGoPath,
    };
}

async function deployBundle(_config, options) {
    const date = resolveDateString(options);
    const outputDir = path.resolve(
        getRepoRoot(),
        String(options['output-dir'] || path.join('docs', '家庭账号社交体系', '联调上线')).trim()
    );
    const force = Boolean(options.force);
    const context = buildDeployBundleContext(options);

    const ps1Path = writeTextFile(
        path.join(outputDir, `supabase-deploy-${date}.ps1`),
        buildSupabaseDeployPowerShell(context),
        force
    );
    const jsPath = writeTextFile(
        path.join(outputDir, `cloud-config-${date}.js`),
        buildCloudConfigSnippet(context, `cloud-config-${date}.js`, `部署包导出的 cloud-config-${date}.js`),
        force
    );
    const localJsPath = writeTextFile(
        path.join(outputDir, 'cloud-config.local.js'),
        buildCloudConfigSnippet(context, 'cloud-config.local.js', '站点根目录 cloud-config.local.js'),
        force
    );
    const seedSqlPath = writeTextFile(
        path.join(outputDir, `registration-invites-${date}.sql`),
        buildRegistrationSeedSqlContent({
            ...options,
            date,
            output: '',
        }),
        force
    );
    const deployLogPath = createTemplateFile(
        'deploy-log-template.md',
        () => path.join(outputDir, `deploy-log-${date}.md`),
        '已生成部署日志模板',
        { ...options, date, force }
    );

    printCreatedFile('已生成 Supabase 部署脚本', ps1Path);
    printCreatedFile('已生成前端云端配置片段', jsPath);
    printCreatedFile('已生成可直接挂载的前端云端配置文件', localJsPath);
    printCreatedFile('已生成注册邀请码种子 SQL', seedSqlPath);
    return {
        ps1Path,
        jsPath,
        localJsPath,
        seedSqlPath,
        deployLogPath,
    };
}

async function installLocalCloudConfig(_config, options) {
    const context = ensureConcreteBrowserConfig(buildDeployBundleContext(options));
    const output = options.output || 'cloud-config.local.js';
    const outputPath = writeTextFile(
        output,
        buildCloudConfigSnippet(context, 'cloud-config.local.js', '站点根目录 cloud-config.local.js'),
        Boolean(options.force)
    );
    printCreatedFile('已生成站点根目录云端配置文件', outputPath);
    return outputPath;
}

async function inspectCloudConfig(_config, options) {
    const data = collectConfigInspectData(options);
    if (options.json) {
        printJson(data);
        return data;
    }

    printConfigInspectReport(data);
    return data;
}

const COMMANDS = {
    'registration:list': { handler: listRegistrationInvites, needsConfig: true },
    'registration:issue': { handler: issueRegistrationInvites, needsConfig: true },
    'registration:revoke': { handler: revokeRegistrationInvite, needsConfig: true },
    'registration:seed-sql': { handler: registrationSeedSql, needsConfig: false },
    'household-invites:list': { handler: listHouseholdInvites, needsConfig: true },
    'household-invites:revoke': { handler: revokeHouseholdInvite, needsConfig: true },
    'household:inspect': { handler: inspectHousehold, needsConfig: true },
    'child:inspect': { handler: inspectChild, needsConfig: true },
    'pk:inspect': { handler: inspectPk, needsConfig: false },
    'pair:inspect': { handler: inspectChildPair, needsConfig: false },
    'diagnostics:compare': { handler: compareDiagnosticsSnapshots, needsConfig: false },
    'pilot:overview': { handler: pilotOverview, needsConfig: true },
    'pilot:doctor': { handler: pilotDoctor, needsConfig: false },
    'pilot:report': { handler: pilotReport, needsConfig: false },
    'pilot:bundle': { handler: pilotBundle, needsConfig: false },
    'logs:report': { handler: logsReport, needsConfig: false },
    'deploy:bundle': { handler: deployBundle, needsConfig: false },
    'config:install-local': { handler: installLocalCloudConfig, needsConfig: false },
    'config:inspect': { handler: inspectCloudConfig, needsConfig: false },
    'template:manual-run': { handler: createManualRunTemplate, needsConfig: false },
    'template:deploy-log': { handler: createDeployLogTemplate, needsConfig: false },
    'template:go-no-go': { handler: createGoNoGoTemplate, needsConfig: false },
    'template:all': { handler: createAllTemplates, needsConfig: false },
};

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const command = options._[0];

    if (!command || command === 'help' || options.help) {
        console.log(HELP_TEXT.trim());
        return;
    }

    const commandMeta = COMMANDS[command];
    if (!commandMeta) {
        throw new Error(`未知命令 ${command}\n\n${HELP_TEXT.trim()}`);
    }

    const config = commandMeta.needsConfig ? resolveConfig(options) : null;
    await commandMeta.handler(config, options);
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
