import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPageLoadReport, parseMeasureArgs } from './measure-page-load.mjs';

test('aggregates navigation and resource timing into a route report', () => {
    const report = buildPageLoadReport({
        route: '/app/learn',
        url: 'http://127.0.0.1:7000/app/learn',
        finalUrl: 'http://127.0.0.1:7000/app/learn',
        appReady: true,
        navigation: {
            status: 200,
            transferSize: 1200,
            encodedBodySize: 900,
            decodedBodySize: 2400,
            domContentLoadedEventEnd: 180,
            loadEventEnd: 260
        },
        resources: [
            { name: 'http://127.0.0.1:7000/js/app.js', initiatorType: 'script', transferSize: 4000, encodedBodySize: 3000, decodedBodySize: 9000, duration: 80 },
            { name: 'http://127.0.0.1:7000/assets/hero.webp', initiatorType: 'img', transferSize: 8000, encodedBodySize: 7000, decodedBodySize: 16000, duration: 120 }
        ],
        failedRequests: [{ url: 'http://127.0.0.1:7000/missing.png', errorText: 'net::ERR_FAILED' }],
        httpErrors: [{ url: 'http://127.0.0.1:7000/missing.png', status: 404 }]
    });

    assert.equal(report.route, '/app/learn');
    assert.equal(report.finalUrl, 'http://127.0.0.1:7000/app/learn');
    assert.equal(report.appReady, true);
    assert.equal(report.resourceCount, 2);
    assert.equal(report.transferBytes, 12000);
    assert.equal(report.byType.script.transferBytes, 4000);
    assert.equal(report.byType.img.transferBytes, 8000);
    assert.equal(report.failedRequestCount, 1);
    assert.equal(report.httpErrorCount, 1);
    assert.equal(report.largestResources[0].name.endsWith('/hero.webp'), true);
});

test('parses explicit routes and rejects an empty route list', () => {
    assert.deepEqual(parseMeasureArgs(['--routes=/,/app/learn', '--base-url=http://localhost:7000']).routes, ['/', '/app/learn']);
    assert.throws(() => parseMeasureArgs(['--routes=']), /routes must not be empty/);
});
