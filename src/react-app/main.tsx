import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";

window.onerror = (_msg, _src, _line, _col, error) => {
  FirebaseCrashlytics.recordException({ message: error?.message ?? String(_msg) });
};

window.addEventListener("unhandledrejection", (e) => {
  FirebaseCrashlytics.recordException({ message: String(e.reason) });
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
