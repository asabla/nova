import { describe, it, expect } from "bun:test";
import { decodeBuffer } from "../src/utils/encoding";

describe("decodeBuffer", () => {
  it("passes through valid UTF-8", () => {
    const buf = Buffer.from("Hello, world! Héllo café", "utf-8");
    expect(decodeBuffer(buf)).toBe("Hello, world! Héllo café");
  });

  it("strips UTF-8 BOM", () => {
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const text = Buffer.from("Hello BOM", "utf-8");
    const buf = Buffer.concat([bom, text]);
    expect(decodeBuffer(buf)).toBe("Hello BOM");
  });

  it("detects and decodes Latin-1 / ISO-8859-1", () => {
    // "café" in Latin-1: c=0x63, a=0x61, f=0x66, é=0xE9
    const buf = Buffer.from([0x63, 0x61, 0x66, 0xe9]);
    const result = decodeBuffer(buf, { contentType: "text/plain; charset=iso-8859-1" });
    expect(result).toBe("café");
  });

  it("decodes Windows-1252 smart quotes via content-type", () => {
    // Windows-1252: left double quote=0x93, right double quote=0x94
    const buf = Buffer.from([0x93, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x94]);
    const result = decodeBuffer(buf, { contentType: "text/plain; charset=windows-1252" });
    expect(result).toBe("\u201Chello\u201D");
  });

  it("decodes UTF-16LE with BOM", () => {
    // UTF-16LE BOM followed by "Hi"
    const bom = Buffer.from([0xff, 0xfe]);
    const text = Buffer.from("Hi", "utf16le");
    const buf = Buffer.concat([bom, text]);
    expect(decodeBuffer(buf)).toBe("Hi");
  });

  it("decodes UTF-16BE with BOM", () => {
    // UTF-16BE BOM followed by "AB" (0x00 0x41 0x00 0x42)
    const buf = Buffer.from([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]);
    expect(decodeBuffer(buf)).toBe("AB");
  });

  it("uses Content-Type charset override", () => {
    // Bytes that would be garbled as UTF-8 but valid as windows-1252
    const buf = Buffer.from([0x93, 0x68, 0x69, 0x94]); // "hi" in smart quotes
    const result = decodeBuffer(buf, { contentType: "text/html; charset=windows-1252" });
    expect(result).toBe("\u201Chi\u201D");
  });

  it("detects HTML <meta charset>", () => {
    // Latin-1 encoded HTML with meta charset
    const htmlBytes = Buffer.from(
      '<html><head><meta charset="iso-8859-1"></head><body>caf\xe9</body></html>',
      "binary",
    );
    const result = decodeBuffer(htmlBytes, { isHtml: true });
    expect(result).toContain("café");
  });

  it("detects HTML <meta http-equiv> charset", () => {
    const htmlBytes = Buffer.from(
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"></head><body>caf\xe9</body></html>',
      "binary",
    );
    const result = decodeBuffer(htmlBytes, { isHtml: true });
    expect(result).toContain("café");
  });

  it("returns empty string for empty buffer", () => {
    expect(decodeBuffer(Buffer.alloc(0))).toBe("");
  });

  it("passes through pure ASCII", () => {
    const buf = Buffer.from("Just plain ASCII text 123!@#");
    expect(decodeBuffer(buf)).toBe("Just plain ASCII text 123!@#");
  });

  it("accepts Uint8Array input", () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(decodeBuffer(arr)).toBe("Hello");
  });

  it("strips null bytes from decoded output", () => {
    const buf = Buffer.from("Hello\0World\0", "utf-8");
    expect(decodeBuffer(buf)).toBe("HelloWorld");
  });

  it("falls back to UTF-8 with replacement for unknown encoding", () => {
    // Invalid UTF-8 byte sequence without any charset hint
    const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0xfe, 0xff]);
    const result = decodeBuffer(buf);
    // Should not throw, may contain replacement characters
    expect(result).toContain("Hello");
  });
});
