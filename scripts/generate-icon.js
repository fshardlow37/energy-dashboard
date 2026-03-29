/**
 * generate-icon.js
 *
 * Generates a valid .ico file for the energysrc app using only built-in
 * Node.js modules. The icon is a 32x32 image with a lightning bolt shape
 * on a dark background, stored as a 32-bit BGRA BMP inside the ICO container.
 *
 * ICO format reference:
 *   - 6-byte file header  (ICONDIR)
 *   - 16-byte directory entry per image (ICONDIRENTRY)
 *   - BMP data per image (BITMAPINFOHEADER + pixel rows + AND mask)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const SIZE = 32; // 32x32 icon
const BG = { r: 30, g: 30, b: 40, a: 255 };        // dark blue-grey background
const BOLT = { r: 255, g: 180, b: 20, a: 255 };     // orange-gold lightning bolt
const GLOW = { r: 255, g: 220, b: 80, a: 180 };     // lighter glow around bolt

// ---------------------------------------------------------------------------
// Draw the lightning bolt into a 32x32 BGRA pixel buffer (top-to-bottom)
// ---------------------------------------------------------------------------
function drawIcon() {
  // pixels[y][x] = {r,g,b,a}
  const pixels = [];
  for (let y = 0; y < SIZE; y++) {
    pixels[y] = [];
    for (let x = 0; x < SIZE; x++) {
      pixels[y][x] = { ...BG };
    }
  }

  function set(x, y, color) {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
      pixels[y][x] = { ...color };
    }
  }

  // Lightning bolt polygon defined as a list of (x, y) fill ranges per row.
  // The bolt goes from top-center, angling right, then a sharp jag left,
  // then down-right to the bottom.
  //
  // We'll define it with simple horizontal spans:
  //   [y, x_start, x_end]  (inclusive)

  const boltSpans = [
    // Top spike going down-left
    [3,  15, 19],
    [4,  14, 18],
    [5,  13, 18],
    [6,  12, 17],
    [7,  12, 17],
    [8,  11, 16],
    [9,  10, 16],
    [10, 10, 15],
    [11,  9, 15],
    [12,  9, 14],
    [13,  8, 14],
    // Horizontal bar (wide part where bolt jags)
    [14,  8, 22],
    [15,  9, 22],
    // Lower spike going down-left
    [16, 14, 21],
    [17, 14, 20],
    [18, 13, 20],
    [19, 13, 19],
    [20, 12, 19],
    [21, 12, 18],
    [22, 12, 18],
    [23, 11, 17],
    [24, 11, 17],
    [25, 11, 16],
    [26, 11, 16],
    [27, 11, 15],
    [28, 12, 15],
  ];

  // Draw glow (1px border around bolt)
  for (const [y, xs, xe] of boltSpans) {
    for (let x = xs - 1; x <= xe + 1; x++) {
      set(x, y, GLOW);
    }
    // Also glow one row above and below
    for (let x = xs; x <= xe; x++) {
      set(x, y - 1, GLOW);
      set(x, y + 1, GLOW);
    }
  }

  // Draw bolt on top of glow
  for (const [y, xs, xe] of boltSpans) {
    for (let x = xs; x <= xe; x++) {
      set(x, y, BOLT);
    }
  }

  return pixels;
}

// ---------------------------------------------------------------------------
// Encode as ICO
// ---------------------------------------------------------------------------
function encodeICO(pixels) {
  const width = SIZE;
  const height = SIZE;
  const bpp = 32; // bits per pixel

  // BMP rows are stored bottom-to-top in ICO
  const rowSize = width * 4; // 4 bytes per pixel (BGRA)
  const pixelDataSize = rowSize * height;

  // AND mask: 1 bit per pixel, rows padded to 4-byte boundary, bottom-to-top
  const andRowBytes = Math.ceil(width / 8);
  const andRowPadded = Math.ceil(andRowBytes / 4) * 4;
  const andMaskSize = andRowPadded * height;

  // BITMAPINFOHEADER is 40 bytes
  const bmpHeaderSize = 40;
  const imageDataSize = bmpHeaderSize + pixelDataSize + andMaskSize;

  // ICO header: 6 bytes
  // ICO directory entry: 16 bytes
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize;

  const totalSize = dataOffset + imageDataSize;
  const buf = Buffer.alloc(totalSize);
  let offset = 0;

  // --- ICONDIR header ---
  buf.writeUInt16LE(0, offset);       // reserved, must be 0
  offset += 2;
  buf.writeUInt16LE(1, offset);       // type: 1 = ICO
  offset += 2;
  buf.writeUInt16LE(1, offset);       // number of images
  offset += 2;

  // --- ICONDIRENTRY ---
  buf.writeUInt8(width < 256 ? width : 0, offset);   // width (0 means 256)
  offset += 1;
  buf.writeUInt8(height < 256 ? height : 0, offset);  // height (0 means 256)
  offset += 1;
  buf.writeUInt8(0, offset);           // color palette size (0 = no palette)
  offset += 1;
  buf.writeUInt8(0, offset);           // reserved
  offset += 1;
  buf.writeUInt16LE(1, offset);        // color planes
  offset += 2;
  buf.writeUInt16LE(bpp, offset);      // bits per pixel
  offset += 2;
  buf.writeUInt32LE(imageDataSize, offset);  // size of image data
  offset += 4;
  buf.writeUInt32LE(dataOffset, offset);     // offset to image data
  offset += 4;

  // --- BITMAPINFOHEADER ---
  buf.writeUInt32LE(bmpHeaderSize, offset);  // header size
  offset += 4;
  buf.writeInt32LE(width, offset);           // width
  offset += 4;
  buf.writeInt32LE(height * 2, offset);      // height (doubled for ICO: XOR + AND)
  offset += 4;
  buf.writeUInt16LE(1, offset);              // planes
  offset += 2;
  buf.writeUInt16LE(bpp, offset);            // bits per pixel
  offset += 2;
  buf.writeUInt32LE(0, offset);              // compression (none)
  offset += 4;
  buf.writeUInt32LE(pixelDataSize + andMaskSize, offset); // image size
  offset += 4;
  buf.writeInt32LE(0, offset);               // X pixels per meter
  offset += 4;
  buf.writeInt32LE(0, offset);               // Y pixels per meter
  offset += 4;
  buf.writeUInt32LE(0, offset);              // colors used
  offset += 4;
  buf.writeUInt32LE(0, offset);              // important colors
  offset += 4;

  // --- Pixel data (BGRA, bottom-to-top) ---
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const px = pixels[y][x];
      buf.writeUInt8(px.b, offset);     // Blue
      offset += 1;
      buf.writeUInt8(px.g, offset);     // Green
      offset += 1;
      buf.writeUInt8(px.r, offset);     // Red
      offset += 1;
      buf.writeUInt8(px.a, offset);     // Alpha
      offset += 1;
    }
  }

  // --- AND mask (all 0 = fully opaque, since we use alpha channel) ---
  // bottom-to-top order, each row padded to 4-byte boundary
  for (let y = height - 1; y >= 0; y--) {
    for (let i = 0; i < andRowPadded; i++) {
      buf.writeUInt8(0, offset);
      offset += 1;
    }
  }

  return buf;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const outputDir = path.join(__dirname, '..', 'assets');
const outputPath = path.join(outputDir, 'icon.ico');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Drawing 32x32 icon with lightning bolt...');
const pixels = drawIcon();

console.log('Encoding ICO file...');
const icoBuffer = encodeICO(pixels);

fs.writeFileSync(outputPath, icoBuffer);
console.log(`Icon written to ${outputPath} (${icoBuffer.length} bytes)`);
