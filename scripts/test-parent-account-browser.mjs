import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const root = path.resolve(import.meta.dirname, '..');

function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}

function waitFor(url, timeoutMs = 15000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const response = await fetch(url);
                if (response.ok) return resolve();
            } catch (error) {}
            if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
            setTimeout(poll, 100);
        };
        poll();
    });
}

function start(command, args, options) {
    const child = spawn(command, args, { cwd: root, stdio: 'ignore', ...options });
    child.on('error', () => {});
    return child;
}

async function stop(child) {
    if (!child || child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (child.exitCode === null) child.kill('SIGKILL');
}

const apiPort = await freePort();
const staticPort = await freePort();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-parent-browser-'));
const dataDir = path.join(tempDir, 'data');
const siteDir = path.join(tempDir, 'site');
execFileSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', siteDir], { cwd: root, stdio: 'ignore' });
const api = start(process.execPath, ['src/main.mjs'], {
    cwd: path.join(root, 'prj', 'petbank-server'),
    env: {
        ...process.env,
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(apiPort),
        PETBANK_DATA_DIR: dataDir,
        PETBANK_JWT_SECRET: 'browser-test-secret-that-is-long-enough',
        PETBANK_ALLOWED_ORIGIN: `http://127.0.0.1:${staticPort}`,
        PETBANK_ENABLE_REGISTRATION: 'true',
    },
});
const staticServer = start('python', ['-m', 'http.server', String(staticPort), '--bind', '127.0.0.1'], { cwd: siteDir });

try {
    await waitFor(`http://127.0.0.1:${apiPort}/api/v1/health`);
    await waitFor(`http://127.0.0.1:${staticPort}/index.html`);

    const browser = await chromium.launch(browserLaunchOpts());
    const page = await browser.newPage();
    page.on('console', (message) => console.error(`[browser:${message.type()}] ${message.text()}`));
    page.on('pageerror', (error) => console.error(`[browser:pageerror] ${error.message}`));
    page.on('requestfailed', (request) => console.error(`[browser:requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`));
    await page.addInitScript((apiBaseUrl) => { window.__PETBANK_API_BASE_URL__ = apiBaseUrl; }, `http://127.0.0.1:${apiPort}/api/v1`);

    await page.goto(`http://127.0.0.1:${staticPort}/parent/settings/family/index.html`, { waitUntil: 'networkidle' });
    try {
        await page.waitForSelector('#parent-account-form', { timeout: 10000 });
    } catch (error) {
        console.error(`[browser:diagnostic] url=${page.url()}`);
        console.error(`[browser:diagnostic] body=${(await page.locator('body').innerText()).slice(0, 2000)}`);
        throw error;
    }
    const identifier = `13${String(Date.now()).slice(-9)}`;
    await page.click('[data-parent-account-toggle]');
    await page.waitForSelector('[name="displayName"]');
    await page.fill('[name="displayName"]', '浏览器家长');
    await page.fill('[name="identifier"]', identifier);
    await page.fill('[name="password"]', 'BrowserPass123!');
    await page.click('#parent-account-form button[type="submit"]');
    await page.waitForSelector('[data-parent-create-household]');

    await page.goto(`http://127.0.0.1:${staticPort}/parent/index.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.parent-home-primary-actions');
    const parentHome = await page.evaluate(() => ({
        primaryActions: [...document.querySelectorAll('.parent-home-primary-actions button strong')].map((heading) => heading.textContent.trim()),
        hasAdvancedDetails: Boolean(document.querySelector('.parent-home-more details')),
        advancedOpen: Boolean(document.querySelector('.parent-home-more details[open]')),
        bodyText: document.querySelector('#page-parent')?.textContent || '',
    }));
    assert.deepEqual(parentHome.primaryActions, ['添加孩子', '添加家长', '查看成长']);
    assert.equal(parentHome.hasAdvancedDetails, true);
    assert.equal(parentHome.advancedOpen, false);
    assert.doesNotMatch(parentHome.bodyText, /Parent Console|页面边界|\/settings\/\*|\/app\/\*/);

    const parentChrome = await page.evaluate(() => ({
        bodyClass: document.body.className,
        profileDisplay: getComputedStyle(document.getElementById('profileSwitcher')).display,
        pointsDisplay: getComputedStyle(document.querySelector('.point-capsule')).display,
        parentRootVisible: Boolean(document.getElementById('parent-account-root')?.offsetParent),
    }));
    assert.match(parentChrome.bodyClass, /shell-parent/);
    assert.equal(parentChrome.profileDisplay, 'none');
    assert.equal(parentChrome.pointsDisplay, 'none');
    assert.equal(parentChrome.parentRootVisible, true);

    page.once('dialog', (dialog) => dialog.accept('浏览器测试家庭'));
    await page.click('[data-parent-create-household]');
    await page.waitForFunction(() => document.querySelector('#parent-household-content')?.textContent.includes('浏览器测试家庭'));

    await page.click('[data-parent-add-child]');
    await page.fill('[data-child-dialog-form] input[name="name"]', '浏览器孩子');
    await page.click('[data-child-dialog-form] button[type="submit"]');
    await page.waitForTimeout(500);
    const profileState = await page.evaluate(() => JSON.parse(localStorage.getItem('petbank_profiles_meta') || '[]'));
    assert.ok(profileState.some((profile) => profile.name === '浏览器孩子'));
    await page.goto(`http://127.0.0.1:${staticPort}/parent/settings/family/index.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-parent-add-child]');
    const parentManagement = await page.evaluate(() => ({
        memberText: document.querySelector('.parent-member-list')?.textContent || '',
        hasAddParent: Boolean(document.querySelector('[data-parent-create-invite]')),
        hasDeleteChild: Boolean(document.querySelector('[data-parent-delete-child]')),
        hasDeleteAccount: Boolean(document.querySelector('[data-parent-delete-account]')),
        childEndpoint: Boolean(window.SelfHostedApi && typeof window.SelfHostedApi.deleteChild === 'function'),
    }));
    assert.match(parentManagement.memberText, /浏览器家长/);
    assert.equal(parentManagement.hasAddParent, true);
    assert.equal(parentManagement.hasDeleteChild, true);
    assert.equal(parentManagement.hasDeleteAccount, true);
    assert.equal(parentManagement.childEndpoint, true);
    const parentNav = await page.locator('.parent-shell-nav-item').allTextContents();
    assert.deepEqual(parentNav.map((text) => text.trim()), ['管理大厅', '设置管理', '成长作品', '工具箱', '进入孩子端']);
    assert.equal(await page.locator('.parent-shell-context-copy small').textContent(), '当前家庭');
    await page.evaluate(() => switchPage('settings', { settingsSection: 'family' }));
    await page.waitForFunction(() => document.querySelector('[data-settings-nav="family"]')?.classList.contains('is-current'));
    assert.equal(await page.locator('[data-settings-nav="family"]').textContent(), '家庭账号');
    await page.evaluate(() => switchPage('settings', { settingsSection: 'account' }));
    await page.waitForFunction(() => document.querySelector('[data-settings-nav="account"]')?.classList.contains('is-current'));
    assert.equal(await page.locator('[data-settings-nav="account"]').textContent(), '孩子档案');
    await page.goto(`http://127.0.0.1:${staticPort}/app/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.ProfileManager && typeof window.ProfileManager.syncActiveToCloud === 'function');
    await page.evaluate(() => {
        localStorage.setItem('petbank_points', '42');
    });
    const pushedSnapshot = await page.evaluate(async () => window.ProfileManager.syncActiveToCloud());
    assert.ok(Number.isInteger(pushedSnapshot.revision) && pushedSnapshot.revision >= 1);
    assert.equal(pushedSnapshot.payload['petbank_points'], '42');
    const secondDeviceContext = await browser.newContext();
    const secondDeviceState = await page.evaluate(() => ({
        accessToken: localStorage.getItem('petbank_self_hosted_access_token'),
        refreshToken: localStorage.getItem('petbank_self_hosted_refresh_token'),
        profiles: localStorage.getItem('petbank_profiles_meta'),
        activeProfile: localStorage.getItem('petbank_active_profile'),
    }));
    await secondDeviceContext.addInitScript((payload) => {
        window.__PETBANK_API_BASE_URL__ = payload.apiBaseUrl;
        Object.entries(payload.seed).forEach(([key, value]) => {
            if (value != null) localStorage.setItem(key, value);
        });
    }, {
        apiBaseUrl: `http://127.0.0.1:${apiPort}/api/v1`,
        seed: {
            petbank_self_hosted_access_token: secondDeviceState.accessToken,
            petbank_self_hosted_refresh_token: secondDeviceState.refreshToken,
            petbank_profiles_meta: secondDeviceState.profiles,
            petbank_active_profile: secondDeviceState.activeProfile,
        }
    });
    const secondDevice = await secondDeviceContext.newPage();
    secondDevice.on('console', (message) => console.error(`[browser:device2:${message.type()}] ${message.text()}`));
    secondDevice.on('pageerror', (error) => console.error(`[browser:device2:pageerror] ${error.message}`));
    secondDevice.on('requestfailed', (request) => console.error(`[browser:device2:requestfailed] ${request.url()} ${request.failure()?.errorText || ''}`));
    await secondDevice.addInitScript((apiBaseUrl) => { window.__PETBANK_API_BASE_URL__ = apiBaseUrl; }, `http://127.0.0.1:${apiPort}/api/v1`);
    await secondDevice.goto(`http://127.0.0.1:${staticPort}/app/index.html`, { waitUntil: 'networkidle' });
    await secondDevice.waitForFunction(() => localStorage.getItem('petbank_points') === '42');
    assert.equal(await secondDevice.evaluate(() => localStorage.getItem('petbank_points')), '42');
    const childChrome = await secondDevice.evaluate(() => ({
        bodyClass: document.body.className,
        parentRootVisible: Boolean(document.getElementById('parent-account-root')?.offsetParent),
        parentNavDisplay: getComputedStyle(document.querySelector('.parent-shell-nav')).display,
    }));
    assert.match(childChrome.bodyClass, /shell-home|shell-app/);
    assert.equal(childChrome.parentRootVisible, false);
    assert.equal(childChrome.parentNavDisplay, 'none');

    await secondDeviceContext.close();
    await browser.close();
    console.log('parent account browser journey: PASS');
} finally {
    await stop(staticServer);
    await stop(api);
    fs.rmSync(tempDir, { recursive: true, force: true });
}
