import { describe, it, expect } from "bun:test";
import { isLikelyGarbledText } from "../src/activities/document-ingestion.activities";

describe("isLikelyGarbledText", () => {
  it("returns false for real English text", () => {
    const text =
      "The quick brown fox jumps over the lazy dog. This is a perfectly normal sentence with regular words and punctuation.";
    expect(isLikelyGarbledText(text)).toBe(false);
  });

  it("returns false for real Swedish text", () => {
    const text =
      "Det här är en helt vanlig svensk text med åäö. Företaget grundades år 1985 och har sedan dess växt till att bli ett av de största i branschen. Möjligheterna är många och utmaningarna stora.";
    expect(isLikelyGarbledText(text)).toBe(false);
  });

  it("detects CMap-garbled text from failing PDF", () => {
    const text =
      "ANJEÅPHMF PLDP M:SSEÅP:ANJ CRNLHMFÄPH BGPJKHRSÄ ANJEÅPHMF ÅP DS RBKM :S BMGÄ DMPDSÄHDS ÄJNMNLHRBÄ SQÄMRHBJSHNMDP NVG GÄMDÄKRDP";
    expect(isLikelyGarbledText(text)).toBe(true);
  });

  it("returns false for short text (<50 chars)", () => {
    expect(isLikelyGarbledText("ABCDEF")).toBe(false);
    expect(isLikelyGarbledText("Short text here")).toBe(false);
  });

  it("returns false for legitimate all-caps headings mixed with body text", () => {
    const text =
      "INTRODUCTION This document describes the process of setting up a new development environment. You will need to install several tools and configure your system properly. The steps below guide you through each requirement in detail.";
    expect(isLikelyGarbledText(text)).toBe(false);
  });

  it("detects text with abnormally long average word length", () => {
    const text = Array(20)
      .fill("ABCDEFGHIJKLMNOPQRST")
      .join(" ");
    expect(isLikelyGarbledText(text)).toBe(true);
  });

  it("detects text with excessive consonant clusters", () => {
    const text =
      "PHMFBCRL SSEÅPANJK CRNLHMFP BGPJKHRS DMPDSÄHDS SQÄMRHBJT GÄMDÄKRSD ANJEÅPHMF RBKMDSJNK PLDPHJRSQ ÄJNLHMFRB DMPDSQÄNR";
    expect(isLikelyGarbledText(text)).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isLikelyGarbledText("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isLikelyGarbledText("   \n\t  ")).toBe(false);
  });
});
