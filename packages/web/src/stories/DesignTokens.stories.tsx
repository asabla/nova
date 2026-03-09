import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { clsx } from "clsx";
import { Copy, Check } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";

const meta: Meta = {
  title: "NOVA/DesignTokens",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

// ── Helpers ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-surface-tertiary text-text-tertiary hover:text-text transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function TokenRow({ name, cssVar, tailwind, preview }: { name: string; cssVar: string; tailwind: string; preview: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-2 px-3 rounded-lg hover:bg-surface-secondary/50 transition-colors">
      <div className="w-10 h-10 rounded-lg border border-border overflow-hidden shrink-0 flex items-center justify-center">
        {preview}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text">{name}</p>
        <p className="text-[10px] font-mono text-text-tertiary truncate">{cssVar}</p>
      </div>
      <code className="text-[10px] font-mono text-text-secondary bg-surface-tertiary px-1.5 py-0.5 rounded shrink-0">
        {tailwind}
      </code>
      <CopyButton text={tailwind} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-text mb-3 mt-6 first:mt-0">{children}</h3>
  );
}

// ── Stories ───────────────────────────────────────────────────────────────

/** Complete design token reference with all CSS custom properties */
export const Colors: Story = {
  render: () => (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-text mb-1">Color Tokens</h2>
      <p className="text-sm text-text-secondary mb-6">
        All colors use oklch color space for perceptual uniformity. Tokens adapt between light and dark themes.
      </p>

      <SectionTitle>Primary</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Primary" cssVar="--color-primary" tailwind="bg-primary" preview={<div className="w-full h-full bg-primary" />} />
        <TokenRow name="Primary Light" cssVar="--color-primary-light" tailwind="bg-primary-light" preview={<div className="w-full h-full bg-primary-light" />} />
        <TokenRow name="Primary Dark" cssVar="--color-primary-dark" tailwind="bg-primary-dark" preview={<div className="w-full h-full bg-primary-dark" />} />
        <TokenRow name="Primary Foreground" cssVar="--color-primary-foreground" tailwind="text-primary-foreground" preview={<div className="w-full h-full bg-primary flex items-center justify-center"><span className="text-primary-foreground text-[10px] font-bold">Aa</span></div>} />
      </div>

      <SectionTitle>Accent</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Accent" cssVar="--color-accent" tailwind="bg-accent" preview={<div className="w-full h-full bg-accent" />} />
        <TokenRow name="Accent Muted" cssVar="--color-accent-muted" tailwind="bg-accent-muted" preview={<div className="w-full h-full bg-accent-muted" />} />
      </div>

      <SectionTitle>Surfaces</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Surface" cssVar="--color-surface" tailwind="bg-surface" preview={<div className="w-full h-full bg-surface border border-border" />} />
        <TokenRow name="Surface Secondary" cssVar="--color-surface-secondary" tailwind="bg-surface-secondary" preview={<div className="w-full h-full bg-surface-secondary" />} />
        <TokenRow name="Surface Tertiary" cssVar="--color-surface-tertiary" tailwind="bg-surface-tertiary" preview={<div className="w-full h-full bg-surface-tertiary" />} />
      </div>

      <SectionTitle>Borders</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Border" cssVar="--color-border" tailwind="border-border" preview={<div className="w-full h-full border-2 border-border rounded" />} />
        <TokenRow name="Border Strong" cssVar="--color-border-strong" tailwind="border-border-strong" preview={<div className="w-full h-full border-2 border-border-strong rounded" />} />
      </div>

      <SectionTitle>Text</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Text" cssVar="--color-text" tailwind="text-text" preview={<div className="flex items-center justify-center w-full h-full bg-surface"><span className="text-text text-sm font-bold">Aa</span></div>} />
        <TokenRow name="Text Secondary" cssVar="--color-text-secondary" tailwind="text-text-secondary" preview={<div className="flex items-center justify-center w-full h-full bg-surface"><span className="text-text-secondary text-sm font-bold">Aa</span></div>} />
        <TokenRow name="Text Tertiary" cssVar="--color-text-tertiary" tailwind="text-text-tertiary" preview={<div className="flex items-center justify-center w-full h-full bg-surface"><span className="text-text-tertiary text-sm font-bold">Aa</span></div>} />
      </div>

      <SectionTitle>Status</SectionTitle>
      <div className="space-y-0.5">
        <TokenRow name="Success" cssVar="--color-success" tailwind="text-success" preview={<div className="w-full h-full bg-success" />} />
        <TokenRow name="Warning" cssVar="--color-warning" tailwind="text-warning" preview={<div className="w-full h-full bg-warning" />} />
        <TokenRow name="Danger" cssVar="--color-danger" tailwind="text-danger" preview={<div className="w-full h-full bg-danger" />} />
      </div>
    </div>
  ),
};

/** Typography tokens and scale */
export const Typography: Story = {
  render: () => (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-text mb-1">Typography</h2>
      <p className="text-sm text-text-secondary mb-6">
        NOVA uses DM Sans for body and display text, JetBrains Mono for code.
      </p>

      <SectionTitle>Font Families</SectionTitle>
      <div className="space-y-3 mb-6">
        <div className="p-4 rounded-xl border border-border">
          <p className="text-[10px] font-mono text-text-tertiary mb-1">font-sans / font-display</p>
          <p className="text-2xl font-sans text-text">DM Sans — The quick brown fox jumps over the lazy dog</p>
          <p className="text-[10px] text-text-tertiary mt-1">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
        </div>
        <div className="p-4 rounded-xl border border-border">
          <p className="text-[10px] font-mono text-text-tertiary mb-1">font-mono</p>
          <p className="text-2xl font-mono text-text">JetBrains Mono — The quick brown fox</p>
          <p className="text-[10px] font-mono text-text-tertiary mt-1">const x = () =&gt; fn(42); // ligatures: != === =&gt;</p>
        </div>
      </div>

      <SectionTitle>Type Scale</SectionTitle>
      <div className="space-y-2">
        {[
          { class: "text-2xl font-bold", label: "text-2xl bold", sample: "Page Title" },
          { class: "text-xl font-bold", label: "text-xl bold", sample: "Section Heading" },
          { class: "text-lg font-semibold", label: "text-lg semibold", sample: "Card Title" },
          { class: "text-base", label: "text-base", sample: "Body text — the standard for paragraphs and content." },
          { class: "text-sm", label: "text-sm", sample: "Small body — descriptions, secondary content, and labels." },
          { class: "text-xs", label: "text-xs", sample: "Caption — timestamps, metadata, and helper text." },
          { class: "text-[10px]", label: "text-[10px]", sample: "Micro — badge labels, status indicators, and compact UI." },
        ].map((t) => (
          <div key={t.label} className="flex items-baseline gap-4 py-2">
            <code className="text-[10px] font-mono text-text-tertiary w-36 shrink-0">{t.label}</code>
            <p className={clsx("text-text", t.class)}>{t.sample}</p>
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Spacing and sizing scale */
export const Spacing: Story = {
  render: () => (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-text mb-1">Spacing Scale</h2>
      <p className="text-sm text-text-secondary mb-6">
        Standard Tailwind spacing scale. Common patterns in NOVA:
      </p>

      <div className="space-y-1">
        {[
          { name: "0.5", px: "2px", usage: "Tight gaps between icons" },
          { name: "1", px: "4px", usage: "Badge padding, micro gaps" },
          { name: "1.5", px: "6px", usage: "Compact button padding" },
          { name: "2", px: "8px", usage: "Standard inline gaps, input padding" },
          { name: "3", px: "12px", usage: "Card inner padding, list item padding" },
          { name: "4", px: "16px", usage: "Section padding, standard spacing" },
          { name: "6", px: "24px", usage: "Content area padding, larger sections" },
          { name: "8", px: "32px", usage: "Page padding, large gaps" },
          { name: "12", px: "48px", usage: "Hero sections, empty states" },
          { name: "16", px: "64px", usage: "Page-level vertical spacing" },
        ].map((s) => (
          <div key={s.name} className="flex items-center gap-4 py-1.5 px-3 rounded-lg hover:bg-surface-secondary/50">
            <code className="text-[10px] font-mono text-text-secondary w-8">{s.name}</code>
            <code className="text-[10px] font-mono text-text-tertiary w-10">{s.px}</code>
            <div className="w-40">
              <div
                className="h-4 bg-primary/20 rounded-sm"
                style={{ width: s.px === "2px" ? "2px" : undefined, minWidth: s.px }}
              />
            </div>
            <span className="text-[10px] text-text-tertiary">{s.usage}</span>
          </div>
        ))}
      </div>

      <SectionTitle>Border Radius</SectionTitle>
      <div className="flex gap-4 mt-3">
        {[
          { name: "rounded-sm", radius: "2px" },
          { name: "rounded", radius: "4px" },
          { name: "rounded-md", radius: "6px" },
          { name: "rounded-lg", radius: "8px" },
          { name: "rounded-xl", radius: "12px" },
          { name: "rounded-2xl", radius: "16px" },
          { name: "rounded-full", radius: "9999px" },
        ].map((r) => (
          <div key={r.name} className="text-center">
            <div className={clsx("h-12 w-12 bg-primary/20 border border-primary/30 mx-auto mb-1", r.name)} />
            <code className="text-[9px] font-mono text-text-tertiary">{r.name}</code>
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Light vs Dark token comparison */
export const LightDarkComparison: Story = {
  render: () => {
    const tokens = [
      { name: "Primary", light: "oklch(0.55 0.22 268)", dark: "oklch(0.70 0.18 268)", class: "bg-primary" },
      { name: "Surface", light: "oklch(0.995 0.003 90)", dark: "oklch(0.155 0.012 275)", class: "bg-surface" },
      { name: "Surface 2°", light: "oklch(0.975 0.004 85)", dark: "oklch(0.195 0.014 275)", class: "bg-surface-secondary" },
      { name: "Surface 3°", light: "oklch(0.95 0.005 80)", dark: "oklch(0.235 0.016 275)", class: "bg-surface-tertiary" },
      { name: "Border", light: "oklch(0.91 0.006 80)", dark: "oklch(0.29 0.015 275)", class: "bg-border" },
      { name: "Text", light: "oklch(0.16 0.015 280)", dark: "oklch(0.94 0.005 80)", class: "bg-text" },
      { name: "Text 2°", light: "oklch(0.44 0.01 270)", dark: "oklch(0.68 0.006 70)", class: "bg-text-secondary" },
      { name: "Success", light: "oklch(0.627 0.194 149)", dark: "oklch(0.72 0.194 149)", class: "bg-success" },
      { name: "Warning", light: "oklch(0.769 0.188 70)", dark: "oklch(0.82 0.16 70)", class: "bg-warning" },
      { name: "Danger", light: "oklch(0.577 0.245 27)", dark: "oklch(0.68 0.2 27)", class: "bg-danger" },
    ];

    return (
      <div className="max-w-4xl">
        <h2 className="text-lg font-semibold text-text mb-1">Light ↔ Dark Token Comparison</h2>
        <p className="text-sm text-text-secondary mb-6">
          Side-by-side oklch values for each token in both themes.
        </p>

        <div className="rounded-xl border border-border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-surface-tertiary/50">
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Token</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Light Swatch</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Light Value</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Dark Swatch</TableHead>
                <TableHead className="px-4 py-2.5 text-xs font-medium text-text-tertiary">Dark Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {tokens.map((t) => (
                <TableRow key={t.name}>
                  <TableCell className="px-4 py-2.5 font-medium text-text">{t.name}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div data-theme="light" className="inline-block">
                      <div className={clsx("h-6 w-12 rounded border border-neutral-200", t.class)} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <code className="text-[10px] font-mono text-text-tertiary">{t.light}</code>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div data-theme="dark" className="inline-block">
                      <div className={clsx("h-6 w-12 rounded border border-neutral-700", t.class)} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <code className="text-[10px] font-mono text-text-tertiary">{t.dark}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  },
};
