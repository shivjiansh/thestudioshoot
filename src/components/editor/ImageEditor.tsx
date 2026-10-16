"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Check, Crop, Download, ImagePlus, LoaderCircle, Move, RotateCcw,
  SlidersHorizontal, Trash2, Type, Droplets, Layers3, ShieldCheck,
} from "lucide-react";

type LayerType = "text" | "logo" | "watermark";
type EditorLayer = {
  id: string;
  type: LayerType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  src?: string;
  repeat?: boolean;
};
type CropRect = { x: number; y: number; width: number; height: number };
type DragState =
  | { kind: "crop"; offsetX: number; offsetY: number }
  | { kind: "layer"; id: string; offsetX: number; offsetY: number }
  | null;
type ExportFormat = "jpeg" | "webp" | "pdf";

const FONTS = [
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Courier New", label: "Courier New" },
  { value: "Impact", label: "Impact" },
];

function fullCrop(width: number, height: number): CropRect {
  return { x: 0, y: 0, width, height };
}
function cropForRatio(width: number, height: number, ratio: number | null): CropRect {
  if (!ratio) return fullCrop(width, height);
  let cropWidth = width;
  let cropHeight = height;
  if (width / height > ratio) cropWidth = Math.round(height * ratio);
  else cropHeight = Math.round(width / ratio);
  return { x: Math.round((width - cropWidth) / 2), y: Math.round((height - cropHeight) / 2), width: cropWidth, height: cropHeight };
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load this image."));
    image.src = src;
  });
}
function layerContains(layer: EditorLayer, x: number, y: number) {
  return x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height;
}

type PaintArgs = {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  layers: EditorLayer[];
  selectedLayerId: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  cropMode: boolean;
  crop: CropRect;
  showGuides: boolean;
  logoCache: Map<string, HTMLImageElement>;
  requestRepaint: () => void;
};
function paintComposition({ canvas, image, layers, selectedLayerId, brightness, contrast, saturation, cropMode, crop, showGuides, logoCache, requestRepaint }: PaintArgs) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  context.drawImage(image, 0, 0, width, height);
  context.filter = "none";

  for (const layer of layers) {
    context.save();
    context.globalAlpha = layer.opacity;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    context.translate(centerX, centerY);
    context.rotate((layer.rotation * Math.PI) / 180);
    if (layer.type === "logo" && layer.src) {
      let logo = logoCache.get(layer.src);
      if (!logo) {
        logo = new Image();
        logo.onload = requestRepaint;
        logo.src = layer.src;
        logoCache.set(layer.src, logo);
      }
      if (logo.complete && logo.naturalWidth > 0) context.drawImage(logo, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
    } else if (layer.type === "watermark" && layer.repeat) {
      context.font = `${layer.fontSize}px "${layer.fontFamily}"`;
      context.fillStyle = layer.color;
      context.textBaseline = "middle";
      context.rotate((-35 * Math.PI) / 180);
      const span = Math.max(width, height) * 1.4;
      const stepX = Math.max(layer.fontSize * 7, width * 0.42);
      const stepY = Math.max(layer.fontSize * 4, height * 0.17);
      for (let y = -span; y <= span; y += stepY) {
        for (let x = -span; x <= span; x += stepX) context.fillText(layer.content, x, y);
      }
    } else {
      context.font = `${layer.fontSize}px "${layer.fontFamily}"`;
      context.fillStyle = layer.color;
      context.textBaseline = "top";
      context.fillText(layer.content, -layer.width / 2, -layer.height / 2, Math.max(layer.width, 1));
    }
    context.restore();
  }

  if (showGuides && selectedLayerId) {
    const selected = layers.find((layer) => layer.id === selectedLayerId);
    if (selected) {
      context.save();
      context.strokeStyle = "#c09469";
      context.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.003));
      context.setLineDash([Math.max(5, Math.round(Math.min(width, height) * 0.008)), Math.max(4, Math.round(Math.min(width, height) * 0.005))]);
      context.strokeRect(selected.x, selected.y, selected.width, selected.height);
      context.restore();
    }
  }

  if (showGuides && cropMode) {
    context.save();
    context.fillStyle = "rgba(12, 10, 8, .52)";
    context.fillRect(0, 0, width, crop.y);
    context.fillRect(0, crop.y + crop.height, width, height - crop.y - crop.height);
    context.fillRect(0, crop.y, crop.x, crop.height);
    context.fillRect(crop.x + crop.width, crop.y, width - crop.x - crop.width, crop.height);
    context.strokeStyle = "#fffaf2";
    context.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.003));
    context.setLineDash([Math.max(7, Math.round(Math.min(width, height) * 0.01)), Math.max(4, Math.round(Math.min(width, height) * 0.005))]);
    context.strokeRect(crop.x, crop.y, crop.width, crop.height);
    context.restore();
  }
}

export function ImageEditor({ assetId }: { assetId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState>(null);
  const logoCacheRef = useRef(new Map<string, HTMLImageElement>());
  const repaintRef = useRef<() => void>(() => undefined);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [sourceToken, setSourceToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const [activeTab, setActiveTab] = useState<"crop" | "adjust" | "layers">("adjust");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 1, height: 1 });
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setLoading(true);
    setLoadingError("");
    setBaseImage(null);
    setOriginalImage(null);
    setSourceToken("");
    fetch(`/api/assets/${encodeURIComponent(assetId)}/editor-source`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? `Could not open the editor (${response.status}).`);
        }
        const token = response.headers.get("X-Editor-Source-Token") ?? "";
        if (!token) throw new Error("The editor could not establish a secure editing session. Reload the page.");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        const image = await loadImage(objectUrl);
        if (cancelled) return;
        setSourceToken(token);
        setBaseImage(image);
        setOriginalImage(image);
        setCrop(fullCrop(image.naturalWidth, image.naturalHeight));
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadingError(cause instanceof Error ? cause.message : "Could not load the source image.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  const repaint = useCallback(() => {
    if (!canvasRef.current || !baseImage) return;
    paintComposition({
      canvas: canvasRef.current,
      image: baseImage,
      layers,
      selectedLayerId,
      brightness,
      contrast,
      saturation,
      cropMode,
      crop,
      showGuides: true,
      logoCache: logoCacheRef.current,
      requestRepaint: () => repaintRef.current(),
    });
  }, [baseImage, layers, selectedLayerId, brightness, contrast, saturation, cropMode, crop]);
  repaintRef.current = repaint;
  useEffect(() => { repaint(); }, [repaint]);

  const imageWidth = baseImage?.naturalWidth ?? 1;
  const imageHeight = baseImage?.naturalHeight ?? 1;
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId) ?? null;

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!baseImage) return;
    const point = canvasPoint(event);
    if (cropMode) {
      const inside = point.x >= crop.x && point.x <= crop.x + crop.width && point.y >= crop.y && point.y <= crop.y + crop.height;
      if (!inside) return;
      dragRef.current = { kind: "crop", offsetX: point.x - crop.x, offsetY: point.y - crop.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const hit = [...layers].reverse().find((layer) => layerContains(layer, point.x, point.y));
    setSelectedLayerId(hit?.id ?? null);
    if (hit) {
      dragRef.current = { kind: "layer", id: hit.id, offsetX: point.x - hit.x, offsetY: point.y - hit.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || !baseImage) return;
    const point = canvasPoint(event);
    if (drag.kind === "crop") {
      setCrop((current) => ({
        ...current,
        x: clamp(point.x - drag.offsetX, 0, imageWidth - current.width),
        y: clamp(point.y - drag.offsetY, 0, imageHeight - current.height),
      }));
    } else {
      setLayers((current) => current.map((layer) => layer.id === drag.id ? {
        ...layer,
        x: clamp(point.x - drag.offsetX, -layer.width + 10, imageWidth - 10),
        y: clamp(point.y - drag.offsetY, -layer.height + 10, imageHeight - 10),
      } : layer));
    }
  }
  function onPointerUp() { dragRef.current = null; }

  function selectCrop(ratio: number | null) {
    if (!baseImage) return;
    setCrop(cropForRatio(imageWidth, imageHeight, ratio));
    setCropMode(true);
    setActiveTab("crop");
    setSelectedLayerId(null);
  }
  async function applyCrop() {
    if (!baseImage) return;
    const width = Math.max(1, Math.round(crop.width));
    const height = Math.max(1, Math.round(crop.height));
    const temp = document.createElement("canvas");
    temp.width = width;
    temp.height = height;
    const context = temp.getContext("2d");
    if (!context) { setError("Your browser could not apply the crop."); return; }
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    context.drawImage(baseImage, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const dataUrl = temp.toDataURL("image/png");
    try {
      const cropped = await loadImage(dataUrl);
      setLayers((current) => current.map((layer) => ({
        ...layer,
        x: clamp(layer.x - crop.x, -layer.width + 10, width - 10),
        y: clamp(layer.y - crop.y, -layer.height + 10, height - 10),
      })));
      setBaseImage(cropped);
      setCrop(fullCrop(width, height));
      setCropMode(false);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setSuccess("Crop applied. Your current adjustments were preserved in the cropped image.");
      setError("");
    } catch {
      setError("Could not apply this crop. Please try again.");
    }
  }
  function cancelCrop() {
    setCrop(fullCrop(imageWidth, imageHeight));
    setCropMode(false);
  }

  function addLayer(type: "text" | "watermark") {
    const fontSize = Math.round(clamp(Math.min(imageWidth, imageHeight) * (type === "watermark" ? 0.045 : 0.055), 20, 112));
    const content = type === "watermark" ? "YOUR BRAND" : "Your headline";
    const layer: EditorLayer = {
      id: makeId(),
      type,
      name: type === "watermark" ? "Watermark" : "Text layer",
      x: Math.round(imageWidth * 0.31),
      y: Math.round(imageHeight * 0.43),
      width: Math.round(imageWidth * 0.4),
      height: Math.round(fontSize * 1.8),
      content,
      fontFamily: type === "watermark" ? "Arial" : "Georgia",
      fontSize,
      color: type === "watermark" ? "#ffffff" : "#191815",
      opacity: type === "watermark" ? 0.3 : 1,
      rotation: type === "watermark" ? -18 : 0,
      repeat: false,
    };
    setLayers((current) => [...current, layer]);
    setSelectedLayerId(layer.id);
    setActiveTab("layers");
    setSuccess("");
    setError("");
  }
  async function addLogo(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Please use a PNG, JPEG, or WebP logo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo files must be 5 MB or smaller.");
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read logo file."));
        reader.onerror = () => reject(new Error("Could not read logo file."));
        reader.readAsDataURL(file);
      });
      const logo = await loadImage(dataUrl);
      const scale = Math.min(
        (imageWidth * 0.28) / Math.max(1, logo.naturalWidth),
        (imageHeight * 0.25) / Math.max(1, logo.naturalHeight),
        1,
      );
      const width = Math.max(1, Math.round(logo.naturalWidth * scale));
      const height = Math.max(1, Math.round(logo.naturalHeight * scale));
      logoCacheRef.current.set(dataUrl, logo);
      const layer: EditorLayer = {
        id: makeId(), type: "logo", name: file.name.slice(0, 38), x: Math.round(imageWidth * 0.68), y: Math.round(imageHeight * 0.75),
        width, height: Math.min(height, Math.round(imageHeight * 0.25)), content: "", fontFamily: "Arial", fontSize: 32,
        color: "#ffffff", opacity: 1, rotation: 0, src: dataUrl,
      };
      setLayers((current) => [...current, layer]);
      setSelectedLayerId(layer.id);
      setActiveTab("layers");
      setError("");
      setSuccess("Logo added. Drag it on the image or use the position fields for exact placement.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the logo.");
    }
  }
  function updateSelected(patch: Partial<EditorLayer>) {
    if (!selectedLayerId) return;
    setLayers((current) => current.map((layer) => layer.id === selectedLayerId ? { ...layer, ...patch } : layer));
  }
  function removeSelected() {
    if (!selectedLayerId) return;
    setLayers((current) => current.filter((layer) => layer.id !== selectedLayerId));
    setSelectedLayerId(null);
  }
  function moveSelectedLayer(direction: -1 | 1) {
    if (!selectedLayerId) return;
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === selectedLayerId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }
  function resetAdjustments() {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  }
  function resetEditor() {
    setLayers([]);
    setSelectedLayerId(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    if (originalImage) {
      setBaseImage(originalImage);
      setCrop(fullCrop(originalImage.naturalWidth, originalImage.naturalHeight));
    } else {
      setCrop(fullCrop(imageWidth, imageHeight));
    }
    setCropMode(false);
    setError("");
    setSuccess("Editor reset to the original source image. The saved asset was never modified.");
  }

  async function exportAs(format: ExportFormat) {
    if (!baseImage || !sourceToken) return;
    if (cropMode) {
      setError("Apply or cancel the crop before exporting.");
      setActiveTab("crop");
      return;
    }
    setBusyFormat(format);
    setError("");
    setSuccess("");
    try {
      const canvas = document.createElement("canvas");
      paintComposition({
        canvas,
        image: baseImage,
        layers,
        selectedLayerId: null,
        brightness,
        contrast,
        saturation,
        cropMode: false,
        crop: fullCrop(imageWidth, imageHeight),
        showGuides: false,
        logoCache: logoCacheRef.current,
        requestRepaint: () => repaintRef.current(),
      });
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        const qualities = [0.9, 0.86, 0.82, 0.78, 0.74];
        const tryQuality = (index: number) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("Your browser could not prepare this export.")); return; }
            if (blob.size <= 3.8 * 1024 * 1024) { resolve(blob); return; }
            if (index + 1 < qualities.length) { tryQuality(index + 1); return; }
            reject(new Error("This image is too large to export in one request. Apply a tighter crop and try again."));
          }, "image/jpeg", qualities[index]);
        };
        tryQuality(0);
      });
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/editor-export`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "image/jpeg",
          "Idempotency-Key": makeId(),
          "X-Editor-Source-Token": sourceToken,
          "X-Export-Format": format,
        },
        body: imageBlob,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Export failed (${response.status}).`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `thestudioshot-edited-${assetId}.${format === "jpeg" ? "jpg" : format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
      setSuccess(`${format.toUpperCase()} export is ready. One export allowance was used.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed. Please try again.");
    } finally {
      setBusyFormat(null);
    }
  }

  return (
    <section className="image-editor panel" aria-labelledby="image-editor-title">
      <div className="image-editor-heading">
        <div>
          <span className="eyebrow">POST-PRODUCTION</span>
          <h2 id="image-editor-title">Image editor</h2>
          <p>Fine-tune the generated image, position brand assets, and export a finished creative.</p>
        </div>
        <div className="editor-security"><ShieldCheck size={15} /> Secure source · export limits apply</div>
      </div>

      {loading && <div className="editor-loading"><LoaderCircle className="spin" size={21} /> Preparing the high-quality editing source…</div>}
      {loadingError && <div className="notice" role="alert">{loadingError}<button className="editor-inline-button" type="button" onClick={() => window.location.reload()}>Reload page</button></div>}

      {!loading && !loadingError && baseImage && (
        <>
          <div className="editor-workspace">
            <div className="editor-canvas-panel">
              <div className="editor-canvas-topline">
                <span>{imageWidth.toLocaleString()} × {imageHeight.toLocaleString()} px</span>
                <span>{cropMode ? "Crop mode · drag the crop frame to reposition" : selectedLayer ? `Selected: ${selectedLayer.name}` : "Select a layer to move or edit it"}</span>
              </div>
              <div className={`editor-canvas-container${cropMode ? " is-cropping" : ""}`}>
                <canvas
                  ref={canvasRef}
                  aria-label="Image canvas. Drag text, logo and watermark layers to position them."
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={cropMode ? "editor-canvas crop-cursor" : "editor-canvas"}
                />
              </div>
              <div className="editor-canvas-note"><Move size={13} /> {cropMode ? "Drag inside the crop frame. Choose Apply crop when framing is right." : "Drag an active layer on the canvas, or type exact X / Y coordinates."}</div>
            </div>

            <aside className="editor-tools">
              <div className="editor-tablist" role="tablist" aria-label="Image editing tools">
                <button type="button" role="tab" aria-selected={activeTab === "crop"} className={activeTab === "crop" ? "active" : ""} onClick={() => setActiveTab("crop")}><Crop size={15} /> Crop</button>
                <button type="button" role="tab" aria-selected={activeTab === "adjust"} className={activeTab === "adjust" ? "active" : ""} onClick={() => setActiveTab("adjust")}><SlidersHorizontal size={15} /> Adjust</button>
                <button type="button" role="tab" aria-selected={activeTab === "layers"} className={activeTab === "layers" ? "active" : ""} onClick={() => setActiveTab("layers")}><Layers3 size={15} /> Layers</button>
              </div>

              {activeTab === "crop" && (
                <div className="editor-tool-content">
                  <h3>Crop and framing</h3>
                  <p className="editor-help">Choose a crop ratio, then drag the frame over the area to keep.</p>
                  <div className="crop-presets">
                    <button type="button" onClick={() => selectCrop(null)} className={cropMode && crop.width === imageWidth && crop.height === imageHeight ? "selected" : ""}>Original</button>
                    <button type="button" onClick={() => selectCrop(1)}>1:1 <small>Square</small></button>
                    <button type="button" onClick={() => selectCrop(4 / 5)}>4:5 <small>Portrait</small></button>
                    <button type="button" onClick={() => selectCrop(16 / 9)}>16:9 <small>Landscape</small></button>
                    <button type="button" onClick={() => selectCrop(3 / 2)}>3:2 <small>Wide</small></button>
                  </div>
                  {cropMode && <div className="crop-values"><span>Frame size</span><strong>{Math.round(crop.width)} × {Math.round(crop.height)} px</strong><span>Position</span><strong>X {Math.round(crop.x)} · Y {Math.round(crop.y)}</strong></div>}
                  <div className="editor-action-row">
                    <button type="button" className="button light" onClick={cancelCrop} disabled={!cropMode}>Cancel</button>
                    <button type="button" className="button dark" onClick={applyCrop} disabled={!cropMode}><Check size={14} /> Apply crop</button>
                  </div>
                </div>
              )}

              {activeTab === "adjust" && (
                <div className="editor-tool-content">
                  <h3>Image adjustments</h3>
                  <p className="editor-help">Changes are non-destructive until applied through crop or export.</p>
                  <label className="editor-slider"><span><b>Brightness</b><output>{brightness}%</output></span><input aria-label="Brightness" type="range" min="50" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /><small>Lighten or darken the image</small></label>
                  <label className="editor-slider"><span><b>Contrast</b><output>{contrast}%</output></span><input aria-label="Contrast" type="range" min="50" max="150" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /><small>Control separation between lights and shadows</small></label>
                  <label className="editor-slider"><span><b>Saturation</b><output>{saturation}%</output></span><input aria-label="Saturation" type="range" min="0" max="200" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} /><small>Change the intensity of color</small></label>
                  <button type="button" className="button light full" onClick={resetAdjustments}><RotateCcw size={14} /> Reset adjustments</button>
                </div>
              )}

              {activeTab === "layers" && (
                <div className="editor-tool-content">
                  <h3>Layers and branding</h3>
                  <p className="editor-help">Add editable layers. Select a layer to change its content, styling, opacity, and exact position.</p>
                  <div className="editor-add-layer-row">
                    <button type="button" onClick={() => addLayer("text")}><Type size={15} /> Add text</button>
                    <button type="button" onClick={() => logoInputRef.current?.click()}><ImagePlus size={15} /> Add logo</button>
                    <button type="button" onClick={() => addLayer("watermark")}><Droplets size={15} /> Watermark</button>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => { void addLogo(event.target.files?.[0]); event.target.value = ""; }} />
                  </div>
                  {layers.length > 0 ? (
                    <div className="editor-layer-list" aria-label="Layers">
                      {[...layers].reverse().map((layer) => (
                        <button key={layer.id} type="button" className={selectedLayerId === layer.id ? "editor-layer selected" : "editor-layer"} onClick={() => setSelectedLayerId(layer.id)}>
                          <span className="editor-layer-icon">{layer.type === "logo" ? <ImagePlus size={14} /> : layer.type === "watermark" ? <Droplets size={14} /> : <Type size={14} />}</span>
                          <span><b>{layer.name}</b><small>{layer.type === "logo" ? "Image asset" : layer.content || layer.type}</small></span>
                          <span className="editor-layer-position">{Math.round(layer.x)}, {Math.round(layer.y)}</span>
                        </button>
                      ))}
                    </div>
                  ) : <div className="editor-empty-layers"><Layers3 size={22} /><span>No layers yet</span><small>Add text, your logo, or a watermark.</small></div>}

                  {selectedLayer && (
                    <div className="editor-layer-controls">
                      <div className="editor-selected-title"><b>Selected layer</b><div className="editor-layer-order"><button type="button" aria-label="Send layer backward" title="Send backward" onClick={() => moveSelectedLayer(-1)}><ArrowDown size={14} /></button><button type="button" aria-label="Bring layer forward" title="Bring forward" onClick={() => moveSelectedLayer(1)}><ArrowUp size={14} /></button><button type="button" aria-label="Delete selected layer" title="Delete layer" onClick={removeSelected}><Trash2 size={14} /></button></div></div>
                      {selectedLayer.type !== "logo" && <label className="editor-field">Text content<input value={selectedLayer.content} maxLength={180} onChange={(event) => updateSelected({ content: event.target.value, name: selectedLayer.type === "watermark" ? "Watermark" : "Text layer", width: Math.max(selectedLayer.width, Math.round(imageWidth * 0.2)) })} /></label>}
                      <div className="editor-field-grid">
                        <label className="editor-field">X position<input type="number" min={-selectedLayer.width} max={imageWidth} value={Math.round(selectedLayer.x)} onChange={(event) => updateSelected({ x: clamp(Number(event.target.value), -selectedLayer.width, imageWidth) })} /></label>
                        <label className="editor-field">Y position<input type="number" min={-selectedLayer.height} max={imageHeight} value={Math.round(selectedLayer.y)} onChange={(event) => updateSelected({ y: clamp(Number(event.target.value), -selectedLayer.height, imageHeight) })} /></label>
                      </div>
                      {selectedLayer.type === "logo" ? (
                        <label className="editor-field">Logo width <output>{Math.round(selectedLayer.width)} px</output><input type="range" min={Math.max(20, Math.round(imageWidth * 0.04))} max={Math.round(imageWidth * 0.75)} value={selectedLayer.width} onChange={(event) => {
                          const width = Number(event.target.value);
                          const logo = selectedLayer.src ? logoCacheRef.current.get(selectedLayer.src) : undefined;
                          const height = logo ? width * logo.naturalHeight / Math.max(1, logo.naturalWidth) : selectedLayer.height;
                          updateSelected({ width, height: Math.round(height) });
                        }} /></label>
                      ) : (
                        <>
                          <label className="editor-field">Font family<select value={selectedLayer.fontFamily} onChange={(event) => updateSelected({ fontFamily: event.target.value })}>{FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
                          <label className="editor-field">Font size <output>{selectedLayer.fontSize} px</output><input type="range" min="12" max={Math.min(220, Math.max(24, Math.round(Math.min(imageWidth, imageHeight) * 0.25)))} value={selectedLayer.fontSize} onChange={(event) => updateSelected({ fontSize: Number(event.target.value), height: Math.round(Number(event.target.value) * 1.8) })} /></label>
                          <label className="editor-field">Text color <span className="editor-color-control"><input aria-label="Text color" type="color" value={selectedLayer.color} onChange={(event) => updateSelected({ color: event.target.value })} /><span>{selectedLayer.color.toUpperCase()}</span></span></label>
                        </>
                      )}
                      <label className="editor-field">Opacity <output>{Math.round(selectedLayer.opacity * 100)}%</output><input type="range" min="5" max="100" value={Math.round(selectedLayer.opacity * 100)} onChange={(event) => updateSelected({ opacity: Number(event.target.value) / 100 })} /></label>
                      <label className="editor-field">Rotation <output>{selectedLayer.rotation}°</output><input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} /></label>
                      {selectedLayer.type === "watermark" && <label className="editor-checkbox"><input type="checkbox" checked={Boolean(selectedLayer.repeat)} onChange={(event) => updateSelected({ repeat: event.target.checked })} /> Repeat watermark across image</label>}
                    </div>
                  )}
                </div>
              )}

              <div className="editor-export-panel">
                <div><h3>Export finished image</h3><p>Each download uses one export allowance.</p></div>
                <button type="button" className="button dark full" onClick={() => void exportAs("jpeg")} disabled={!!busyFormat || cropMode}>{busyFormat === "jpeg" ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} Export JPEG</button>
                <button type="button" className="button light full" onClick={() => void exportAs("webp")} disabled={!!busyFormat || cropMode}>{busyFormat === "webp" ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} Export WEBP</button>
                <button type="button" className="button light full" onClick={() => void exportAs("pdf")} disabled={!!busyFormat || cropMode}>{busyFormat === "pdf" ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />} Export PDF</button>
                <small className="editor-export-note">The plan's output resolution and platform watermark rules remain in effect. PDF exports are single-page documents.</small>
              </div>
            </aside>
          </div>

          {(error || success) && <p className={error ? "notice editor-message error-message" : "notice success editor-message"} role={error ? "alert" : "status"}>{error || success}</p>}
          <div className="editor-footer-row"><span><Check size={14} /> Changes are applied to exported files; your original asset stays unchanged.</span><button type="button" className="editor-reset-button" onClick={resetEditor}><RotateCcw size={13} /> Reset editor</button></div>
        </>
      )}
    </section>
  );
}
