// PromptHub — Pure Node.js Icon Generator
// Zero dependencies: generates valid PNG files from raw bytes
// Run: node generate-icons.js

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZES = [16, 48, 128, 300];

function createPNG(width, height, pixels) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter byte per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];       // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crc = crc32(typeB, data);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeB, data, crcBuf]);
  }

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// CRC32 for PNG chunks
function crc32(type, data) {
  const buf = Buffer.concat([type, data]);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate gradient pixel data with "P" letter
function generatePixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.38; // radius for rounded corners

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Rounded rect mask
      let mask = 1;
      if (x < r && y < r) {
        const dx = x - r, dy = y - r;
        mask = (dx*dx + dy*dy <= r*r) ? 1 : 0;
      } else if (x >= size - r && y < r) {
        const dx = x - (size - r - 1), dy = y - r;
        mask = (dx*dx + dy*dy <= r*r) ? 1 : 0;
      } else if (x < r && y >= size - r) {
        const dx = x - r, dy = y - (size - r - 1);
        mask = (dx*dx + dy*dy <= r*r) ? 1 : 0;
      } else if (x >= size - r && y >= size - r) {
        const dx = x - (size - r - 1), dy = y - (size - r - 1);
        mask = (dx*dx + dy*dy <= r*r) ? 1 : 0;
      }

      if (mask === 0) {
        pixels[idx + 3] = 0; // transparent
        continue;
      }

      // Gradient: indigo → violet → purple
      const t = (x + y) / (size * 2);
      const r_col = Math.round(99 + t * (168 - 99));   // 99→168
      const g_col = Math.round(102 + t * (85 - 102));   // 102→85
      const b_col = Math.round(241 + t * (247 - 241));  // 241→247

      pixels[idx] = r_col;
      pixels[idx + 1] = g_col;
      pixels[idx + 2] = b_col;
      pixels[idx + 3] = 255;
    }
  }

  return pixels;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');

SIZES.forEach(size => {
  const pixels = generatePixels(size);
  const png = createPNG(size, size, pixels);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`✅ icon${size}.png (${size}×${size}) — ${(png.length / 1024).toFixed(1)} KB`);
});

console.log('\n🎉 All icons generated!');
