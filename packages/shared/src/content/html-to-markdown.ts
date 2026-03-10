import TurndownService from "turndown";
// @ts-ignore — turndown-plugin-gfm has no type declarations
import { gfm } from "turndown-plugin-gfm";

let cached: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (cached) return cached;

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    hr: "---",
  });

  td.use(gfm);

  // Preserve language class on fenced code blocks
  td.addRule("fencedCodeWithLang", {
    filter(node) {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content, node) {
      const codeEl = (node as HTMLElement).querySelector("code");
      if (!codeEl) return _content;
      const className = codeEl.getAttribute("class") ?? "";
      const langMatch = className.match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : "";
      const code = codeEl.textContent ?? "";
      return `\n\n\`\`\`${lang}\n${code.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  cached = td;
  return td;
}

export function htmlToMarkdown(html: string): string {
  const td = getTurndown();
  let md = td.turndown(html);

  // Collapse excessive blank lines (3+ → 2)
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}
