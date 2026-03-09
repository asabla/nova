# NOVA UI/UX Comprehensive Audit Report

**Date:** 2026-03-08
**Scope:** Storybook Design System + Web Application (Frontend)
**Method:** Visual inspection (Storybook + Preview), code review of 15 routes, 15 components, and design system CSS

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [Storybook Findings](#storybook-findings)
4. [Design System & CSS](#design-system--css)
5. [Accessibility Audit](#accessibility-audit)
6. [Component Quality](#component-quality)
7. [Route/Page Audit](#routepage-audit)
8. [Dark Mode Issues](#dark-mode-issues)
9. [Responsive Design](#responsive-design)
10. [Animation & Motion](#animation--motion)
11. [i18n / Localization](#i18n--localization)
12. [Performance Concerns](#performance-concerns)
13. [Missing User Story Coverage](#missing-user-story-coverage)
14. [Recommendations Summary](#recommendations-summary)

---

## Executive Summary

NOVA's frontend is impressively comprehensive — 323 files, 72,400 lines of code implementing 234 user stories with 69 Storybook stories. The design system uses a well-structured oklch color palette with proper semantic tokens, and the dark/light theme support is generally solid. Component coverage is extensive with good variant support.

However, this audit uncovered **4 critical**, **16 high**, and **30+ medium** severity issues across accessibility, design system integrity, i18n, and functional correctness. The most impactful findings are:

- **All Storybook Docs pages render blank** (Storybook misconfiguration)
- **Keyboard focus rings are suppressed** in the chat input area (WCAG violation)
- **Several animation classes silently fail** (missing CSS definitions)
- **Branding override feature is broken** (wrong CSS property name)
- **i18n coverage is inconsistent** — some pages have zero translations

---

## Critical Issues

### CRIT-1: Storybook Docs Pages All Render Blank

**Severity:** Critical | **Location:** `.storybook/preview.tsx`

Every single Docs tab across all 69 stories renders a completely blank white/dark page. The likely cause is `addons: [addonThemes()]` in `preview.tsx` line 19 — calling `addonThemes()` as a factory function in the preview config is non-standard for Storybook 8+ and interferes with the Docs addon initialization.

**Fix:** Remove the `addons` array from `preview.tsx`. The themes addon is already registered in `main.ts`.

```tsx
// preview.tsx — remove this line:
addons: [addonThemes()],
// Keep only the decorators array
```

### CRIT-2: Focus Ring Suppressed in Chat Input (WCAG 2.4.11 Failure)

**Severity:** Critical | **Location:** `app.css` lines 261-264

```css
.input-glow *:focus-visible {
  outline: none;
}
```

This removes all visible focus indicators inside `.input-glow` containers. The container's `:focus-within` box-shadow is a diffuse 20px glow — not a clear, high-contrast focus ring. Keyboard-only users lose all visible focus indication inside the main chat input area.

**Fix:** Remove the `outline: none` override, or replace with a visible inner ring:
```css
.input-glow *:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
```

### CRIT-3: Animation Classes Silently Fail (No CSS Definitions)

**Severity:** Critical | **Location:** `app.css` (missing definitions)

The following Tailwind animation classes are used in components but have no corresponding CSS definitions:

| Missing Class | Used In |
|---|---|
| `slide-in-from-right` | `Toast.tsx` |
| `zoom-in-95` | `Dropdown.tsx`, `ConnectionStatus.tsx`, `NotificationCenter.tsx`, `MentionPopup.tsx` |
| `slide-in-from-bottom-4` | `ShortcutsHelpOverlay.tsx` |

These elements render with no entrance animation — they appear instantly. The classes likely came from `tailwindcss-animate` which is not installed.

**Fix:** Either install `tailwindcss-animate` or define the missing keyframes in `app.css`.

### CRIT-4: Branding Override Feature is Broken

**Severity:** Critical | **Location:** `__root.tsx` line 48

```tsx
style.setProperty("--color-primary-brand", brandColor);
```

The CSS variable `--color-primary-brand` is never consumed by any CSS rule or Tailwind class. The branding feature sets a property that has no effect. The intent was likely `--color-primary`.

**Fix:** Change to `style.setProperty("--color-primary", brandColor)` or add CSS rules that consume `--color-primary-brand`.

---

## Storybook Findings

### Visual Inspection Results

| Area | Status | Notes |
|---|---|---|
| Button variants | Good | 4 variants (Primary, Secondary, Ghost, Danger), 3 sizes, loading/disabled states |
| Alert variants | Good | Info, Success, Warning, Error with proper semantic colors |
| Card variants | Good | Default, Outline, Elevated with agent card example |
| Input states | Good | Default, With Label, With Error, Disabled, All States |
| Dialog | Fair | Renders correctly, but Interactions tab shows red (failing test) |
| MessageBubble | Good | User/Assistant messages, streaming dots, failed state, attachments, ratings |
| MessageInput | Good | Attachment, voice, placeholder, send button |
| ToolCallDisplay | Good | Success, running, failed, approval_required — clear color-coded states |
| CommandPalette | Poor | Renders completely empty — modal not shown in open state |
| Dashboard layout | Good | Sidebar, stats cards, quick actions — dark mode renders well |
| AdminPanel layout | Good | Member management table, proper admin nav grouping |
| AgentMarketplace | Good | Search, category chips, agent cards with ratings |
| ConversationList | Good | Sidebar with pinned/recent conversations |
| OnboardingFlow | Good | Step wizard with progress dots |
| ErrorRecovery | Fair | Rate limit shows raw i18n key `errors.rateLimitTitle` |
| Animation Guide | Good | Timing reference, hover transitions, expand/collapse demos |

### Storybook Infrastructure Issues

| # | Issue | Severity |
|---|---|---|
| SB-1 | All Docs pages blank (see CRIT-1) | Critical |
| SB-2 | No `preview-head.html` — Google Fonts not loaded in Storybook iframe. Stories render in system-ui instead of DM Sans/JetBrains Mono | High |
| SB-3 | `manager.ts` uses hardcoded hex colors (`#5B4BDB`, `#1a1a2e`) instead of shared tokens — manual sync required with design system | Low |
| SB-4 | Dialog story has failing interaction test (red Interactions tab indicator) | Medium |
| SB-5 | CommandPalette "Default" story renders empty — should show component in open state | Medium |
| SB-6 | ErrorRecovery "Rate Limit" shows raw i18n key `errors.rateLimitTitle` instead of translated text | Medium |
| SB-7 | `DarkModeAudit.stories.tsx` uses hardcoded Tailwind neutrals (`border-neutral-200`, `bg-neutral-900`) instead of tokens | Low |

---

## Design System & CSS

### Token System Issues

| # | Issue | Severity | Location |
|---|---|---|---|
| DS-1 | `--color-primary-light` defined in theme but never used in product code | Low | `app.css` lines 6, 42, 69 |
| DS-2 | `[data-theme="light"]` block does not reset primary/accent colors — switching from OS dark to light toggle leaves dark-mode primary/accent values | High | `app.css` lines 91-104 |
| DS-3 | `--font-display` identical to `--font-sans` — dead token | Low | `app.css` line 35 |
| DS-4 | No font-size scale tokens — `text-[10px]` used 15+ times, `text-[8px]` used in Avatar | Medium | Scattered |
| DS-5 | No spacing scale tokens defined in `@theme` | Low | N/A |
| DS-6 | No z-index token layer — raw values `z-10` through `z-[9999]` scattered across 25+ files | Medium | Scattered |
| DS-7 | `sidebarWidth` state persisted to localStorage but never applied to layout — dead stub | Medium | `ui.store.ts` line 16 |

### Missing Design Tokens

| Token Needed | Evidence |
|---|---|
| `--color-overlay` / `--color-scrim` | `bg-black/50` used 8 times for modal backdrops |
| `--color-shadow` | `color-mix(..., var(--color-text))` used as shadow — white shadow in dark mode |
| `--z-*` named layers | No stacking order contract |
| `--font-size-micro` (10px) | 15+ arbitrary `text-[10px]` values |
| `--duration-fast/base/slow` | 3 different durations hardcoded (150/200/350ms) |
| `--color-success-muted`, etc. | Alert/toast use `bg-success/10` without explicit muted tokens |

### Animation Issues

| # | Issue | Severity |
|---|---|---|
| AN-1 | `slide-in-from-top-4` aliases `slide-in-from-top-2` keyframe (0.5rem instead of expected 1rem) | Medium |
| AN-2 | `glow-pulse` and `shimmer` keyframes defined but never used — dead CSS | Low |
| AN-3 | Page-enter (350ms) and stagger-children (400ms) durations not aligned with animate-in (200ms) — no documented rationale | Low |
| AN-4 | `hover-lift` shadow uses `var(--color-text)` — produces light-colored shadow in dark mode | Medium |

### Theme Switching

| # | Issue | Severity |
|---|---|---|
| TH-1 | No FOUC-prevention `<script>` in `index.html` — users with stored light preference on dark OS see a flash | High |
| TH-2 | `applyThemeToDOM` logic duplicated in both `ui.store.ts` and `useTheme.ts` | Low |
| TH-3 | Theme preview in settings uses hardcoded oklch values instead of CSS variables — will drift from actual tokens | Medium |

---

## Accessibility Audit

### Critical WCAG Violations

| # | Issue | WCAG SC | Location |
|---|---|---|---|
| A11Y-1 | Focus ring suppressed in `.input-glow` (see CRIT-2) | 2.4.11 Focus Appearance | `app.css` |
| A11Y-2 | `text-[8px]` in Avatar xs size — below minimum readable size | 1.4.4 Resize Text | `Avatar.tsx` line 38 |
| A11Y-3 | No `role="dialog"`, `aria-modal`, or focus trap in CommandPalette | 4.1.2 Name, Role, Value | `CommandPalette.tsx` |
| A11Y-4 | No `role="dialog"`, `aria-modal`, or focus trap in OmniBar | 4.1.2 Name, Role, Value | `OmniBar.tsx` |
| A11Y-5 | Playground preset dialogs lack `role="dialog"`, focus trap, Escape key handling | 4.1.2 | `playground.tsx` |
| A11Y-6 | Custom notification toggle in onboarding has no `role="switch"` or `aria-checked` | 4.1.2 | `onboarding.tsx` |

### High-Priority A11Y Issues

| # | Issue | Location |
|---|---|---|
| A11Y-7 | `<button>` used for navigation instead of `<a>`/`<Link>` throughout — Sidebar links, conversation items, agent cards, header avatar | Multiple files |
| A11Y-8 | `role="option"` nested inside non-`listbox` div wrappers — breaks ARIA ownership | `OmniBar.tsx`, `CommandPalette.tsx` |
| A11Y-9 | No `aria-current="page"` on active nav links | `settings.tsx`, `admin.tsx`, `Sidebar.tsx` |
| A11Y-10 | Action buttons invisible to keyboard (opacity-0 hover-only) in MessageBubble | `MessageBubble.tsx` line 402 |
| A11Y-11 | No `prefers-contrast: more` or `forced-colors: active` media queries | `app.css` |
| A11Y-12 | Nested `aria-live` regions in StreamingMessage (parent MessageList already has `aria-live="polite"`) — causes double announcements | `StreamingMessage.tsx` |
| A11Y-13 | SSE error banner in conversation view not wrapped in `role="alert"` | `conversations.$id.tsx` |
| A11Y-14 | Search input, marketplace search input, and playground selectors missing `<label>` / `aria-label` | Multiple |
| A11Y-15 | `admin.tsx` tab section headers at `text-[10px]` may fail contrast requirements | `admin.tsx` |
| A11Y-16 | ArtifactDisplay fullscreen mode has no `role="dialog"`, no focus trap, no Escape handler | `ArtifactDisplay.tsx` |
| A11Y-17 | ErrorBoundary fallback has no `role="alert"` | `ErrorBoundary.tsx` |

### Medium A11Y Issues

- Toast container uses single `aria-live="polite"` for all types — error toasts should use `"assertive"`
- Lucide icons missing `aria-hidden="true"` in `admin.tsx`, `admin.members.tsx`, `onboarding.tsx`, `agents.marketplace.tsx`
- Heading levels inconsistent in onboarding steps (h2 vs h3)
- File removal button in dashboard says "Remove" without identifying which file
- CodeBlock copy button has no `aria-label`
- ArtifactDisplay toolbar buttons use only `title`, not `aria-label`
- Playground "Remove message" button is opacity-0 and invisible to keyboard users
- No skip-to-content link in the Header

---

## Component Quality

### Functional Issues

| # | Issue | Severity | Location |
|---|---|---|---|
| CMP-1 | Dashboard `setPendingFiles` name collision — local state setter shadows the module import. Files are never stored in pending-files store when sending from home page | High (bug) | `index.tsx` line 14 vs line 32 |
| CMP-2 | CommandPalette and OmniBar are near-identical components — significant duplication/tech debt | Medium | Both files |
| CMP-3 | `navigator.userAgent` accessed at module level in CommandPalette — crashes in SSR/test environments | Medium | `CommandPalette.tsx` line 56 |
| CMP-4 | ArtifactDisplay iframe uses hardcoded `bg-white` — flashes white in dark mode | Medium | `ArtifactDisplay.tsx` line 208 |
| CMP-5 | ArtifactDisplay Mermaid hardcoded to `theme: "dark"` regardless of user theme | Medium | `ArtifactDisplay.tsx` line 77 |
| CMP-6 | CSV parsing is naive — splits on commas without handling quoted fields | Medium | `ArtifactDisplay.tsx` line 103 |
| CMP-7 | Audio/video artifact types declared but fall through to text fallback — dead UI | Low | `ArtifactDisplay.tsx` |
| CMP-8 | Chart artifact type shows placeholder text in production — not implemented | Low | `ArtifactDisplay.tsx` line 350 |
| CMP-9 | No syntax highlighting in CodeBlock — major quality gap for a chat platform | High | `CodeBlock.tsx` |
| CMP-10 | MessageBubble not wrapped in `React.memo` — causes unnecessary re-renders in long conversations | Medium | `MessageBubble.tsx` |
| CMP-11 | MessageList has no virtualization — performance degrades with hundreds of messages | Medium | `MessageList.tsx` |
| CMP-12 | MessageInput draft key not scoped to conversation ID — draft shared across all conversations | Medium | `MessageInput.tsx` line 34 |
| CMP-13 | `onTyping` callback fires on every keystroke with no throttle | Low | `MessageInput.tsx` |
| CMP-14 | Toast `onDismiss` reference changes on every toast addition — resets timers for all existing toasts | Medium | `Toast.tsx` |
| CMP-15 | ErrorBoundary `setState` + `window.location.reload()` are redundant — reload unmounts everything | Low | `ErrorBoundary.tsx` |
| CMP-16 | ErrorBoundary has no `componentDidCatch` for error logging to monitoring services | Medium | `ErrorBoundary.tsx` |

### Type Safety Issues

Extensive `any` usage across the codebase:

| Location | Issue |
|---|---|
| `Sidebar.tsx` | `api.get<any>`, conversation data untyped |
| `OmniBar.tsx` | `useState<any[]>` for search results |
| `MessageBubble.tsx` | `artifacts?: any[]`, `(modelsData as any)` |
| `MessageList.tsx` | `messages: any[]`, `artifactsByMessageId?: Map<string, any[]>` |
| All 15 routes | API responses cast to `any` throughout |

---

## Route/Page Audit

### Dashboard (`index.tsx`)

| Issue | Severity |
|---|---|
| `setPendingFiles` name collision bug (see CMP-1) | High |
| Recent conversations capped at 5 with no "View all" link | Medium |
| `quickStarters` array recreated every render — needs `useMemo` | Low |
| File attachment chips use `key={i}` (array index) — incorrect reconciliation | Medium |
| No indication of pinned conversations (Story #37) | Low |

### Conversation View (`conversations.$id.tsx`)

| Issue | Severity |
|---|---|
| `ConversationHeader` receives `undefined` during loading — may show empty text | Medium |
| Error banner at bottom may be obscured by MessageInput on mobile | Medium |
| No visual indicator when streaming is paused | Medium |
| Drag-and-drop overlay has no ARIA announcement | Medium |
| No error boundary wrapping the conversation page | High |
| `uploadSingleFile` has no retry logic | Medium |
| Token count/cost not displayed (Story #50) | Low |
| No share button (Story #39) | Low |
| No export as Markdown/PDF (Story #38) | Low |

### New Conversation (`conversations.new.tsx`)

| Issue | Severity |
|---|---|
| `useEffect` with `[]` deps captures stale `createAndSend` closure — starter message uses empty model/workspace | High (bug) |
| i18n keys used without `defaultValue` fallback | Medium |
| Default starters duplicate content from `index.tsx` | Low |
| Query keys not using `queryKeys` registry | Medium |

### Agents Gallery (`agents.tsx`)

| Issue | Severity |
|---|---|
| Star icon suggests rating but shows usage count | Medium |
| `MoreHorizontal` and `Avatar` imported but unused | Low |
| No `staleTime` on query — re-fetches every mount | Low |

### Agent Marketplace (`agents.marketplace.tsx`)

| Issue | Severity |
|---|---|
| **Zero `useTranslation` usage** — all strings hardcoded in English | High |
| Search triggers API on every keystroke — no debounce | High |
| No `isError` state handling — API failures show as empty state | High |
| `cloneAgent` has no `onError` handler | Medium |
| Clone on click with no confirmation dialog | Medium |

### Knowledge (`knowledge.tsx`)

| Issue | Severity |
|---|---|
| Empty state CTA says "Upload Documents" but navigates to create collection | Medium |
| No search/filter on collection list | Medium |
| Badge shows raw status strings without formatting | Low |

### Settings Layout (`settings.tsx`)

| Issue | Severity |
|---|---|
| Mobile horizontal tab scroll has no visual indicator of overflow | Medium |
| Icon components not `aria-hidden="true"` | Low |

### Settings Profile (`settings.profile.tsx`)

| Issue | Severity |
|---|---|
| Avatar is URL-only text input — no file upload picker | Medium |
| `setTimeout` for "saved" state not cleaned up on unmount | Low |
| No explanation that email cannot be changed | Low |

### Admin Layout (`admin.tsx`)

| Issue | Severity |
|---|---|
| Mobile nav with 20+ items in single horizontal scroll — unusable | High |
| Tab group section headers hardcoded in English — no i18n | Medium |
| Developer Tools section contains non-admin routes — misleading | Medium |
| Same Shield icon for both Security and SSO tabs | Low |
| `icon: any` type annotation | Low |

### Admin Members (`admin.members.tsx`)

| Issue | Severity |
|---|---|
| Role change fires immediately on select `onChange` — no confirmation for elevated roles | High |
| No option to cancel/revoke pending invitations | Medium |
| Member count shows "0" during initial load | Low |
| No search/filter on members list | Medium |

### Search (`search.tsx`)

| Issue | Severity |
|---|---|
| Participants filter uses raw user-ID format — not user-friendly | Medium |
| Model filter is free-text instead of select dropdown | Medium |
| Tab buttons lack ARIA tab semantics (`role="tab"`, `aria-selected`) | Medium |
| No retry button on error state (inconsistent with other pages) | Low |

### Playground (`playground.tsx`)

| Issue | Severity |
|---|---|
| Custom preset dialogs lack `role="dialog"` and focus trap | High |
| `toast.success(...)` may not match toast API signature — potential runtime error | High |
| Header toolbar overflows on mobile with no responsive adaptation | Medium |
| Stream toggle has no `aria-pressed` semantics | Medium |
| `navigator.clipboard.writeText` calls don't catch permission errors | Medium |
| cURL export missing auth headers | Low |

### Onboarding (`onboarding.tsx`)

| Issue | Severity |
|---|---|
| Progress dots allow jumping to uncompleted forward steps | Medium |
| Desktop notifications toggle `checked` state never updates after permission grant | Medium (bug) |
| Theme selection not applied live during onboarding | Medium |
| `completeOnboarding` has no `onError` handler — user stuck on final step | High |
| No `isPending` loading state on "Start Chatting" button | Medium |

---

## Dark Mode Issues

| # | Issue | Severity |
|---|---|---|
| DM-1 | `[data-theme="light"]` block doesn't reset primary/accent tokens (see DS-2) | High |
| DM-2 | `bg-black/50` modal overlays nearly invisible on dark backgrounds — need token | Medium |
| DM-3 | ArtifactDisplay iframe `bg-white` flashes in dark mode | Medium |
| DM-4 | Mermaid diagrams hardcoded to dark theme regardless of setting | Medium |
| DM-5 | `hover-lift` shadow uses text color — produces light shadow in dark mode | Medium |
| DM-6 | OmniBar section borders use hardcoded Tailwind palette colors (`border-l-blue-400` etc.) | Low |
| DM-7 | ArtifactDisplay type badge colors hardcoded — may have insufficient contrast in light mode | Low |
| DM-8 | Theme flash (FOUC) on page load — no blocking script | High |

---

## Responsive Design

| # | Issue | Severity |
|---|---|---|
| RD-1 | Sidebar defaults to open (`sidebarOpen: true`) — eats 280px on 375px mobile viewport | High |
| RD-2 | ConversationSettings panel is 320px fixed width — no mobile adaptation | High |
| RD-3 | Admin mobile nav with 20+ items in single horizontal scroll | High |
| RD-4 | Playground header toolbar overflows on mobile | Medium |
| RD-5 | Dashboard quick starter grid may truncate cards at 400-639px width | Low |
| RD-6 | Settings horizontal tab scroll has no overflow indicator | Medium |
| RD-7 | Core chat components have minimal responsive handling | Medium |

---

## Animation & Motion

| # | Issue | Severity |
|---|---|---|
| MO-1 | `prefers-reduced-motion` not respected in Sidebar, OmniBar, CommandPalette, Toast, StreamingMessage, MessageBubble | High |
| MO-2 | Missing animation class definitions (see CRIT-3) | Critical |
| MO-3 | Loading dots `animate-bounce` has no reduced-motion alternative | Medium |
| MO-4 | No `motion-safe:` / `motion-reduce:` guards on any hover transitions | Medium |
| MO-5 | `slide-in-from-top-4` aliases wrong keyframe distance | Low |

---

## i18n / Localization

| # | Issue | Severity |
|---|---|---|
| I18N-1 | `agents.marketplace.tsx` has **zero** `useTranslation` usage — all English hardcoded | High |
| I18N-2 | `onboarding.tsx` has no i18n | High |
| I18N-3 | ErrorRecovery story shows raw key `errors.rateLimitTitle` | Medium |
| I18N-4 | `admin.tsx` tab group headers hardcoded in English | Medium |
| I18N-5 | `conversations.new.tsx` uses `t()` without `defaultValue` fallback | Medium |
| I18N-6 | ErrorBoundary strings hardcoded: "Something went wrong", "Reload Page" | Medium |
| I18N-7 | Dialog close button `aria-label="Close"` hardcoded in English | Low |
| I18N-8 | Toast dismiss button `aria-label="Dismiss"` hardcoded | Low |
| I18N-9 | ToolCallDisplay "Approve"/"Reject" buttons hardcoded English | Medium |
| I18N-10 | Inconsistent i18n pattern: some files use `t("key", "Default")`, others use `t("key")` without default | Medium |

---

## Performance Concerns

| # | Issue | Impact |
|---|---|---|
| PERF-1 | No virtualization in MessageList — all messages in DOM | High for long conversations |
| PERF-2 | No virtualization in Sidebar conversation list | Medium for power users |
| PERF-3 | MessageBubble not memoized with `React.memo` — all bubbles re-render on each new message | Medium |
| PERF-4 | OmniBar `allItems` rebuilds JSX icons on every open | Low |
| PERF-5 | Agent marketplace search fires API on every keystroke (no debounce) | Medium |
| PERF-6 | Several queries missing `staleTime` — unnecessary refetches | Low |
| PERF-7 | Multiple query keys not using `queryKeys` registry — breaks cache coherence | Medium |
| PERF-8 | `onTyping` callback fires every keystroke with no throttle | Low |
| PERF-9 | Auto-scroll effect in MessageList re-runs on every streaming token | Low |

---

## Missing User Story Coverage

Based on cross-referencing the 234 user stories against the audited routes:

| Story # | Description | Gap |
|---|---|---|
| #37 | Pin conversations | No pin action in home or conversation view |
| #38 | Export as Markdown/PDF/JSON | Not accessible from conversation view |
| #39 | Share conversation as public link | No share button |
| #45-46 | @mention users/agents | No @mention autocomplete in message input |
| #50 | Token count/cost per conversation | Not displayed despite being available |
| #55 | Step-by-step agent reasoning trace | Only ToolStatusBar shown, no expandable trace |
| #98 | Publish agent to marketplace | No publish action from agent list |
| #99 | Version agents | No version info on agent cards |
| #106-107 | Webhook/cron agent triggers | No webhook/schedule UI |
| #116-118 | Knowledge: add URLs, re-index, test query | Not accessible from list view |
| #188 | Command palette (Cmd+K) | Works but not accessible from all pages |
| #197 | Rate limit warning before block | No quota-approaching banner |
| #199 | System status banner | No degraded-service banner |
| #201 | Connection status indicator | No SSE/WebSocket status indicator |
| #202 | Preserve in-progress message on disconnect | No draft persistence |
| #210 | Custom CSS injection for theming | Not on appearance page |
| #220-222 | Interactive onboarding tutorial, sample conversations, contextual tooltips | Onboarding is informational only |

---

## Recommendations Summary

### Immediate Priority (Critical Fixes)

1. **Fix Storybook Docs** — Remove `addons: [addonThemes()]` from `preview.tsx`
2. **Restore focus ring** — Remove or replace `outline: none` in `.input-glow *:focus-visible`
3. **Install `tailwindcss-animate`** or define missing animation keyframes
4. **Fix branding override** — Change `--color-primary-brand` to `--color-primary`
5. **Fix `setPendingFiles` name collision** in dashboard `index.tsx`
6. **Fix stale closure** in `conversations.new.tsx` useEffect

### High Priority (Next Sprint)

7. Add Storybook `preview-head.html` with Google Fonts links
8. Add `role="dialog"`, `aria-modal`, and focus traps to OmniBar, CommandPalette, Playground dialogs, and ArtifactDisplay fullscreen
9. Add FOUC-prevention `<script>` to `index.html` for theme
10. Fix `[data-theme="light"]` block to reset primary/accent colors
11. Add `aria-current="page"` to all nav active states
12. Add syntax highlighting to CodeBlock (consider `shiki`)
13. Add i18n to `agents.marketplace.tsx` and `onboarding.tsx`
14. Make MessageBubble action buttons visible on keyboard focus (`focus-within:opacity-100`)
15. Add confirmation dialog for admin role changes
16. Add `prefers-reduced-motion` guards to animations
17. Change navigation `<button>` elements to `<Link>` components throughout
18. Default sidebar to closed on mobile viewports

### Medium Priority (Backlog)

19. Add `React.memo` to MessageBubble
20. Add list virtualization to MessageList and Sidebar conversation list
21. Add debounce to marketplace search
22. Create z-index token layer
23. Create font-size scale tokens (`--font-size-micro`, `--font-size-mini`)
24. Merge or share logic between OmniBar and CommandPalette
25. Add `componentDidCatch` to ErrorBoundary for error monitoring
26. Add `prefers-contrast: more` and `forced-colors: active` media queries
27. Scope message draft key to conversation ID
28. Add overlay/scrim design token
29. Add `staleTime` to static data queries (agents, knowledge, members)
30. Register all query keys through `queryKeys` registry
31. Type API responses instead of `any` casts

---

*Report generated by comprehensive visual + code audit of the NOVA frontend.*
