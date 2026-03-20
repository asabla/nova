#!/usr/bin/env node

/**
 * Convert mermaid diagram syntax to Excalidraw scene JSON.
 *
 * Usage:
 *   node mermaid-to-excalidraw.js "graph TD; A-->B; B-->C"
 *   echo "graph TD; A-->B" | node mermaid-to-excalidraw.js
 *
 * Output: Excalidraw scene JSON written to stdout.
 */

const { parseMermaidToExcalidraw } = require("@excalidraw/mermaid-to-excalidraw");

async function main() {
  let mermaidCode = process.argv.slice(2).join(" ").trim();

  // If no argument, read from stdin
  if (!mermaidCode) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    mermaidCode = Buffer.concat(chunks).toString("utf-8").trim();
  }

  if (!mermaidCode) {
    console.error("Usage: mermaid-to-excalidraw.js <mermaid-code>");
    console.error('  or: echo "graph TD; A-->B" | mermaid-to-excalidraw.js');
    process.exit(1);
  }

  try {
    const { elements, files } = await parseMermaidToExcalidraw(mermaidCode, {
      fontSize: 16,
    });

    const scene = {
      type: "excalidraw",
      version: 2,
      elements: elements || [],
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: null,
      },
      files: files || {},
    };

    process.stdout.write(JSON.stringify(scene, null, 2));
  } catch (err) {
    console.error("Failed to convert mermaid to Excalidraw:", err.message);
    process.exit(1);
  }
}

main();
