# Excalidraw Diagrams — Skill Reference

Create interactive, editable diagrams using the Excalidraw format. Diagrams are rendered inline in conversations with a hand-drawn aesthetic and full editing support.

## Output Format

Write valid Excalidraw scene JSON to `/sandbox/output/<name>.excalidraw`. The frontend automatically renders these as interactive diagrams.

```json
{
  "type": "excalidraw",
  "version": 2,
  "elements": [...],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  }
}
```

## Creating Diagrams

### From Mermaid (preferred for structured diagrams)

Use the conversion script:

```bash
node /sandbox/skills/excalidraw/scripts/mermaid-to-excalidraw.js "graph TD; A-->B; B-->C"
```

Or pipe from stdin:

```bash
echo "graph TD; A-->B; B-->C" | node /sandbox/skills/excalidraw/scripts/mermaid-to-excalidraw.js
```

The script outputs Excalidraw scene JSON to stdout. Redirect to a file:

```bash
node /sandbox/skills/excalidraw/scripts/mermaid-to-excalidraw.js "graph TD; A-->B" > /sandbox/output/diagram.excalidraw
```

### Direct Excalidraw JSON

For precise layout control, construct elements directly. This is useful for wireframes, custom layouts, and designs that don't map to mermaid syntax.

## Element Types

### Rectangle

```json
{
  "type": "rectangle",
  "id": "rect-1",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 100,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100,
  "roundness": { "type": 3 },
  "angle": 0
}
```

### Ellipse

```json
{
  "type": "ellipse",
  "id": "ellipse-1",
  "x": 100,
  "y": 100,
  "width": 200,
  "height": 150,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#b2f2bb",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100
}
```

### Diamond

```json
{
  "type": "diamond",
  "id": "diamond-1",
  "x": 100,
  "y": 100,
  "width": 150,
  "height": 150,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#ffec99",
  "fillStyle": "hachure",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100
}
```

### Text

```json
{
  "type": "text",
  "id": "text-1",
  "x": 100,
  "y": 100,
  "text": "Hello World",
  "fontSize": 20,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle",
  "strokeColor": "#1e1e1e",
  "opacity": 100
}
```

Font families: `1` = Virgil (hand-drawn), `2` = Helvetica, `3` = Cascadia (monospace).

### Arrow

```json
{
  "type": "arrow",
  "id": "arrow-1",
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 0,
  "points": [[0, 0], [300, 0]],
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100,
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "startBinding": {
    "elementId": "rect-1",
    "focus": 0,
    "gap": 5
  },
  "endBinding": {
    "elementId": "rect-2",
    "focus": 0,
    "gap": 5
  }
}
```

### Line

Same as arrow but with `"type": "line"` and no arrowheads.

### Freedraw

```json
{
  "type": "freedraw",
  "id": "draw-1",
  "x": 100,
  "y": 100,
  "points": [[0, 0], [10, 5], [20, 15], [30, 10]],
  "strokeColor": "#1e1e1e",
  "strokeWidth": 2,
  "roughness": 1,
  "opacity": 100
}
```

## Common Properties

All elements share these properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Element type |
| `id` | string | Unique identifier (use descriptive IDs) |
| `x`, `y` | number | Position (top-left corner) |
| `width`, `height` | number | Dimensions |
| `strokeColor` | string | Border/stroke color (hex) |
| `backgroundColor` | string | Fill color (hex, or `"transparent"`) |
| `fillStyle` | string | `"hachure"`, `"cross-hatch"`, `"solid"` |
| `strokeWidth` | number | Line thickness (1, 2, or 4) |
| `roughness` | number | `0` = sharp, `1` = normal, `2` = very rough |
| `opacity` | number | 0–100 |
| `angle` | number | Rotation in radians |
| `roundness` | object | `null` for sharp corners, `{ "type": 3 }` for rounded |
| `groupIds` | string[] | Group membership |
| `isDeleted` | boolean | Soft delete flag |
| `locked` | boolean | Lock from editing |

## Color Palette

Excalidraw's default palette:

| Color | Hex | Use |
|-------|-----|-----|
| Black | `#1e1e1e` | Default stroke |
| Red | `#e03131` | Alerts, errors |
| Pink | `#c2255c` | Highlights |
| Grape | `#9c36b5` | Accent |
| Violet | `#6741d9` | Secondary |
| Indigo | `#3b5bdb` | Primary |
| Blue | `#1971c2` | Info |
| Cyan | `#0c8599` | Cool accent |
| Teal | `#099268` | Success |
| Green | `#2f9e44` | Positive |
| Lime | `#66a80f` | Nature |
| Yellow | `#f08c00` | Warning |
| Orange | `#e8590c` | Attention |

Background fills (lighter variants): `#ffc9c9`, `#eebefa`, `#a5d8ff`, `#b2f2bb`, `#ffec99`, etc.

## Bindings (Connecting Shapes)

To connect an arrow to shapes:

1. Create the source and target shapes with known IDs
2. Create an arrow with `startBinding` and `endBinding`:

```json
{
  "startBinding": {
    "elementId": "source-shape-id",
    "focus": 0,
    "gap": 5
  },
  "endBinding": {
    "elementId": "target-shape-id",
    "focus": 0,
    "gap": 5
  }
}
```

- `focus`: -1 to 1, controls where the arrow attaches (0 = center)
- `gap`: pixel distance between arrow endpoint and shape border

The source/target shapes must have `boundElements` referencing the arrow:

```json
{
  "id": "source-shape-id",
  "boundElements": [{ "id": "arrow-id", "type": "arrow" }]
}
```

## Text Containers

To place text inside a shape, use `containerId` on the text element:

```json
{
  "type": "text",
  "id": "label-1",
  "containerId": "rect-1",
  "text": "My Label",
  "textAlign": "center",
  "verticalAlign": "middle"
}
```

And add the text to the container's `boundElements`:

```json
{
  "id": "rect-1",
  "boundElements": [{ "id": "label-1", "type": "text" }]
}
```

## Diagram Patterns

### Flowchart

Use rectangles for steps, diamonds for decisions, arrows for flow. Layout top-to-bottom or left-to-right with consistent spacing (e.g., 50px gaps).

### Architecture Diagram

Use rectangles for components/services, group related elements with `groupIds`. Use dashed strokes (`strokeStyle: "dashed"`) for boundaries. Color-code by layer (frontend=blue, backend=green, data=yellow).

### Wireframe

Use rectangles with `roughness: 0` for clean lines. Use `fillStyle: "solid"` with light grays for placeholder content. Include text elements for labels. Standard widths: mobile=375px, tablet=768px, desktop=1440px (scale down by 4x for diagram).

### Sequence Diagram

Use vertical lines for actors (lifelines), horizontal arrows for messages. Space actors 200px apart. Add text labels to each arrow.

## Tips

- **Consistent spacing**: Use a grid of 20px or 40px for alignment
- **ID naming**: Use descriptive IDs like `"user-service-box"`, `"auth-arrow"`
- **Groups**: Group related elements for easier selection by users
- **Roughness**: Use `1` for the classic hand-drawn look, `0` for clean diagrams
- **Colors**: Limit to 3–4 colors per diagram for clarity
- **Font size**: 16–20 for labels, 12–14 for annotations
- **Always set `version: 2`** in the scene JSON

## Modifying Existing Diagrams

When the user asks to change a diagram:

1. Parse the current scene JSON from context
2. Find elements by their IDs or text content
3. Modify properties (position, color, text, connections)
4. Add or remove elements as needed
5. Write the updated JSON to `/sandbox/output/`

Preserve element IDs when modifying — this helps the frontend track changes.
