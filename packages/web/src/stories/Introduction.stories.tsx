import type { Meta, StoryObj } from "@storybook/react-vite";

function DesignSystemOverview() {
  const colors = [
    { name: "Primary", var: "--color-primary", desc: "Rich warm indigo", sample: "bg-primary" },
    { name: "Primary Light", var: "--color-primary-light", desc: "Hover / lighter accent", sample: "bg-primary-light" },
    { name: "Primary Dark", var: "--color-primary-dark", desc: "Active / pressed", sample: "bg-primary-dark" },
    { name: "Accent", var: "--color-accent", desc: "Warm golden highlight", sample: "bg-accent" },
    { name: "Accent Muted", var: "--color-accent-muted", desc: "Subtle golden tint", sample: "bg-accent-muted" },
  ];

  const surfaces = [
    { name: "Surface", var: "--color-surface", sample: "bg-surface" },
    { name: "Surface Secondary", var: "--color-surface-secondary", sample: "bg-surface-secondary" },
    { name: "Surface Tertiary", var: "--color-surface-tertiary", sample: "bg-surface-tertiary" },
  ];

  const status = [
    { name: "Success", sample: "bg-success" },
    { name: "Warning", sample: "bg-warning" },
    { name: "Danger", sample: "bg-danger" },
  ];

  const borders = [
    { name: "Border", sample: "border-border", bg: "bg-surface" },
    { name: "Border Strong", sample: "border-border-strong", bg: "bg-surface" },
  ];

  const textLevels = [
    { name: "Text", sample: "text-text", desc: "Primary content" },
    { name: "Text Secondary", sample: "text-text-secondary", desc: "Supporting content" },
    { name: "Text Tertiary", sample: "text-text-tertiary", desc: "Placeholder / muted" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-16 py-8 px-4">
      {/* Hero */}
      <header className="text-center space-y-6 pb-8 border-b border-border">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wider uppercase">
          Design System
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-text nova-glow">
          NOVA
        </h1>
        <p className="text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
          A meticulously crafted design system for the NOVA AI platform.
          Built with Tailwind CSS v4, oklch color science, and accessibility-first principles.
        </p>
        <div className="flex items-center justify-center gap-6 text-xs text-text-tertiary font-mono">
          <span>Tailwind v4</span>
          <span className="w-1 h-1 rounded-full bg-border-strong" />
          <span>React 19</span>
          <span className="w-1 h-1 rounded-full bg-border-strong" />
          <span>oklch Colors</span>
          <span className="w-1 h-1 rounded-full bg-border-strong" />
          <span>WCAG 2.1 AA</span>
        </div>
      </header>

      {/* Color Palette — Brand */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text">Color Palette</h2>
          <p className="text-sm text-text-secondary">
            Built on the oklch color space for perceptually uniform, vibrant colors that work across light and dark modes.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Brand</h3>
          <div className="grid grid-cols-5 gap-3">
            {colors.map((c) => (
              <div key={c.name} className="space-y-2">
                <div className={`h-20 rounded-xl ${c.sample} shadow-sm ring-1 ring-black/5`} />
                <div>
                  <p className="text-sm font-medium text-text">{c.name}</p>
                  <p className="text-[10px] font-mono text-text-tertiary">{c.var}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Surfaces</h3>
          <div className="grid grid-cols-3 gap-3">
            {surfaces.map((s) => (
              <div key={s.name} className="space-y-2">
                <div className={`h-20 rounded-xl ${s.sample} border border-border shadow-sm`} />
                <div>
                  <p className="text-sm font-medium text-text">{s.name}</p>
                  <p className="text-[10px] font-mono text-text-tertiary">{s.var}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Status</h3>
            <div className="grid grid-cols-3 gap-3">
              {status.map((s) => (
                <div key={s.name} className="space-y-2">
                  <div className={`h-14 rounded-xl ${s.sample} shadow-sm ring-1 ring-black/5`} />
                  <p className="text-sm font-medium text-text">{s.name}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Borders</h3>
            <div className="grid grid-cols-2 gap-3">
              {borders.map((b) => (
                <div key={b.name} className="space-y-2">
                  <div className={`h-14 rounded-xl ${b.bg} border-2 ${b.sample}`} />
                  <p className="text-sm font-medium text-text">{b.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text">Typography</h2>
          <p className="text-sm text-text-secondary">
            DM Sans provides warm geometric clarity. JetBrains Mono for code and technical data.
          </p>
        </div>

        <div className="space-y-6 p-6 rounded-xl bg-surface-secondary border border-border">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-4xl font-bold text-text tracking-tight">Display / H1</span>
              <span className="text-xs font-mono text-text-tertiary">text-4xl · font-bold · tracking-tight</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-2xl font-semibold text-text">Heading / H2</span>
              <span className="text-xs font-mono text-text-tertiary">text-2xl · font-semibold</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-lg font-semibold text-text">Section / H3</span>
              <span className="text-xs font-mono text-text-tertiary">text-lg · font-semibold</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-sm text-text">Body Text</span>
              <span className="text-xs font-mono text-text-tertiary">text-sm · text-text</span>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <span className="text-xs text-text-secondary">Caption</span>
              <span className="text-xs font-mono text-text-tertiary">text-xs · text-text-secondary</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-sm text-text">Code / Monospace</span>
              <span className="text-xs font-mono text-text-tertiary">font-mono · text-sm</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Text Hierarchy</h3>
          <div className="grid grid-cols-3 gap-4">
            {textLevels.map((t) => (
              <div key={t.name} className="p-4 rounded-xl bg-surface-secondary border border-border space-y-1">
                <p className={`text-base font-medium ${t.sample}`}>
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-xs font-mono text-text-tertiary">{t.name}</p>
                <p className="text-[10px] text-text-tertiary">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spacing & Radius */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text">Spacing & Radius</h2>
          <p className="text-sm text-text-secondary">
            Consistent spatial rhythm creates visual harmony across every component.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Border Radius</h3>
            <div className="flex items-end gap-4">
              {[
                { label: "rounded", cls: "rounded", size: "h-14 w-14" },
                { label: "rounded-lg", cls: "rounded-lg", size: "h-14 w-14" },
                { label: "rounded-xl", cls: "rounded-xl", size: "h-14 w-14" },
                { label: "rounded-2xl", cls: "rounded-2xl", size: "h-14 w-14" },
                { label: "rounded-full", cls: "rounded-full", size: "h-14 w-14" },
              ].map((r) => (
                <div key={r.label} className="space-y-2 text-center">
                  <div className={`${r.size} ${r.cls} bg-primary/20 border-2 border-primary`} />
                  <p className="text-[10px] font-mono text-text-tertiary">{r.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-text-tertiary">Spacing Scale</h3>
            <div className="space-y-2">
              {[
                { label: "4px", cls: "w-1" },
                { label: "8px", cls: "w-2" },
                { label: "12px", cls: "w-3" },
                { label: "16px", cls: "w-4" },
                { label: "24px", cls: "w-6" },
                { label: "32px", cls: "w-8" },
                { label: "48px", cls: "w-12" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`h-3 ${s.cls} rounded-sm bg-primary/40`} />
                  <span className="text-[10px] font-mono text-text-tertiary">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Animations */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text">Motion</h2>
          <p className="text-sm text-text-secondary">
            Purposeful animations that guide attention. Respects prefers-reduced-motion.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { name: "fade-in", cls: "animate-in fade-in" },
            { name: "slide-up", cls: "animate-in slide-up-fade" },
            { name: "scale-in", cls: "animate-in scale-in" },
            { name: "hover-lift", cls: "hover-lift cursor-pointer" },
          ].map((a) => (
            <div
              key={a.name}
              className={`p-6 rounded-xl bg-surface-secondary border border-border text-center ${a.cls}`}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/30 mx-auto mb-3" />
              <p className="text-xs font-mono text-text-tertiary">{a.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Design Principles */}
      <section className="space-y-6 pb-8">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-text">Design Principles</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            {
              title: "Accessible First",
              desc: "WCAG 2.1 AA compliant. Keyboard navigable. Screen reader friendly. Focus visible rings on every interactive element.",
              icon: "focus-visible:outline-2",
            },
            {
              title: "Warm Precision",
              desc: "Warm indigo and golden accents create an approachable yet professional tone. No cold grays — every surface has warmth.",
              icon: "oklch()",
            },
            {
              title: "Dark Mode Native",
              desc: "First-class dark mode with carefully tuned oklch values. Not just inverted — independently designed for each context.",
              icon: "prefers-color-scheme",
            },
          ].map((p) => (
            <div key={p.title} className="p-5 rounded-xl bg-surface-secondary border border-border space-y-2">
              <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{p.icon}</code>
              <h3 className="text-sm font-semibold text-text">{p.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const meta: Meta = {
  title: "NOVA/Introduction",
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
    actions: { disable: true },
  },
};

export default meta;

export const Overview: StoryObj = {
  render: () => <DesignSystemOverview />,
};
