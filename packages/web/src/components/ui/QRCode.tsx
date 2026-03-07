import { useMemo } from "react";

/**
 * Minimal QR code generator component.
 * Generates QR codes client-side as SVG to avoid sending secrets to external services.
 * Supports alphanumeric mode with error correction level M.
 */

// QR Code generation utilities (subset for otpauth URIs)
// Uses byte mode encoding with ECC level M

const EC_LEVEL_M = 0;

// Version capacities for byte mode, ECC M (data codewords)
const VERSION_CAPACITY = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216, 254, 290, 334, 365, 415, 453, 507, 563, 627, 669];

// Error correction codewords per block for ECC M
const EC_CODEWORDS = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 28];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 4, 6, 6, 8, 8, 8, 8, 10, 10, 12, 12, 12];

function getVersion(dataLen: number): number {
  for (let v = 1; v <= 20; v++) {
    if (dataLen <= VERSION_CAPACITY[v]) return v;
  }
  return 20;
}

function getSize(version: number): number {
  return version * 4 + 17;
}

// GF(256) arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x & 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen: number[] = new Array(ecLen + 1).fill(0);
  gen[0] = 1;
  for (let i = 0; i < ecLen; i++) {
    for (let j = i + 1; j >= 1; j--) {
      gen[j] = gen[j - 1] ^ gfMul(gen[j], GF_EXP[i]);
    }
    gen[0] = gfMul(gen[0], GF_EXP[i]);
  }

  const result = new Array(ecLen).fill(0);
  for (const byte of data) {
    const coef = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let j = 0; j < ecLen; j++) {
      result[j] ^= gfMul(gen[ecLen - 1 - j], coef);
    }
  }
  return result;
}

function encodeData(text: string, version: number): number[] {
  const bytes = new TextEncoder().encode(text);
  const totalDataCW = VERSION_CAPACITY[version];

  // Mode indicator (4 bits: 0100 = byte mode)
  // Character count indicator (8 bits for versions 1-9, 16 for 10+)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  const ccLen = version <= 9 ? 8 : 16;
  pushBits(bytes.length, ccLen);

  for (const b of bytes) pushBits(b, 8);

  // Terminator
  const totalBits = totalDataCW * 8;
  const termLen = Math.min(4, totalBits - bits.length);
  pushBits(0, termLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < totalDataCW) {
    codewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  return codewords;
}

function generateQR(text: string): boolean[][] {
  const version = getVersion(new TextEncoder().encode(text).length);
  const size = getSize(version);
  const modules: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  // Place finder patterns
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c;
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
        reserved[mr][mc] = true;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          modules[mr][mc] =
            r === 0 || r === 6 || c === 0 || c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0;
    modules[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Alignment patterns (for version >= 2)
  if (version >= 2) {
    const positions = getAlignmentPositions(version);
    for (const row of positions) {
      for (const col of positions) {
        if (reserved[row]?.[col]) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const mr = row + r, mc = col + c;
            if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
              reserved[mr][mc] = true;
              modules[mr][mc] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            }
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[8][size - 1 - i] = true;
    reserved[i][8] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[8][8] = true;
  // Dark module
  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Version info (version >= 7)
  if (version >= 7) {
    const versionBits = getVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (versionBits >> i) & 1;
      const r = Math.floor(i / 3);
      const c = i % 3;
      modules[size - 11 + c][r] = bit === 1;
      reserved[size - 11 + c][r] = true;
      modules[r][size - 11 + c] = bit === 1;
      reserved[r][size - 11 + c] = true;
    }
  }

  // Encode and place data
  const dataCW = encodeData(text, version);
  const ecLen = EC_CODEWORDS[version];
  const numBlocks = NUM_BLOCKS[version];
  const blockSize = Math.floor(dataCW.length / numBlocks);
  const remainder = dataCW.length % numBlocks;

  // Split into blocks and generate EC
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const bSize = blockSize + (b < remainder ? 1 : 0);
    const block = dataCW.slice(offset, offset + bSize);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecLen));
    offset += bSize;
  }

  // Interleave
  const finalData: number[] = [];
  const maxBlockLen = blockSize + (remainder > 0 ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalData.push(block[i]);
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (const block of ecBlocks) {
      finalData.push(block[i]);
    }
  }

  // Place data bits
  const dataBits: number[] = [];
  for (const byte of finalData) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (c < 0 || c >= size) continue;
        if (reserved[row][c]) continue;
        modules[row][c] = bitIdx < dataBits.length ? dataBits[bitIdx] === 1 : false;
        bitIdx++;
      }
    }
    upward = !upward;
  }

  // Apply mask 0 (checkerboard) and format info
  applyMask(modules, reserved, size);
  placeFormatInfo(modules, size);

  return modules;
}

function applyMask(modules: boolean[][], reserved: boolean[][], size: number) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) {
        modules[r][c] = !modules[r][c];
      }
    }
  }
}

function placeFormatInfo(modules: boolean[][], size: number) {
  // Format info for ECC M, mask 0 = 0b101010000010010
  const formatBits = 0b101010000010010;
  const positions = [
    // Around top-left finder
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    const [r, c] = positions[i];
    modules[r][c] = bit === 1;
  }
  // Right of top-left and below top-left
  const positions2 = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4],
    [8, size - 5], [8, size - 6], [8, size - 7],
    [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8],
    [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ];
  // Reversed bit order for the second set is just the remaining bits
  for (let i = 0; i < positions2.length && i < 15; i++) {
    const bit = (formatBits >> i) & 1;
    const [r, c] = positions2[i];
    modules[r][c] = bit === 1;
  }
}

function getAlignmentPositions(version: number): number[] {
  if (version <= 1) return [];
  const intervals = Math.floor(version / 7) + 1;
  const size = getSize(version);
  const last = size - 7;
  const step = Math.ceil((last - 6) / intervals / 2) * 2;
  const positions = [6];
  for (let pos = last; pos > 6; pos -= step) {
    positions.unshift(pos);
  }
  return positions;
}

function getVersionBits(version: number): number {
  // BCH(18,6) encoding for version info
  let bits = version;
  for (let i = 0; i < 12; i++) {
    if (bits & (1 << (i + 6))) bits ^= 0b1111100100101 << i;
  }
  return (version << 12) | (bits & 0xfff);
}

interface QRCodeProps {
  data: string;
  size?: number;
}

export function QRCode({ data, size = 192 }: QRCodeProps) {
  const modules = useMemo(() => generateQR(data), [data]);
  const qrSize = modules.length;
  const cellSize = size / (qrSize + 8); // 4 cells quiet zone on each side
  const offset = cellSize * 4;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR Code for authenticator setup"
    >
      <rect width={size} height={size} fill="white" />
      {modules.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={offset + c * cellSize}
              y={offset + r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
