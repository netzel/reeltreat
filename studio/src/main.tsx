import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import { StudioProvider } from "./store";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudioProvider>
      <App />
    </StudioProvider>
  </StrictMode>,
);
