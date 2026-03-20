import jschardet from "jschardet";

/**
 * Strip null bytes from a string. PostgreSQL text columns reject \0.
 */
export function stripNullBytes(text: string): string {
  return text.includes("\0") ? text.replaceAll("\0", "") : text;
}

export interface DecodeBufferOptions {
  /** Content-Type header value, e.g. "text/html; charset=windows-1252" */
  contentType?: string;
  /** Hint that content is HTML — enables <meta charset> detection */
  isHtml?: boolean;
}

/**
 * Encoding name mapping from jschardet / common names to WHATWG TextDecoder labels.
 * See https://encoding.spec.whatwg.org/#names-and-labels
 */
const ENCODING_MAP: Record<string, string> = {
  "ascii": "utf-8",
  "us-ascii": "utf-8",
  "iso-8859-1": "windows-1252", // WHATWG maps ISO-8859-1 to windows-1252
  "iso8859-1": "windows-1252",
  "latin-1": "windows-1252",
  "latin1": "windows-1252",
  "iso-8859-2": "iso-8859-2",
  "iso-8859-15": "iso-8859-15",
  "windows-1252": "windows-1252",
  "cp1252": "windows-1252",
  "windows-1251": "windows-1251",
  "cp1251": "windows-1251",
  "utf-8": "utf-8",
  "utf8": "utf-8",
  "utf-16le": "utf-16le",
  "utf-16be": "utf-16be",
  "shift_jis": "shift_jis",
  "shift-jis": "shift_jis",
  "euc-jp": "euc-jp",
  "euc-kr": "euc-kr",
  "gb2312": "gb18030",
  "gbk": "gb18030",
  "gb18030": "gb18030",
  "big5": "big5",
  "koi8-r": "koi8-r",
  "macintosh": "macintosh",
  "ibm866": "ibm866",
};

function normalizeEncoding(name: string): string {
  const key = name.toLowerCase().trim().replace(/[^a-z0-9-]/g, "");
  // Try direct lookup first, then with dashes removed
  return ENCODING_MAP[name.toLowerCase().trim()] ?? ENCODING_MAP[key] ?? name.toLowerCase().trim();
}

function parseCharsetFromContentType(contentType: string): string | null {
  const match = contentType.match(/charset\s*=\s*"?([^";,\s]+)"?/i);
  return match ? match[1] : null;
}

function parseCharsetFromHtmlMeta(bytes: Uint8Array): string | null {
  // Peek at first 1024 bytes as ASCII to find meta charset
  const peek = new TextDecoder("ascii", { fatal: false }).decode(bytes.slice(0, 1024));

  // <meta charset="...">
  const charsetMatch = peek.match(/<meta\s+charset\s*=\s*"?([^"'>;\s]+)"?\s*\/?>/i);
  if (charsetMatch) return charsetMatch[1];

  // <meta http-equiv="Content-Type" content="text/html; charset=...">
  const httpEquivMatch = peek.match(
    /<meta\s+http-equiv\s*=\s*"?Content-Type"?\s+content\s*=\s*"?[^"]*charset\s*=\s*([^"';,\s]+)/i,
  );
  if (httpEquivMatch) return httpEquivMatch[1];

  return null;
}

/**
 * Decode a buffer to string with automatic charset detection.
 *
 * Detection priority:
 * 1. BOM (UTF-8, UTF-16LE, UTF-16BE)
 * 2. Content-Type charset parameter
 * 3. HTML <meta charset> (when isHtml or content-type is html)
 * 4. jschardet auto-detection (confidence ≥ 0.7)
 * 5. UTF-8 fallback (replaces invalid bytes with U+FFFD)
 */
export function decodeBuffer(buffer: Buffer | Uint8Array, options?: DecodeBufferOptions): string {
  if (buffer.length === 0) return "";

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let encoding: string | null = null;
  let bomLength = 0;

  // 1. BOM detection
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = "utf-8";
    bomLength = 3;
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    bomLength = 2;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    bomLength = 2;
  }

  // 2. Content-Type charset
  if (!encoding && options?.contentType) {
    const charset = parseCharsetFromContentType(options.contentType);
    if (charset) encoding = normalizeEncoding(charset);
  }

  // 3. HTML meta charset
  const ct = options?.contentType?.toLowerCase() ?? "";
  const isHtml = options?.isHtml || ct.includes("text/html") || ct.includes("xhtml");
  if (!encoding && isHtml) {
    const metaCharset = parseCharsetFromHtmlMeta(bytes);
    if (metaCharset) encoding = normalizeEncoding(metaCharset);
  }

  // 4. jschardet auto-detection
  if (!encoding) {
    const detected = jschardet.detect(buffer instanceof Buffer ? buffer : Buffer.from(buffer));
    if (detected.confidence >= 0.7 && detected.encoding) {
      encoding = normalizeEncoding(detected.encoding);
    }
  }

  // 5. UTF-8 fallback
  if (!encoding) encoding = "utf-8";

  const sliced = bomLength > 0 ? bytes.slice(bomLength) : bytes;

  let result: string;
  try {
    result = new TextDecoder(encoding, { fatal: false }).decode(sliced);
  } catch {
    // If the encoding label is not supported by TextDecoder, fall back to UTF-8
    result = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
  }

  // Strip null bytes — PostgreSQL text columns reject \0
  if (result.includes("\0")) {
    result = result.replaceAll("\0", "");
  }

  return result;
}
