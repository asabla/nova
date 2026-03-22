/**
 * Minimal tar archive create/extract for Docker archive API.
 * Handles POSIX ustar format — no npm dependency needed.
 */

export interface TarEntry {
  name: string;
  data: Buffer;
}

function writeTarHeader(name: string, size: number, typeflag: string): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name.slice(0, 99), 0, "utf-8");
  header.write(typeflag === "5" ? "0000755\0" : "0000644\0", 100, "utf-8");
  header.write("0001000\0", 108, "utf-8");
  header.write("0001000\0", 116, "utf-8");
  header.write(size.toString(8).padStart(11, "0") + " ", 124, "utf-8");
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, "0") + " ", 136, "utf-8");
  header.write(typeflag, 156, "utf-8");
  header.write("ustar\0", 257, "utf-8");
  header.write("00", 263, "utf-8");

  // Compute checksum with checksum field as spaces
  header.fill(0x20, 148, 156);
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "utf-8");

  return header;
}

/** Create a tar archive from a list of files. */
export function createTar(entries: TarEntry[]): Buffer {
  const blocks: Buffer[] = [];

  // Auto-create directory entries for any nested paths
  const dirs = new Set<string>();
  for (const entry of entries) {
    const parts = entry.name.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/") + "/";
      if (!dirs.has(dir)) {
        dirs.add(dir);
        blocks.push(writeTarHeader(dir, 0, "5")); // '5' = directory
      }
    }
  }

  for (const entry of entries) {
    blocks.push(writeTarHeader(entry.name, entry.data.length, "0"));

    // File data, padded to 512-byte boundary
    blocks.push(entry.data);
    const padding = (512 - (entry.data.length % 512)) % 512;
    if (padding > 0) blocks.push(Buffer.alloc(padding, 0));
  }

  // End-of-archive: two 512-byte zero blocks
  blocks.push(Buffer.alloc(1024, 0));

  return Buffer.concat(blocks);
}

/** Extract files from a tar archive. */
export function extractTar(tar: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);

    // Check for end-of-archive (all zeros)
    if (header.every((b) => b === 0)) break;

    // name (0, 100) — null-terminated
    const nameEnd = header.indexOf(0, 0);
    const name = header.subarray(0, Math.min(nameEnd >= 0 ? nameEnd : 100, 100)).toString("utf-8");

    // size (124, 12) — octal, space/null terminated
    const sizeStr = header.subarray(124, 136).toString("utf-8").replace(/[\0 ]/g, "");
    const size = parseInt(sizeStr, 8) || 0;

    // typeflag (156, 1)
    const typeflag = String.fromCharCode(header[156]);

    offset += 512;

    if ((typeflag === "0" || typeflag === "\0") && size > 0 && name) {
      const data = Buffer.from(tar.subarray(offset, offset + size));
      entries.push({ name, data });
    }

    // Advance past data + padding
    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}
