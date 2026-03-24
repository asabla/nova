import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../lib/validator";
import type { AppContext } from "../types/context";
import { AppError } from "@nova/shared/utils";
import { domainService } from "../services/domain.service";
import { extractFromHtml } from "@nova/shared/content";

const urlPreviewRoutes = new Hono<AppContext>();

// --- SSRF protection ---

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0/,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^fd/,
  /^localhost$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(hostname));
}

// --- YouTube helpers ---

const YOUTUBE_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
}

// --- HTML meta tag extraction ---

function extractMetaContent(html: string, property: string): string | null {
  // Match both property="" and name="" attributes for og/meta tags
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
  youtubeVideoId: string | null;
}

function extractOpenGraph(html: string, url: string): OgData {
  const ogTitle = extractMetaContent(html, "og:title");
  const ogDescription =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description");
  const ogImage = extractMetaContent(html, "og:image");
  const ogSiteName = extractMetaContent(html, "og:site_name");
  const ogType = extractMetaContent(html, "og:type");

  return {
    title: ogTitle ?? extractTitle(html),
    description: ogDescription,
    image: ogImage,
    siteName: ogSiteName,
    type: ogType,
    youtubeVideoId: extractYouTubeId(url),
  };
}

// --- Route ---

const previewSchema = z.object({
  url: z.string().url(),
});

urlPreviewRoutes.post(
  "/preview",
  zValidator("json", previewSchema),
  async (c) => {
    const { url } = c.req.valid("json");

    // Parse and validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw AppError.badRequest("Invalid URL");
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw AppError.badRequest("Only HTTP and HTTPS URLs are supported");
    }

    // SSRF protection: block private/internal IPs
    if (isPrivateHost(parsed.hostname)) {
      throw AppError.badRequest("URL points to a private or reserved address");
    }

    // Domain whitelist/blacklist check (Story #75)
    const orgId = c.get("orgId");
    if (orgId) {
      const domainCheck = await domainService.checkUrl(orgId, url);
      if (!domainCheck.allowed) {
        const reason = domainCheck.matchedRule?.reason ?? "Domain is blocked by organization policy";
        throw AppError.forbidden(reason);
      }
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent": "NovaBot/1.0 (URL Preview)",
          Accept: "text/html, application/xhtml+xml",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        return c.json(
          {
            error: "upstream_error",
            message: `Failed to fetch URL (HTTP ${response.status})`,
          },
          502,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
        // For non-HTML, return minimal preview
        return c.json({
          url,
          title: parsed.hostname + parsed.pathname,
          description: null,
          image: null,
          siteName: parsed.hostname,
          type: contentType.split(";")[0]?.trim() ?? null,
          youtubeVideoId: extractYouTubeId(url),
        });
      }

      // Read up to 64KB of HTML (enough for <head> section with meta tags)
      const reader = response.body?.getReader();
      if (!reader) {
        return c.json({ error: "no_body", message: "Response has no body" }, 502);
      }

      let html = "";
      const decoder = new TextDecoder();
      const MAX_BYTES = 64 * 1024;
      let bytesRead = 0;

      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value.byteLength;
        // Stop early if we've passed </head>
        if (html.includes("</head>")) break;
      }
      reader.cancel().catch(() => {});

      const og = extractOpenGraph(html, url);

      return c.json({
        url,
        title: og.title,
        description: og.description,
        image: og.image,
        siteName: og.siteName,
        type: og.type,
        youtubeVideoId: og.youtubeVideoId,
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return c.json(
          { error: "timeout", message: "URL fetch timed out" },
          504,
        );
      }
      return c.json(
        { error: "unreachable", message: "Could not reach the URL" },
        502,
      );
    }
  },
);

// --- YouTube Summarization (Story #72) ---

const summarizeSchema = z.object({
  url: z.string().url(),
});

urlPreviewRoutes.post(
  "/summarize",
  zValidator("json", summarizeSchema),
  async (c) => {
    const { url } = c.req.valid("json");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw AppError.badRequest("Invalid URL");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw AppError.badRequest("Only HTTP and HTTPS URLs are supported");
    }

    if (isPrivateHost(parsed.hostname)) {
      throw AppError.badRequest("URL points to a private or reserved address");
    }

    // Domain whitelist/blacklist check (Story #75)
    const orgId = c.get("orgId");
    if (orgId) {
      const domainCheck = await domainService.checkUrl(orgId, url);
      if (!domainCheck.allowed) {
        const reason = domainCheck.matchedRule?.reason ?? "Domain is blocked by organization policy";
        throw AppError.forbidden(reason);
      }
    }

    const youtubeId = extractYouTubeId(url);

    try {
      // Fetch the page content
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent": "NovaBot/1.0 (Content Summarizer)",
          Accept: "text/html, application/xhtml+xml, text/plain",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        return c.json({ error: "Failed to fetch URL" }, 502);
      }

      const contentType = response.headers.get("content-type") ?? "";
      let textContent = "";

      if (contentType.includes("text/html") || contentType.includes("xhtml")) {
        const html = await response.text();
        const extracted = extractFromHtml(html, url);
        const title = extracted.title ?? "";
        textContent = `Title: ${title}\n\n${extracted.markdown.slice(0, 8000)}`;
      } else {
        textContent = (await response.text()).slice(0, 8000);
      }

      // Use LLM to summarize
      const { chatCompletion } = await import("../lib/litellm");
      const prompt = youtubeId
        ? `Summarize this YouTube video page content. Provide a concise summary with key points and takeaways:\n\n${textContent}`
        : `Provide a TL;DR summary of this article. Include the main points, key arguments, and conclusions:\n\n${textContent}`;

      const result = await chatCompletion({
        model: "default",
        messages: [
          { role: "system", content: "You are a concise content summarizer. Provide structured summaries with key takeaways." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
        orgId,
      });

      return c.json({
        url,
        youtubeVideoId: youtubeId,
        summary: result.choices?.[0]?.message?.content ?? "Unable to generate summary",
        model: result.model,
        usage: result.usage,
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return c.json({ error: "timeout", message: "URL fetch timed out" }, 504);
      }
      return c.json({ error: "failed", message: err.message ?? "Summarization failed" }, 500);
    }
  },
);

export { urlPreviewRoutes };
