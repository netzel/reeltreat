// Central Studio state + actions, provided via React context.
// Mirrors the prototype's single-component state so screens stay thin.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type {
  AuthMode,
  AuthStep,
  CaptureState,
  ConnectMode,
  ExportState,
  Screen,
  Theme,
  Tier,
} from "./types";

interface StudioState {
  screen: Screen;
  theme: Theme;
  tier: Tier;
  selClip: string;
  playing: boolean;
  cropOpen: boolean;
  manualOpen: boolean;
  connectMode: ConnectMode;
  authMode: AuthMode;
  authStep: AuthStep;
  captureState: CaptureState;
  exportState: ExportState;
}

interface StudioActions {
  nav: (screen: Screen) => void;
  setTheme: (t: Theme) => void;
  setTier: (t: Tier) => void;
  selectClip: (id: string) => void;
  togglePlay: () => void;
  setCropOpen: (open: boolean) => void;
  setManualOpen: (open: boolean) => void;
  setConnectMode: (m: ConnectMode) => void;
  setAuthMode: (m: AuthMode) => void;
  setAuthStep: (s: AuthStep) => void;
  openChrome: () => void;
  setCaptureState: (s: CaptureState) => void;
  startExport: () => void;
  resetExport: () => void;
}

type StudioContextValue = StudioState & StudioActions;

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>({
    screen: "frame",
    theme: "dark",
    tier: "15",
    selClip: "analytics",
    playing: false,
    cropOpen: false,
    manualOpen: false,
    connectMode: "repo",
    authMode: "stealth",
    authStep: "idle",
    captureState: "done",
    exportState: "idle",
  });

  const patch = (p: Partial<StudioState>) => setState((s) => ({ ...s, ...p }));

  const actions = useMemo<StudioActions>(
    () => ({
      nav: (screen) => patch({ screen, cropOpen: false }),
      setTheme: (theme) => patch({ theme }),
      setTier: (tier) => patch({ tier }),
      selectClip: (selClip) => patch({ selClip }),
      togglePlay: () => setState((s) => ({ ...s, playing: !s.playing })),
      setCropOpen: (cropOpen) => patch({ cropOpen }),
      setManualOpen: (manualOpen) => patch({ manualOpen }),
      setConnectMode: (connectMode) => patch({ connectMode }),
      setAuthMode: (authMode) => patch({ authMode }),
      setAuthStep: (authStep) => patch({ authStep }),
      openChrome: () => {
        patch({ authStep: "opening" });
        // Simulated launch → "sign in" prompt. Real bridge will drive this.
        setTimeout(() => patch({ authStep: "active" }), 1100);
      },
      setCaptureState: (captureState) => patch({ captureState }),
      startExport: () => {
        patch({ exportState: "rendering" });
        setTimeout(() => patch({ exportState: "done" }), 2600);
      },
      resetExport: () => patch({ exportState: "idle" }),
    }),
    [],
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}
