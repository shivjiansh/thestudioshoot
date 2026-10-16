"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ImagePlus,
  LoaderCircle,
  Sparkles,
  Upload,
  Camera,
  WandSparkles,
} from "lucide-react";
import {
  useStudio,
  validateProductImage,
  prepareProductImage,
} from "@/hooks/useStudio";
import { ExportButton } from "@/components/assets/ExportButton";
import { ImageEditor } from "@/components/editor/ImageEditor";
import type {
  StudioAspectRatio,
  StudioMode,
  StudioQuality,
  StudioResolution,
} from "@/stores/studioStore";

type Result = {
  jobId: string;
  status: string;
  resultUrl: string;
  creditsReserved: number;
  requestId: string;
  resolution: StudioResolution;
  requestedSize: string;
};
export default function Studio() {
  const {
    prompt,
    mode,
    quality,
    aspectRatio,
    resolution,
    setPrompt,
    setMode,
    setQuality,
    setAspectRatio,
    setResolution,
  } = useStudio();
  const [file, setFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [savedAsset, setSavedAsset] = useState<{
    assetId: string;
    previewUrl: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(nextFile?: File) {
    if (!nextFile) return;
    const validationError = validateProductImage(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFile(nextFile);
    setResult(null);
    setSavedAsset(null);
    setImageDataUrl("");
    setError("");
    setPreparing(true);
    try {
      setImageDataUrl(await prepareProductImage(nextFile));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not prepare this image.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function saveSourceImage() {
    if (!imageDataUrl) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/studio/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string };
        assetId?: string;
        previewUrl?: string;
      } | null;
      if (!response.ok)
        throw new Error(
          data?.error?.message ??
            `Could not save source image (${response.status}).`,
        );
      if (!data?.assetId || !data.previewUrl)
        throw new Error("The server returned an incomplete asset reference.");
      setSavedAsset({ assetId: data.assetId, previewUrl: data.previewUrl });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save source image.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          prompt,
          mode,
          quality,
          aspectRatio,
          resolution,
          imageDataUrl: imageDataUrl || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | ({
            error?: { message?: string };
            requestId?: string;
          } & Partial<Result>)
        | null;
      if (!response.ok)
        throw new Error(
          `${data?.error?.message ?? `Generation failed (${response.status}).`}${data?.requestId ? ` Request ID: ${data.requestId}` : ""}`,
        );
      if (!data?.resultUrl || !data.jobId)
        throw new Error("The server returned an incomplete generation result.");
      setSavedAsset(null);
      setResult(data as Result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="dash-head">
        <div>
          <span className="eyebrow">THE CREATIVE WORKSPACE</span>
          <h1>AI Studio</h1>
          <p>
            Describe a scene, set the creative direction, and generate a product
            image.
          </p>
        </div>
        <Link href="/history">View history ↗</Link>
      </header>
      <div className="studio-grid">
        <form className="panel" onSubmit={generate}>
          <h2 style={{ font: "25px var(--serif)" }}>Build your scene</h2>
          <div className="field">
            <label>Product image (optional for text-to-image)</label>

            {/* Upload an existing image */}
            <label className="upload" htmlFor="product-image">
              <Upload size={21} />

              <input
                id="product-image"
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const selectedFile = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";

                  if (selectedFile) {
                    upload(selectedFile);
                  }
                }}
              />

              <p>
                {preparing
                  ? "Compressing image for secure upload…"
                  : file
                    ? `${file.name} · compressed before upload`
                    : "Upload an image · JPEG, PNG, or WebP · up to 20 MB"}
              </p>
            </label>

            {/* Capture a new image using the mobile camera */}
            <label className="upload" htmlFor="product-camera">
              <Camera size={21} />

              <input
                id="product-camera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const selectedFile = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";

                  if (selectedFile) {
                    upload(selectedFile);
                  }
                }}
              />

              <p>
                {preparing
                  ? "Processing camera photo…"
                  : "Take a photo with your camera"}
              </p>
            </label>
          </div>
          <label className="field" htmlFor="prompt">
            Creative direction
            <textarea
              id="prompt"
              minLength={8}
              maxLength={1800}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label className="field" htmlFor="mode">
            Creative mode
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as StudioMode)}
            >
              <option value="studio">Studio product</option>
              <option value="lifestyle">Lifestyle scene</option>
              <option value="background">Background replacement</option>
              <option value="catalog">Catalog</option>
              <option value="social">Social campaign</option>
            </select>
          </label>
          <label className="field" htmlFor="quality">
            Quality
            <select
              id="quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value as StudioQuality)}
            >
              <option value="low">Low — fewer credits</option>
              <option value="medium">Medium</option>
              <option value="high">High — more credits</option>
            </select>
          </label>
          <label className="field" htmlFor="aspect-ratio">
            Aspect ratio
            <select
              id="aspect-ratio"
              value={aspectRatio}
              onChange={(e) =>
                setAspectRatio(e.target.value as StudioAspectRatio)
              }
            >
              <option value="square">Square</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </label>
          <label className="field" htmlFor="resolution">
            Output resolution
            <select
              id="resolution"
              value={resolution}
              onChange={(e) =>
                setResolution(e.target.value as StudioResolution)
              }
            >
              <option value="1K">1K — standard</option>
              <option value="2K">2K — higher detail</option>
              <option value="4K">4K — highest detail</option>
            </select>
            <small>
              Plan limits are enforced on the server. Custom 2K/4K sizes require
              support from your configured image model and account.
            </small>
          </label>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <button
            className="button dark full"
            disabled={busy || preparing || (!!file && !imageDataUrl)}
            type="submit"
          >
            {preparing ? (
              <>
                <LoaderCircle className="spin" size={16} /> Compressing…
              </>
            ) : busy ? (
              <>
                <LoaderCircle className="spin" size={16} /> Generating…
              </>
            ) : (
              <>
                <WandSparkles size={16} /> Generate image
              </>
            )}
          </button>
          {imageDataUrl && !savedAsset && !result && (
            <button
              className="button light full"
              style={{ marginTop: 10 }}
              type="button"
              onClick={saveSourceImage}
              disabled={importing || preparing || busy}
            >
              {importing ? (
                <>
                  <LoaderCircle className="spin" size={16} /> Saving to gallery…
                </>
              ) : (
                <>
                  <Upload size={15} /> Save source to gallery (no AI credits)
                </>
              )}
            </button>
          )}
          <p className="muted-copy">
            Credits are reserved on the server before generation. Failed jobs
            release the reservation through the credit ledger.
          </p>
        </form>
        <section className="panel">
          <h2 style={{ font: "25px var(--serif)" }}>Preview</h2>
          <div className="preview">
            {result ? (
              <img src={result.resultUrl} alt="AI-generated product image" />
            ) : savedAsset ? (
              <img
                src={savedAsset.previewUrl}
                alt="Imported product image preview"
              />
            ) : imageDataUrl ? (
              <img src={imageDataUrl} alt="Uploaded product preview" />
            ) : (
              <div
                style={{ padding: 25, textAlign: "center", color: "#817568" }}
              >
                <ImagePlus size={27} />
                <p>Your product preview will appear here.</p>
              </div>
            )}
          </div>
          {result && (
            <>
              {/* <p className="notice success">
                Generation complete. Job {result.jobId.slice(0, 8)}… ·{" "}
                {result.resolution} ({result.requestedSize}) ·{" "}
                {result.creditsReserved.toLocaleString("en-IN")} credits
                reserved.
              </p> */}
              <div style={{ marginTop: 12 }}>
                <ExportButton
                  assetId={result.jobId}
                  filename={`thestudioshot-${result.jobId}.png`}
                />
              </div>
            </>
          )}
          {savedAsset && (
            <>
              <p className="notice success">
                Source image saved to your gallery. This non-AI workflow uses no
                generation credits.
              </p>
              <div style={{ marginTop: 12 }}>
                <ExportButton
                  assetId={savedAsset.assetId}
                  filename={`thestudioshot-source-${savedAsset.assetId}.png`}
                />
              </div>
              <p>
                <Link href="/gallery">View in gallery ↗</Link>
              </p>
            </>
          )}
          <div className="notice" style={{ marginTop: 14 }}>
            AI generation requires Firebase Admin, private Firebase Storage, an
            OpenAI API key, an active paid subscription, and sufficient credits.
            Free users can save a compressed source image to the gallery and
            export with a watermark, without AI credits.
          </div>
        </section>
      </div>
      {result && (
        <div className="studio-editor-slot">
          <ImageEditor assetId={result.jobId} />
        </div>
      )}
    </>
  );
}
