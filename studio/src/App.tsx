import { useStudio } from "./store";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { StepNav } from "./components/StepNav";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { TargetScreen } from "./screens/TargetScreen";
import { ManifestScreen } from "./screens/ManifestScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { CaptureScreen } from "./screens/CaptureScreen";
import { CurateScreen } from "./screens/CurateScreen";
import { FrameScreen } from "./screens/FrameScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { CropModal } from "./modals/CropModal";
import { ManualModal } from "./modals/ManualModal";
import type { Screen } from "./types";

const SCREENS: Record<Screen, () => React.JSX.Element> = {
  projects: ProjectsScreen,
  target: TargetScreen,
  manifest: ManifestScreen,
  auth: AuthScreen,
  capture: CaptureScreen,
  curate: CurateScreen,
  frame: FrameScreen,
  preview: PreviewScreen,
};

export function App() {
  const { theme, screen, cropOpen, manualOpen } = useStudio();
  const Active = SCREENS[screen];

  return (
    <div
      data-theme={theme}
      style={{
        display: "flex",
        height: "100vh",
        minWidth: 1024,
        overflow: "hidden",
        background: "var(--bg)",
        color: "var(--text)",
        fontSize: 14,
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ height: 3, flex: "0 0 3px", background: "var(--brand-grad)" }} />
        <TopBar />
        <StepNav />
        <main style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
          <Active />
        </main>
      </div>
      {cropOpen && <CropModal />}
      {manualOpen && <ManualModal />}
    </div>
  );
}
