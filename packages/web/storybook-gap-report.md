# Storybook vs Web App — Gap Analysis Report

> Generated: 2026-03-13
> Stories analyzed: 69
> Classification: 29 primitives, 20 features, 12 patterns, 8 documentation

## 1. Unimplemented Designs (P1)

Pattern/page stories with no matching route or component implementation.

| Priority | Story | Title | Size | Reason |
|----------|-------|-------|------|--------|
| **P1** | `ResponsivePatterns.stories.tsx` | Patterns/ResponsivePatterns | 16.7K | Pattern/page story with no matching route |
| **P1** | `ErrorRecovery.stories.tsx` | Patterns/ErrorRecovery | 5.3K | Pattern/page story with no matching route |
| **P1** | `LoadingStates.stories.tsx` | Patterns/LoadingStates | 5.4K | Pattern/page story with no matching route |
| **P1** | `Patterns.stories.tsx` | Patterns/Compositions | 23.5K | Pattern/page story with no matching route |
| **P1** | `FormPatterns.stories.tsx` | Patterns/Forms | 19.3K | Pattern/page story with no matching route |

## 2. Partial Implementations (P2)

Routes that exist but are missing features shown in their corresponding story.

### ArtifactDisplay

- **Story**: `ArtifactDisplay.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `ArtifactDisplay`
- **Not in route** (used elsewhere in app): `ArtifactRenderer`, `type ArtifactData`

### ToolStatusChip

- **Story**: `ToolStatusChip.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `ToolStatusChip`, `ToolStatusBar`

### SlashCommand

- **Story**: `SlashCommand.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `SlashCommand`
- **Not in route** (used elsewhere in app): `MentionPopup`

### ErrorMessage

- **Story**: `ErrorMessage.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `ErrorMessage`

### ModelComparison

- **Story**: `ModelComparison.stories.tsx`
- **Route**: `_auth/model-compare.tsx`
- **Not in route** (used elsewhere in app): `ModelCapabilityBadges`, `Badge`, `Button`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **Missing icons**: `Check`, `Zap`, `Brain`, `Gauge`, `DollarSign`, `Sparkles`
- **Note**: Story uses Table component but route does not

### KnowledgeBrowser

- **Story**: `KnowledgeBrowser.stories.tsx`
- **Route**: `_auth/knowledge.tsx`
- **Not in route** (used elsewhere in app): `Badge`, `Button`, `Input`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **Missing icons**: `Search`, `MoreHorizontal`, `File`, `FileCode`, `FileSpreadsheet`, `Trash2`, `Download`, `CheckCircle`, `Clock`, `AlertTriangle`, `X`, `Layers`
- **Note**: Story uses Table component but route does not

### ResearchView

- **Story**: `ResearchView.stories.tsx`
- **Route**: `_auth/research.tsx`
- **Not in route** (used elsewhere in app): `Card`, `CardHeader`, `CardContent`, `ProgressBar`, `EmptyState`, `Badge`, `Button`, `NewResearchForm`

### ToolCallDisplay

- **Story**: `ToolCallDisplay.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `ToolCallDisplay`, `ToolCallPanel`

### Dashboard

- **Story**: `DashboardLayout.stories.tsx`
- **Route**: `_auth.tsx`
- **Not in route** (used elsewhere in app): `Badge`, `Avatar`, `Button`
- **Missing icons**: `MessageSquare`, `Microscope`, `BookOpen`, `Compass`, `FolderKanban`, `HardDrive`, `Settings`, `HelpCircle`, `ChevronLeft`, `ChevronRight`, `Zap`, `Pin`, `Plus`, `Search`, `Bell`, `User`, `Moon`, `Sun`, `PanelLeftClose`, `PanelLeft`, `BarChart3`, `Users`, `Activity`, `Clock`, `TrendingUp`

### URLPreviewCard

- **Story**: `URLPreviewCard.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `URLPreviewCard`

### ConversationHeader

- **Story**: `ConversationHeader.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `ConversationHeader`

### StreamingMessage

- **Story**: `StreamingMessage.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `StreamingMessage`

### NewResearchForm

- **Story**: `NewResearchForm.stories.tsx`
- **Route**: `_auth/research.tsx`
- **Missing from app**: `type NewResearchFormProps`
- **Not in route** (used elsewhere in app): `NewResearchForm`

### VoiceInput

- **Story**: `VoiceInput.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `VoiceInput`

### MessageInput

- **Story**: `MessageInput.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `MessageInput`

### OnboardingFlow

- **Story**: `OnboardingFlow.stories.tsx`
- **Route**: `_auth/onboarding.tsx`
- **Missing from app**: `Kbd`
- **Not in route** (used elsewhere in app): `Button`, `Input`, `Switch`
- **Missing icons**: `Upload`, `Keyboard`, `Command`, `Plus`, `Search`, `Globe`

### TypingIndicator

- **Story**: `TypingIndicator.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `TypingIndicator`

### CommandPalette

- **Story**: `CommandPalette.stories.tsx`
- **Route**: `_auth.tsx`
- **Missing from app**: `CommandPalette`

### ConversationList

- **Story**: `ConversationList.stories.tsx`
- **Route**: `_auth.tsx`
- **Not in route** (used elsewhere in app): `Badge`, `Button`
- **Missing icons**: `MessageSquare`, `Pin`, `Archive`, `Trash2`, `MoreHorizontal`, `Search`, `Plus`, `Filter`, `ChevronLeft`, `Zap`, `Settings`, `HelpCircle`, `BookOpen`, `FolderKanban`, `Compass`, `Microscope`, `HardDrive`, `FolderOpen`, `CheckSquare`, `Square`

### AgentMarketplace

- **Story**: `AgentMarketplace.stories.tsx`
- **Route**: `_auth/agents.marketplace.tsx`
- **Not in route** (used elsewhere in app): `Badge`, `Avatar`, `Button`
- **Missing icons**: `Wrench`, `MessageSquare`, `ChevronLeft`, `ChevronRight`, `Globe`, `Brain`, `Heart`

### AdminPanel

- **Story**: `AdminPanelLayout.stories.tsx`
- **Route**: `_auth/admin.index.tsx`
- **Not in route** (used elsewhere in app): `Badge`, `Avatar`, `Button`, `Input`, `Switch`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- **Missing icons**: `Users`, `BarChart3`, `Shield`, `Settings`, `Activity`, `Heart`, `Gauge`, `AlertTriangle`, `Database`, `CreditCard`, `Palette`, `Link2`, `FileSearch`, `UserCog`, `Search`, `MoreHorizontal`, `Plus`, `Check`, `X`, `ChevronRight`
- **Note**: Story uses Table component but route does not

### DynamicWidget

- **Story**: `DynamicWidget.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `DynamicWidget`, `type WidgetConfig`

### ShortcutsHelpOverlay

- **Story**: `ShortcutsHelpOverlay.stories.tsx`
- **Route**: `_auth/help.tsx`
- **Not in route** (used elsewhere in app): `ShortcutsHelpOverlay`

### FilePreview

- **Story**: `FileAttachments.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `FileUploadPreview`
- **Not in route** (used elsewhere in app): `AttachmentBar`, `FilePreview`

### AgentReasoningTrace

- **Story**: `AgentReasoningTrace.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `AgentReasoningTrace`, `AgentTraceView`

### MessageBubble

- **Story**: `MessageBubble.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Not in route** (used elsewhere in app): `MessageBubble`

### RateLimitWarning

- **Story**: `RateLimitWarning.stories.tsx`
- **Route**: `_auth/conversations.$id.tsx`
- **Missing from app**: `RateLimitWarning`

## 3. Unused Component Variants (P3)

UI primitive variants defined in component source and demonstrated in stories but never used in the app.

| Component | Prop | Unused Variant | Component File |
|-----------|------|----------------|----------------|
| `Card` | `variant` | `"outline"` | `Card.tsx` |
| `Card` | `variant` | `"elevated"` | `Card.tsx` |
| `AccessibleLabel` | `politeness` | `"polite"` | `AccessibleLabel.tsx` |
| `AccessibleLabel` | `politeness` | `"assertive"` | `AccessibleLabel.tsx` |
| `ProgressBar` | `size` | `"md"` | `ProgressBar.tsx` |
| `ProgressBar` | `size` | `"lg"` | `ProgressBar.tsx` |
| `Tooltip` | `side` | `"top"` | `Tooltip.tsx` |
| `Tooltip` | `side` | `"bottom"` | `Tooltip.tsx` |
| `Tooltip` | `side` | `"left"` | `Tooltip.tsx` |
| `Tooltip` | `side` | `"right"` | `Tooltip.tsx` |
| `Switch` | `size` | `"md"` | `Switch.tsx` |
| `Dropdown` | `align` | `"left"` | `Dropdown.tsx` |
| `Dropdown` | `align` | `"right"` | `Dropdown.tsx` |
| `Avatar` | `size` | `"md"` | `Avatar.tsx` |
| `Dialog` | `size` | `"md"` | `Dialog.tsx` |
| `Dialog` | `size` | `"lg"` | `Dialog.tsx` |
| `Separator` | `orientation` | `"horizontal"` | `Separator.tsx` |
| `Separator` | `orientation` | `"vertical"` | `Separator.tsx` |

## Summary

| Category | Count |
|----------|-------|
| P1 — Unimplemented designs | 5 |
| P2 — Partial implementations | 27 |
| P3 — Unused component variants | 18 |
| **Total gaps** | **50** |
