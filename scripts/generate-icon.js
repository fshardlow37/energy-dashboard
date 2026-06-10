/**
 * generate-icon.js
 *
 * Generates a multi-size .ico and a 512x512 .png for the energysrc app
 * using only built-in Node.js modules.
 *
 * Design: lightning bolt on a circular dark background, accent color #e94560.
 * ICO contains 16x16, 32x32, 48x48, and 256x256 images.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const BG      = { r: 13,  g: 17,  b: 23,  a: 255 }; // #0d1117
const CIRCLE  = { r: 22,  g: 27,  b: 34,  a: 255 }; // #161b22
const BOLT    = { r: 233, g: 69,  b: 96,  a: 255 }; // #e94560
const GLOW    = { r: 255, g: 120, b: 140, a: 100 }; // soft glow

// Lightning bolt as normalized polygon (0-1 coords, relative to circle center)
// Defined as two triangles forming the classic bolt shape
const BOLT_UPPER = [
  [0.08, -0.38],   // top-left of upper piece
  [0.30, -0.38],   // top-right
  [0.05, 0.05],    // bottom-right (meets bar)
  [-0.18, 0.05],   // bottom-left (meets bar)
];

const BOLT_LOWER = [
  [0.18, -0.05],   // top-right of lower piece
  [-0.05, -0.05],  // top-left
  [-0.08, 0.38],   // bottom-right
  [-0.30, 0.38],   // bottom-left -- wait, let me redefine
];

// Simpler approach: define bolt as a single polygon path
const BOLT_POLY = [
  // Upper spike going down-right
  [-0.05, -0.40],  // top tip
  [0.25, -0.40],   // top right
  [0.02, -0.02],   // middle right (bar junction)
  [0.22, -0.02],   // bar right extension
  // Lower spike going down-left
  [0.05, 0.40],    // bottom tip
  [-0.25, 0.40],   // bottom left
  [-0.02, 0.02],   // middle left (bar junction)
  [-0.22, 0.02],   // bar left extension
];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToPolygonEdge(px, py, poly) {
  let minDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const x1 = poly[i][0], y1 = poly[i][1];
    const x2 = poly[j][0], y2 = poly[j][1];
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function blendOver(base, over) {
  const oa = over.a / 255;
  const ba = base.a / 255;
  const outA = oa + ba * (1 - oa);
  if (outA === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((over.r * oa + base.r * ba * (1 - oa)) / outA),
    g: Math.round((over.g * oa + base.g * ba * (1 - oa)) / outA),
    b: Math.round((over.b * oa + base.b * ba * (1 - oa)) / outA),
    a: Math.round(outA * 255)
  };
}

// ---------------------------------------------------------------------------
// Draw icon at a given size
// ---------------------------------------------------------------------------
function drawIcon(size) {
  const pixels = [];
  const cx = size / 2, cy = size / 2;
  const radius = size * 0.45;
  const glowWidth = size >= 48 ? 2.5 / size : 1.5 / size; // normalized glow width

  for (let y = 0; y < size; y++) {
    pixels[y] = [];
    for (let x = 0; x < size; x++) {
      // Normalized coordinates relative to center (-0.5 to 0.5)
      const nx = (x - cx + 0.5) / size;
      const ny = (y - cy + 0.5) / size;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Start with background
      let color = { ...BG };

      // Draw circle
      if (dist <= radius / size) {
        // Anti-alias circle edge
        const edgeDist = radius / size - dist;
        if (edgeDist < 1 / size) {
          const alpha = Math.min(1, edgeDist * size);
          color = blendOver(color, { ...CIRCLE, a: Math.round(alpha * 255) });
        } else {
          color = { ...CIRCLE };
        }

        // Check if inside bolt polygon (scale bolt to circle)
        const bx = nx * 1.1; // slight scale adjustment
        const by = ny * 1.1;

        if (pointInPolygon(bx, by, BOLT_POLY)) {
          color = { ...BOLT };
        } else {
          // Glow near bolt edges
          const edgeDist2 = distToPolygonEdge(bx, by, BOLT_POLY);
          if (edgeDist2 < glowWidth) {
            const glowAlpha = (1 - edgeDist2 / glowWidth) * (GLOW.a / 255);
            color = blendOver(color, { ...GLOW, a: Math.round(glowAlpha * 255) });
          }
        }
      }

      pixels[y][x] = color;
    }
  }

  return pixels;
}

// ---------------------------------------------------------------------------
// Encode multi-size ICO
// ---------------------------------------------------------------------------
function encodeICO(allImages) {
  const headerSize = 6;
  const numImages = allImages.length;
  const dirSize = numImages * 16;

  // Pre-calculate each image's BMP data
  const bmpDataList = allImages.map(({ size, pixels }) => {
    const bpp = 32;
    const rowSize = size * 4;
    const pixelDataSize = rowSize * size;
    const andRowPadded = Math.ceil(Math.ceil(size / 8) / 4) * 4;
    const andMaskSize = andRowPadded * size;
    const bmpHeaderSize = 40;
    const totalImageSize = bmpHeaderSize + pixelDataSize + andMaskSize;

    const buf = Buffer.alloc(totalImageSize);
    let off = 0;

    // BITMAPINFOHEADER
    buf.writeUInt32LE(bmpHeaderSize, off); off += 4;
    buf.writeInt32LE(size, off); off += 4;
    buf.writeInt32LE(size * 2, off); off += 4;
    buf.writeUInt16LE(1, off); off += 2;
    buf.writeUInt16LE(bpp, off); off += 2;
    buf.writeUInt32LE(0, off); off += 4;
    buf.writeUInt32LE(pixelDataSize + andMaskSize, off); off += 4;
    buf.writeInt32LE(0, off); off += 4;
    buf.writeInt32LE(0, off); off += 4;
    buf.writeUInt32LE(0, off); off += 4;
    buf.writeUInt32LE(0, off); off += 4;

    // Pixel data (BGRA, bottom-to-top)
    for (let y = size - 1; y >= 0; y--) {
      for (let x = 0; x < size; x++) {
        const px = pixels[y][x];
        buf.writeUInt8(px.b, off++);
        buf.writeUInt8(px.g, off++);
        buf.writeUInt8(px.r, off++);
        buf.writeUInt8(px.a, off++);
      }
    }

    // AND mask (all 0 = opaque)
    for (let y = size - 1; y >= 0; y--) {
      for (let i = 0; i < andRowPadded; i++) {
        buf.writeUInt8(0, off++);
      }
    }

    return { size, buf };
  });

  // Calculate total file size
  let dataOffset = headerSize + dirSize;
  const totalSize = dataOffset + bmpDataList.reduce((sum, d) => sum + d.buf.length, 0);
  const ico = Buffer.alloc(totalSize);
  let off = 0;

  // ICONDIR header
  ico.writeUInt16LE(0, off); off += 2;
  ico.writeUInt16LE(1, off); off += 2;
  ico.writeUInt16LE(numImages, off); off += 2;

  // ICONDIRENTRY for each image
  let currentDataOffset = dataOffset;
  for (const { size, buf } of bmpDataList) {
    ico.writeUInt8(size < 256 ? size : 0, off++);
    ico.writeUInt8(size < 256 ? size : 0, off++);
    ico.writeUInt8(0, off++);
    ico.writeUInt8(0, off++);
    ico.writeUInt16LE(1, off); off += 2;
    ico.writeUInt16LE(32, off); off += 2;
    ico.writeUInt32LE(buf.length, off); off += 4;
    ico.writeUInt32LE(currentDataOffset, off); off += 4;
    currentDataOffset += buf.length;
  }

  // Image data
  for (const { buf } of bmpDataList) {
    buf.copy(ico, off);
    off += buf.length;
  }

  return ico;
}

// ---------------------------------------------------------------------------
// Encode PNG
// ---------------------------------------------------------------------------
function encodePNG(pixels, size) {
  // Build raw image data: filter byte (0=None) + RGBA per row
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = pixels[y][x];
      const off = 1 + x * 4;
      row[off] = px.r;
      row[off + 1] = px.g;
      row[off + 2] = px.b;
      row[off + 3] = px.a;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);

  function pngChunk(type, data) {
    const buf = Buffer.alloc(4 + 4 + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC over type + data
    const crcData = buf.slice(4, 8 + data.length);
    buf.writeUInt32BE(crc32(crcData) >>> 0, 8 + data.length);
    return buf;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ];

  return Buffer.concat(chunks);
}

// CRC32 for PNG chunks
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const outputDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const icoSizes = [16, 32, 48, 256];
console.log(`Generating icon at sizes: ${icoSizes.join(', ')}...`);

const images = icoSizes.map(size => {
  console.log(`  Drawing ${size}x${size}...`);
  return { size, pixels: drawIcon(size) };
});

const icoBuffer = encodeICO(images);
const icoPath = path.join(outputDir, 'icon.ico');
fs.writeFileSync(icoPath, icoBuffer);
console.log(`ICO written to ${icoPath} (${icoBuffer.length} bytes)`);

// Generate 512x512 PNG for macOS
console.log('  Drawing 512x512 PNG...');
const pngPixels = drawIcon(512);
const pngBuffer = encodePNG(pngPixels, 512);
const pngPath = path.join(outputDir, 'icon.png');
fs.writeFileSync(pngPath, pngBuffer);
console.log(`PNG written to ${pngPath} (${pngBuffer.length} bytes)`);
