import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { browserLaunchOpts } from './playwright-browser.mjs';

const DEFAULT_ROUTES = ['/', '/app/today', '/app/learn', '/app/explore', '/app/playground'];
const DEFAULT_BASE_URL = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000';

export function parseMeasureArgs(args = []) {
    const options = {
        baseUrl: DEFAULT_BASE_URL.replace(/\/$/, ''),
        routes: [...DEFAULT_ROUTES],
        output: '',
        timeoutMs: 20000,
        mobile: false,
        help: false
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--mobile') {
            options.mobile = true;
        } else if (arg.startsWith('--base-url=')) {
            const value = arg.slice('--base-url='.length).trim();
            if (!value) throw new Error('base-url must not be empty');
            options.baseUrl = value.replace(/\/$/, '');
        } else if (arg.startsWith('--routes=')) {
            const value = arg.slice('--routes='.length).trim();
            if (!value) throw new Error('routes must not be empty');
            options.routes = value.split(',').map(normalizeRoute).filter(Boolean);
            if (!options.routes.length) throw new Error('routes must not be empty');
        } else if (arg.startsWith('--output=')) {
            options.output = arg.slice('--output='.length).trim();
            if (!options.output) throw new Error('output must not be empty');
        } else if (arg.startsWith('--timeout-ms=')) {
            const value = Number(arg.slice('--timeout-ms='.length));
            if (!Number.isInteger(value) || value < 1000) throw new Error('timeout-ms must be an integer >= 1000');
            options.timeoutMs = value;
        } else {
            throw new Error(`Unknown option: ${arg}`);
        }
    }
    return options;
}

export function buildPageLoadReport({
    route,
    url,
    finalUrl = url,
    appReady = false,
    navigation = {},
    resources = [],
    failedRequests = [],
    httpErrors = [],
    errors = []
}) {
    const byType = Object.create(null);
    const normalizedResources = resources.map((resource) => ({
        name: String(resource.name || ''),
        initiatorType: String(resource.initiatorType || 'other'),
        transferSize: nonNegativeNumber(resource.transferSize),
        encodedBodySize: nonNegativeNumber(resource.encodedBodySize),
        decodedBodySize: nonNegativeNumber(resource.decodedBodySize),
        duration: nonNegativeNumber(resource.duration)
    }));

    for (const resource of normalizedResources) {
        const type = resource.initiatorType || 'other';
        const summary = byType[type] || {
            requests: 0,
            transferBytes: 0,
            encodedBytes: 0,
            decodedBytes: 0
        };
        summary.requests += 1;
        summary.transferBytes += resource.transferSize;
        summary.encodedBytes += resource.encodedBodySize;
        summary.decodedBytes += resource.decodedBodySize;
        byType[type] = summary;
    }

    return {
        route,
        url,
        finalUrl,
        status: Number.isFinite(Number(navigation.status)) ? Number(navigation.status) : null,
        appReady: Boolean(appReady),
        navigation: {
            transferBytes: nonNegativeNumber(navigation.transferSize),
            encodedBytes: nonNegativeNumber(navigation.encodedBodySize),
            decodedBytes: nonNegativeNumber(navigation.decodedBodySize),
            domContentLoadedMs: nonNegativeNumber(navigation.domContentLoadedEventEnd),
            loadEventEndMs: nonNegativeNumber(navigation.loadEventEnd)
        },
        resourceCount: normalizedResources.length,
        transferBytes: normalizedResources.reduce((sum, item) => sum + item.transferSize, 0),
        encodedBytes: normalizedResources.reduce((sum, item) => sum + item.encodedBodySize, 0),
        decodedBytes: normalizedResources.reduce((sum, item) => sum + item.decodedBodySize, 0),
        byType,
        largestResources: normalizedResources
            .slice()
            .sort((a, b) => resourceBytes(b) - resourceBytes(a) || a.name.localeCompare(b.name))
            .slice(0, 20),
        failedRequestCount: failedRequests.length,
        failedRequests,
        httpErrorCount: httpErrors.length,
        httpErrors,
        errors
    };
}

async function measureRoute(page, baseUrl, route, timeoutMs) {
    const url = new URL(route, `${baseUrl}/`).href;
    const failedRequests = [];
    const httpErrors = [];
    const errors = [];
    page.on('requestfailed', (request) => {
        failedRequests.push({ url: request.url(), errorText: request.failure()?.errorText || 'request failed' });
    });
    page.on('response', (response) => {
        if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
    });

    let response = null;
    try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        try {
            await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: timeoutMs });
        } catch (error) {
            errors.push(`app-ready timeout: ${error.message}`);
        }
        await page.waitForTimeout(250);
    } catch (error) {
        errors.push(`navigation failed: ${error.message}`);
    }

    let pageData = { navigation: {}, resources: [], appReady: false };
    try {
        pageData = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] || {};
            return {
                appReady: document.body.classList.contains('app-ready'),
                navigation: {
                    status: navigation.responseStatus,
                    transferSize: navigation.transferSize,
                    encodedBodySize: navigation.encodedBodySize,
                    decodedBodySize: navigation.decodedBodySize,
                    domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
                    loadEventEnd: navigation.loadEventEnd
                },
                resources: performance.getEntriesByType('resource').map((entry) => ({
                    name: entry.name,
                    initiatorType: entry.initiatorType,
                    transferSize: entry.transferSize,
                    encodedBodySize: entry.encodedBodySize,
                    decodedBodySize: entry.decodedBodySize,
                    duration: entry.duration
                }))
            };
        });
    } catch (error) {
        errors.push(`timing collection failed: ${error.message}`);
    }

    return buildPageLoadReport({
        route,
        url,
        finalUrl: page.url(),
        appReady: pageData.appReady,
        navigation: { ...pageData.navigation, status: response?.status() ?? pageData.navigation.status },
        resources: pageData.resources,
        failedRequests,
        httpErrors,
        errors
    });
}

export async function measurePageLoads(options = parseMeasureArgs([])) {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch(browserLaunchOpts());
    const viewport = options.mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 };
    const context = await browser.newContext({ viewport, isMobile: options.mobile });
    const pages = [];
    try {
        for (const route of options.routes) {
            const page = await context.newPage();
            try {
                pages.push(await measureRoute(page, options.baseUrl, route, options.timeoutMs));
            } finally {
                await page.close();
            }
        }
    } finally {
        await context.close();
        await browser.close();
    }

    return {
        version: 1,
        capturedAt: new Date().toISOString(),
        baseUrl: options.baseUrl,
        viewport,
        pages
    };
}

function normalizeRoute(value) {
    const route = String(value || '').trim();
    if (!route) return '';
    return route.startsWith('/') ? route : `/${route}`;
}

function nonNegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function resourceBytes(resource) {
    return resource.transferSize || resource.encodedBodySize || resource.decodedBodySize;
}

async function main() {
    const options = parseMeasureArgs(process.argv.slice(2));
    if (options.help) {
        console.log('Usage: node scripts/measure-page-load.mjs [--base-url=URL] [--routes=/,/app/learn] [--output=PATH] [--timeout-ms=N] [--mobile]');
        return;
    }
    const report = await measurePageLoads(options);
    if (options.output) {
        const output = path.resolve(options.output);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
        console.log(`[page-load] wrote ${output}`);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => {
        console.error(`[page-load] ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}
