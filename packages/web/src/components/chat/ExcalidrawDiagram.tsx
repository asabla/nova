import { useState, useCallback, useRef, useEffect, lazy, Suspense, useMemo } from "react";
import { clsx } from "clsx";
import { Pencil, Eye, Download, ChevronDown, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

// Point Excalidraw to locally-served assets (fonts, wasm) instead of CDN
if (typeof window !== "undefined" && !(window as any).EXCALIDRAW_ASSET_PATH) {
  (window as any).EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
}

const Excalidraw = lazy(async () => {
  const [mod] = await Promise.all([
    import("@excalidraw/excalidraw"),
    import("@excalidraw/excalidraw/index.css"),
  ]);
  return { default: mod.Excalidraw };
});

// Excalidraw v0.18 loads drawing fonts (Virgil, Excalifont, Cascadia) via JS,
// not CSS @font-face. The font subsetting worker crashes in Vite builds
// ("window is not defined"), so we manually load the fonts we need.
let fontsLoaded = false;
const ensureFonts = async () => {
  if (fontsLoaded) return;
  const basePath = (window as any).EXCALIDRAW_ASSET_PATH || "/excalidraw-assets/";
  const fontsToLoad = [
    { family: "Virgil", url: `${basePath}fonts/Virgil/Virgil-Regular.woff2` },
    { family: "Cascadia", url: `${basePath}fonts/Cascadia/CascadiaCode-Regular.woff2` },
  ];
  await Promise.all(
    fontsToLoad.map(async ({ family, url }) => {
      if (document.fonts.check(`16px "${family}"`)) return;
      try {
        const font = new FontFace(family, `url(${url})`, { style: "normal", weight: "400" });
        const loaded = await font.load();
        document.fonts.add(loaded);
      } catch {
        // Font load failed — text will use fallback
      }
    }),
  );
  // Load Excalifont subsets (the primary hand-drawn font in v0.18)
  const excalifontSubsets = [
    "Excalifont-Regular-a88b72a24fb54c9f94e3b5fdaa7481c9.woff2",
    "Excalifont-Regular-41b173a47b57366892116a575a43e2b6.woff2",
  ];
  if (!document.fonts.check('16px "Excalifont"')) {
    await Promise.all(
      excalifontSubsets.map(async (file) => {
        try {
          const font = new FontFace("Excalifont", `url(${basePath}fonts/Excalifont/${file})`, { style: "normal", weight: "400" });
          const loaded = await font.load();
          document.fonts.add(loaded);
        } catch { /* skip unavailable subsets */ }
      }),
    );
  }
  fontsLoaded = true;
};

const exportToSvgFn = async (
  elements: readonly any[],
  appState: Record<string, any>,
  files: any,
) => {
  await ensureFonts();
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  return exportToSvg({ elements: elements as any, appState, files });
};

const exportToBlobFn = async (
  elements: readonly any[],
  appState: Record<string, any>,
  files: any,
) => {
  await ensureFonts();
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  return exportToBlob({ elements: elements as any, appState, files });
};

interface ExcalidrawDiagramProps {
  artifactId: string;
  initialScene: string; // JSON string
  readOnly?: boolean;
  fullscreen?: boolean;
  onSceneUpdate?: (json: string) => void;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute("data-theme");
      if (attr) setIsDark(attr === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export function ExcalidrawDiagram({
  artifactId,
  initialScene,
  readOnly = false,
  fullscreen = false,
  onSceneUpdate,
}: ExcalidrawDiagramProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const svgRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = useIsDark();

  // Measure container width for Excalidraw canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(el);
    setContainerWidth(Math.floor(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  const parsedScene = useMemo(() => {
    try {
      return JSON.parse(initialScene);
    } catch {
      return { elements: [], appState: {}, files: {} };
    }
  }, [initialScene]);

  // Track the latest scene for view mode rendering (survives edit→view transitions)
  const [currentScene, setCurrentScene] = useState(parsedScene);
  const sceneRef = useRef(parsedScene);
  const lastSavedElementsRef = useRef<string>("");

  // Render static SVG for view mode
  useEffect(() => {
    if (isEditing || !svgRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const elements = currentScene.elements ?? [];
        if (elements.length === 0) return;

        const svg = await exportToSvgFn(
          elements,
          {
            ...currentScene.appState,
            exportBackground: true,
            viewBackgroundColor: currentScene.appState?.viewBackgroundColor ?? "#ffffff",
          },
          currentScene.files ?? {},
        );

        if (!cancelled && svgRef.current) {
          svgRef.current.innerHTML = "";
          svg.style.width = "100%";
          svg.style.height = "auto";
          if (!fullscreen) svg.style.maxHeight = "400px";
          svgRef.current.appendChild(svg);
        }
      } catch {
        if (!cancelled && svgRef.current) {
          svgRef.current.innerHTML = `<p class="text-xs text-text-tertiary p-4">Failed to render diagram</p>`;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isEditing, currentScene, isDark]);

  // Auto-save mutation
  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      api.patch(`/api/artifacts/${artifactId}`, { content }),
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("idle"),
  });

  // Debounced save — only triggers when elements actually change
  const handleChange = useCallback(
    (elements: readonly any[], appState: any, files: any) => {
      const filteredElements = elements.filter((e: any) => !e.isDeleted);
      const scene = {
        type: "excalidraw",
        version: 2,
        elements: filteredElements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
          gridSize: appState.gridSize ?? null,
        },
        files: files ?? {},
      };
      sceneRef.current = scene;

      if (readOnly) return;

      // Compare elements to avoid saving on viewport/cursor-only changes
      const elementsJson = JSON.stringify(filteredElements);
      if (elementsJson === lastSavedElementsRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const json = JSON.stringify(scene);
        lastSavedElementsRef.current = elementsJson;
        setCurrentScene(scene);
        setSaveStatus("saving");
        saveMutation.mutate(json);
        onSceneUpdate?.(json);
      }, 1000);
    },
    [readOnly, saveMutation, onSceneUpdate],
  );

  // Export handlers
  const handleExportPng = useCallback(async () => {
    const scene = sceneRef.current;
    const blob = await exportToBlobFn(
      scene.elements ?? [],
      { ...scene.appState, exportBackground: true },
      scene.files ?? {},
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.png";
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  const handleExportSvg = useCallback(async () => {
    const scene = sceneRef.current;
    const svg = await exportToSvgFn(
      scene.elements ?? [],
      { ...scene.appState, exportBackground: true },
      scene.files ?? {},
    );
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  const handleExportExcalidraw = useCallback(() => {
    const json = JSON.stringify(sceneRef.current, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.excalidraw";
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => setShowExportMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showExportMenu]);

  const initialData: ExcalidrawInitialDataState = useMemo(() => ({
    elements: currentScene.elements ?? [],
    appState: {
      ...currentScene.appState,
      theme: isDark ? "dark" : "light",
    },
    files: currentScene.files,
  }), [currentScene, isDark]);

  // Flush pending changes and update view when exiting edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Switching to view — flush any pending save and update scene
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const scene = sceneRef.current;
      const json = JSON.stringify(scene);
      const elementsJson = JSON.stringify(scene.elements ?? []);
      if (elementsJson !== lastSavedElementsRef.current) {
        lastSavedElementsRef.current = elementsJson;
        setSaveStatus("saving");
        saveMutation.mutate(json);
        onSceneUpdate?.(json);
      }
      setCurrentScene(scene);
    }
    setIsEditing(!isEditing);
  }, [isEditing, saveMutation, onSceneUpdate]);

  return (
    <div ref={containerRef} className={clsx("relative w-full min-w-0", fullscreen && "flex flex-col h-full")}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-surface-tertiary/30">
        {!readOnly && (
          <button
            onClick={handleToggleEdit}
            className={clsx(
              "flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
              isEditing
                ? "bg-primary/10 text-primary border-primary/20"
                : "text-text-tertiary hover:text-text-secondary border-transparent hover:border-border",
            )}
          >
            {isEditing ? (
              <>
                <Eye className="h-3 w-3" /> View
              </>
            ) : (
              <>
                <Pencil className="h-3 w-3" /> Edit
              </>
            )}
          </button>
        )}

        {saveStatus !== "idle" && (
          <span className="text-[10px] text-text-tertiary flex items-center gap-1">
            {saveStatus === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
            {saveStatus === "saved" && "Saved"}
          </span>
        )}

        <div className="flex-1" />

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }}
            className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary px-2 py-1 rounded"
          >
            <Download className="h-3 w-3" /> Export <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
              <button onClick={handleExportPng} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary">
                PNG
              </button>
              <button onClick={handleExportSvg} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary">
                SVG
              </button>
              <button onClick={handleExportExcalidraw} className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-tertiary">
                .excalidraw
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <Suspense
          fallback={
            <div className={clsx("flex items-center justify-center text-text-tertiary", fullscreen ? "flex-1" : "h-[400px]")}>
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading editor...
            </div>
          }
        >
          {containerWidth > 0 ? (
            <div
              className={clsx("excalidraw-container", fullscreen && "flex-1")}
              style={{ width: containerWidth, height: fullscreen ? undefined : 500, position: "relative", overflow: "hidden" }}
            >
              <Excalidraw
                initialData={initialData}
                onChange={handleChange}
                theme={isDark ? "dark" : "light"}
                UIOptions={{
                  canvasActions: {
                    export: false,
                    saveToActiveFile: false,
                    loadScene: false,
                    clearCanvas: true,
                  },
                  tools: { image: false },
                }}
                excalidrawAPI={(excalidrawApi) => { apiRef.current = excalidrawApi; }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-text-tertiary">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading editor...
            </div>
          )}
        </Suspense>
      ) : (
        <div
          ref={svgRef}
          className={clsx("flex justify-center p-4 overflow-auto cursor-pointer min-h-[100px]", fullscreen && "flex-1 items-center")}
          onClick={() => !readOnly && handleToggleEdit()}
          title={readOnly ? undefined : "Click to edit"}
        />
      )}
    </div>
  );
}
