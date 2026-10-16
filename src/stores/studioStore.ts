import { create } from "zustand";

export type StudioMode = "studio" | "lifestyle" | "background" | "catalog" | "social";
export type StudioQuality = "low" | "medium" | "high";
export type StudioAspectRatio = "square" | "portrait" | "landscape";
export type StudioResolution = "1K" | "2K" | "4K";

type StudioState = {
  prompt: string;
  mode: StudioMode;
  quality: StudioQuality;
  aspectRatio: StudioAspectRatio;
  resolution: StudioResolution;
  setPrompt: (prompt: string) => void;
  setMode: (mode: StudioMode) => void;
  setQuality: (quality: StudioQuality) => void;
  setAspectRatio: (aspectRatio: StudioAspectRatio) => void;
  setResolution: (resolution: StudioResolution) => void;
  reset: () => void;
};
const initial = {
  prompt: "Premium skincare bottle on warm travertine, soft directional daylight, realistic contact shadow, editorial commercial photography.",
  mode: "studio" as StudioMode,
  quality: "medium" as StudioQuality,
  aspectRatio: "square" as StudioAspectRatio,
  resolution: "1K" as StudioResolution,
};
export const useStudioStore = create<StudioState>((set) => ({
  ...initial,
  setPrompt: (prompt) => set({ prompt }),
  setMode: (mode) => set({ mode }),
  setQuality: (quality) => set({ quality }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setResolution: (resolution) => set({ resolution }),
  reset: () => set(initial),
}));
