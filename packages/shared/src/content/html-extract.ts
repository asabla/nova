import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { htmlToMarkdown } from "./html-to-markdown.js";
import type { ExtractedContent } from "./types.js";

const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB cap

function extractMeta(doc: Document, name: string): string | null {
  const el =
    doc.querySelector(`meta[property="${name}"]`) ??
    doc.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute("content") ?? null;
}

function fallbackClean(doc: Document): string {
  // Remove non-content tags
  for (const tag of ["script", "style", "nav", "footer", "header", "aside", "noscript"]) {
    for (const el of doc.querySelectorAll(tag)) {
      el.remove();
    }
  }
  const body = doc.querySelector("body");
  return body ? body.innerHTML : doc.documentElement?.innerHTML ?? "";
}

export function extractFromHtml(html: string, url?: string): ExtractedContent {
  // Cap input size
  if (html.length > MAX_HTML_SIZE) {
    html = html.slice(0, MAX_HTML_SIZE);
  }

  const { document } = parseHTML(html);

  // Extract metadata from <head>
  const ogTitle = extractMeta(document, "og:title");
  const metaTitle = ogTitle ?? document.querySelector("title")?.textContent ?? null;
  const description =
    extractMeta(document, "og:description") ??
    extractMeta(document, "description");
  const byline =
    extractMeta(document, "author") ??
    extractMeta(document, "article:author");
  const publishedDate =
    extractMeta(document, "article:published_time") ??
    extractMeta(document, "date");
  const language =
    document.documentElement?.getAttribute("lang") ??
    extractMeta(document, "og:locale") ??
    null;
  const siteName = extractMeta(document, "og:site_name");

  // Try Readability for main content extraction
  let contentHtml: string;
  let readabilityTitle: string | null = null;

  // Readability mutates the DOM, so clone for it
  const clonedHtml = html.slice(0, MAX_HTML_SIZE);
  let article: ReturnType<Readability["parse"]> = null;

  // Only run Readability if we have a valid document with content
  if (clonedHtml.trim().length > 0) {
    try {
      const { document: cloneDoc } = parseHTML(clonedHtml);
      if (url) {
        const base = cloneDoc.createElement("base");
        base.setAttribute("href", url);
        cloneDoc.head?.appendChild(base);
      }
      const reader = new Readability(cloneDoc as any);
      article = reader.parse();
    } catch {
      // Readability failed (e.g., empty/invalid document) — use fallback
    }
  }

  if (article && article.content && (article.textContent ?? "").trim().length > 50) {
    contentHtml = article.content;
    readabilityTitle = article.title ?? null;
  } else {
    // Fallback: strip non-content tags from original document
    contentHtml = fallbackClean(document);
  }

  const markdown = htmlToMarkdown(contentHtml);
  const textContent = markdown.replace(/[#*`\[\]()>|_~-]/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  const title = readabilityTitle ?? metaTitle;

  return {
    title,
    byline,
    publishedDate,
    description,
    language,
    siteName,
    markdown,
    textContent,
    wordCount,
    sourceUrl: url,
  };
}
