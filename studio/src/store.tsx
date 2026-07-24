// Central Studio state + actions, provided via React context.
//
// Holds both UI state (which screen, theme, selected tier/clip, modals) and the
// real project data loaded from the bridge (projects, the open project's detail,
// its editable curation, manifest text) plus the async actions that drive the
// pipeline (capture/curate/render) and persist edits.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, type CaptureSummary, type ProjectDetail, type ProjectInfo, type RenderProgress, type RenderSummary, type ShotProgress } from "./api";
import {
  addToCut,
  moveCut,
  removeFromCut,
  setCallout,
  setHero,
  setTagline,
  type Curation,
  type TierKey,
} from "./curation";
import type {
  AuthMode,
  AuthStep,
  CaptureState,
  ConnectMode,
  ExportState,
  Rect,
  Screen,
  Theme,
  Tier,
} from "./types";

interface StudioState {
  // --- UI ---
  screen: Screen;
  theme: Theme;
  tier: Tier;
  selClip: string;
  connectMode: ConnectMode;
  authMode: AuthMode;
  authStep: AuthStep;
  captureState: CaptureState;
  exportState: ExportState;
  /** Non-destructive per-shot crops (from edit.json), keyed by shot id. */
  crops: Record<string, Rect>;
  /** The shot whose crop editor is open, or null when the modal is closed. */
  cropShotId: string | null;
  // --- data ---
  projects: ProjectInfo[];
  projectName: string | null;
  detail: ProjectDetail | null;
  /** Editable working copy of the curation (the saved copy lives in detail). */
  curation: Curation | null;
  /** Curation edited locally but not yet persisted. */
  dirty: boolean;
  manifestText: string | null;
  /** Label of the currently running async op, or null. */
  busy: string | null;
  error: string | null;
  captureProgress: ShotProgress[];
  captureSummary: CaptureSummary | null;
  renderProgress: RenderProgress | null;
  renderResult: RenderSummary | null;
}

interface StudioActions {
  nav: (screen: Screen) => void;
  setTheme: (t: Theme) => void;
  setTier: (t: Tier) => void;
  selectClip: (id: string) => void;
  setConnectMode: (m: ConnectMode) => void;
  setAuthMode: (m: AuthMode) => void;
  setAuthStep: (s: AuthStep) => void;
  clearError: () => void;
  // data
  loadProjects: () => Promise<void>;
  openProject: (name: string) => Promise<void>;
  refreshDetail: () => Promise<void>;
  loadManifest: () => Promise<void>;
  saveManifest: (text: string) => Promise<void>;
  runCapture: () => Promise<void>;
  runCurate: (force?: boolean) => Promise<void>;
  saveCuration: () => Promise<void>;
  runRender: (opts: { duration?: number; all?: boolean; fps?: number }) => Promise<void>;
  startLogin: () => Promise<void>;
  confirmLogin: () => Promise<void>;
  // crop editing (non-destructive; persisted to edit.json)
  openCrop: (shotId: string) => void;
  closeCrop: () => void;
  applyCrop: (shotId: string, rect: Rect) => Promise<void>;
  resetCrop: (shotId: string) => Promise<void>;
  // curation edits (operate on the current working copy + selected tier)
  editTagline: (t: string) => void;
  editCallout: (id: string, callout: string) => void;
  pickHero: (id: string) => void;
  nudgeCut: (id: string, dir: -1 | 1) => void;
  excludeShot: (id: string) => void;
  includeShot: (id: string) => void;
}

type StudioContextValue = StudioState & StudioActions;

const StudioContext = createContext<StudioContextValue | null>(null);

const INITIAL: StudioState = {
  screen: "projects",
  theme: "dark",
  tier: "15",
  selClip: "",
  connectMode: "repo",
  authMode: "stealth",
  authStep: "idle",
  captureState: "empty",
  exportState: "idle",
  crops: {},
  cropShotId: null,
  projects: [],
  projectName: null,
  detail: null,
  curation: null,
  dirty: false,
  manifestText: null,
  busy: null,
  error: null,
  captureProgress: [],
  captureSummary: null,
  renderProgress: null,
  renderResult: null,
};

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StudioState>(INITIAL);

  // A ref mirror so async actions read the latest state without stale closures.
  const ref = useRef(state);
  ref.current = state;

  const patch = (p: Partial<StudioState>) => setState((s) => ({ ...s, ...p }));

  // Wrap an async action: mark busy, clear errors, surface failures uniformly.
  const withBusy = async (label: string, fn: () => Promise<void>) => {
    patch({ busy: label, error: null });
    try {
      await fn();
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      patch({ busy: null });
    }
  };

  const editCuration = (fn: (c: Curation) => Curation) => {
    const cur = ref.current.curation;
    if (!cur) return;
    patch({ curation: fn(cur), dirty: true });
  };

  const actions = useMemo<StudioActions>(() => {
    const project = () => ref.current.projectName;
    const tierKey = (): TierKey => ref.current.tier as TierKey;

    return {
      nav: (screen) => patch({ screen }),
      setTheme: (theme) => patch({ theme }),
      setTier: (tier) => patch({ tier }),
      selectClip: (selClip) => patch({ selClip }),
      setConnectMode: (connectMode) => patch({ connectMode }),
      setAuthMode: (authMode) => patch({ authMode }),
      setAuthStep: (authStep) => patch({ authStep }),
      clearError: () => patch({ error: null }),

      loadProjects: () =>
        withBusy("Loading projects", async () => {
          patch({ projects: await api.listProjects() });
        }),

      openProject: (name) =>
        withBusy("Opening project", async () => {
          const detail = await api.getProject(name);
          // Load saved crops alongside the project; tolerate a missing edit.json.
          let crops: Record<string, Rect> = {};
          try {
            crops = (await api.getEdit(name)).crops;
          } catch {
            /* no edit.json yet */
          }
          patch({
            projectName: name,
            detail,
            curation: detail.curation,
            dirty: false,
            crops,
            cropShotId: null,
            captureState: detail.shots.some((s) => s.captured) ? "done" : "empty",
            renderResult: null,
            renderProgress: null,
            captureProgress: [],
            screen: "capture",
          });
        }),

      refreshDetail: async () => {
        const name = project();
        if (!name) return;
        const detail = await api.getProject(name);
        patch({ detail, curation: ref.current.dirty ? ref.current.curation : detail.curation });
      },

      loadManifest: () =>
        withBusy("Loading manifest", async () => {
          const name = project();
          if (!name) return;
          patch({ manifestText: await api.getManifest(name) });
        }),

      saveManifest: (text) =>
        withBusy("Saving manifest", async () => {
          const name = project();
          if (!name) return;
          await api.saveManifest(name, text);
          patch({ manifestText: text });
        }),

      runCapture: () =>
        withBusy("Capturing", async () => {
          const name = project();
          if (!name) return;
          patch({ captureProgress: [], captureSummary: null });
          const summary = await api.runCapture(name, (p) =>
            setState((s) => ({ ...s, captureProgress: [...s.captureProgress, p] })),
          );
          patch({ captureSummary: summary, captureState: "done" });
          await actions.refreshDetail();
        }),

      runCurate: (force = false) =>
        withBusy("Curating", async () => {
          const name = project();
          if (!name) return;
          const res = await api.runCurate(name, force);
          patch({ curation: res.curation, dirty: false });
          await actions.refreshDetail();
        }),

      saveCuration: () =>
        withBusy("Saving curation", async () => {
          const name = project();
          const cur = ref.current.curation;
          if (!name || !cur) return;
          await api.saveCuration(name, cur);
          patch({ dirty: false });
          await actions.refreshDetail();
        }),

      runRender: (opts) =>
        withBusy("Rendering", async () => {
          const name = project();
          if (!name) return;
          // Persist any pending curation edits so the render uses them.
          if (ref.current.dirty && ref.current.curation) {
            await api.saveCuration(name, ref.current.curation);
            patch({ dirty: false });
          }
          patch({ renderProgress: null, renderResult: null, exportState: "rendering" });
          const summary = await api.runRender(name, opts, (p) => patch({ renderProgress: p }));
          patch({ renderResult: summary, exportState: "done" });
        }),

      startLogin: () =>
        withBusy("Launching browser", async () => {
          const name = project();
          if (!name) return;
          patch({ authStep: "opening" });
          await api.login(name, ref.current.authMode);
          patch({ authStep: "active" });
        }),

      confirmLogin: () =>
        withBusy("Saving session", async () => {
          const name = project();
          if (!name) return;
          await api.confirmLogin(name);
          patch({ authStep: "success" });
          await actions.refreshDetail();
        }),

      openCrop: (shotId) => patch({ cropShotId: shotId }),
      closeCrop: () => patch({ cropShotId: null }),

      applyCrop: (shotId, rect) =>
        withBusy("Saving crop", async () => {
          const name = project();
          if (!name) return;
          await api.setCrop(name, shotId, rect);
          setState((s) => ({ ...s, crops: { ...s.crops, [shotId]: rect }, cropShotId: null }));
        }),

      resetCrop: (shotId) =>
        withBusy("Resetting crop", async () => {
          const name = project();
          if (!name) return;
          await api.clearCrop(name, shotId);
          setState((s) => {
            const next = { ...s.crops };
            delete next[shotId];
            return { ...s, crops: next, cropShotId: null };
          });
        }),

      editTagline: (t) => editCuration((c) => setTagline(c, t)),
      editCallout: (id, callout) => editCuration((c) => setCallout(c, id, callout)),
      pickHero: (id) => editCuration((c) => setHero(c, id)),
      nudgeCut: (id, dir) => editCuration((c) => moveCut(c, tierKey(), id, dir)),
      excludeShot: (id) => editCuration((c) => removeFromCut(c, tierKey(), id)),
      includeShot: (id) => editCuration((c) => addToCut(c, tierKey(), id)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the project list once on mount.
  useEffect(() => {
    actions.loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used inside <StudioProvider>");
  return ctx;
}
