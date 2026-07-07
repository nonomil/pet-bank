import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

const expectedRivals = [
    'robot-easy20-v5',
    'robot-easy100-v5',
    'robot-mul-v5',
    'robot-mix-v5',
    'robot-hard-v5'
];

function parsePngRgba(filePath) {
    const bytes = fs.readFileSync(filePath);
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${filePath} should be a PNG`);

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idatChunks = [];

    while (offset < bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (type === 'IHDR') {
            width = bytes.readUInt32BE(dataStart);
            height = bytes.readUInt32BE(dataStart + 4);
            bitDepth = bytes[dataStart + 8];
            colorType = bytes[dataStart + 9];
        } else if (type === 'IDAT') {
            idatChunks.push(bytes.subarray(dataStart, dataEnd));
        } else if (type === 'IEND') {
            break;
        }
        offset = dataEnd + 4;
    }

    assert.equal(bitDepth, 8, `${filePath} should use 8-bit channels`);
    assert.equal(colorType, 6, `${filePath} should be RGBA`);

    const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
    const stride = width * 4;
    const pixels = Buffer.alloc(height * stride);
    let inputOffset = 0;

    for (let y = 0; y < height; y += 1) {
        const filter = inflated[inputOffset];
        inputOffset += 1;
        const row = inflated.subarray(inputOffset, inputOffset + stride);
        inputOffset += stride;
        const outOffset = y * stride;

        for (let x = 0; x < stride; x += 1) {
            const left = x >= 4 ? pixels[outOffset + x - 4] : 0;
            const up = y > 0 ? pixels[outOffset - stride + x] : 0;
            const upLeft = y > 0 && x >= 4 ? pixels[outOffset - stride + x - 4] : 0;
            let value = row[x];
            if (filter === 1) value = (value + left) & 255;
            else if (filter === 2) value = (value + up) & 255;
            else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) {
                const p = left + up - upLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upLeft);
                const predictor = pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft);
                value = (value + predictor) & 255;
            } else {
                assert.equal(filter, 0, `${filePath} uses unsupported PNG filter ${filter}`);
            }
            pixels[outOffset + x] = value;
        }
    }

    return { width, height, pixels };
}

function alphaAt(image, x, y) {
    return image.pixels[(y * image.width + x) * 4 + 3];
}

function assertTransparentOuterRing(image, baseName) {
    for (let x = 0; x < image.width; x += 16) {
        assert.equal(alphaAt(image, x, 0), 0, `${baseName}.png top edge should be transparent`);
        assert.equal(alphaAt(image, x, image.height - 1), 0, `${baseName}.png bottom edge should be transparent`);
    }
    for (let y = 0; y < image.height; y += 16) {
        assert.equal(alphaAt(image, 0, y), 0, `${baseName}.png left edge should be transparent`);
        assert.equal(alphaAt(image, image.width - 1, y), 0, `${baseName}.png right edge should be transparent`);
    }
}

expectedRivals.forEach((baseName) => {
    const webpPath = `assets/arena/math-rivals/${baseName}.webp`;
    const pngPath = path.join(repoRoot, 'assets', 'arena', 'math-rivals', `${baseName}.png`);
    assert.ok(source.includes(webpPath), `Math PK should reference ${webpPath}`);
    assert.ok(fs.existsSync(pngPath), `${baseName}.png should exist for alpha validation`);

    const image = parsePngRgba(pngPath);
    assert.equal(image.width, 768, `${baseName}.png should use the shared 768px sprite canvas`);
    assert.equal(image.height, 768, `${baseName}.png should use the shared 768px sprite canvas`);
    assert.equal(alphaAt(image, 0, 0), 0, `${baseName}.png top-left corner should be transparent`);
    assert.equal(alphaAt(image, image.width - 1, 0), 0, `${baseName}.png top-right corner should be transparent`);
    assert.equal(alphaAt(image, 0, image.height - 1), 0, `${baseName}.png bottom-left corner should be transparent`);
    assert.equal(alphaAt(image, image.width - 1, image.height - 1), 0, `${baseName}.png bottom-right corner should be transparent`);
    assertTransparentOuterRing(image, baseName);
});

console.log('PASS math_pk_robot_rivals_assets');
