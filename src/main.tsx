import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const SPLASH_MIN_VISIBLE_MS = 650;
const SPLASH_FADE_MS = 320;
const launchedAt = performance.now();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

dismissSplashScreen();

/**
 * Fade the inline splash element out once the editor is mounted. We hold it
 * on screen for at least {@link SPLASH_MIN_VISIBLE_MS} so a fast cold-launch
 * doesn't make it flicker, then transition opacity to 0 and remove the node
 * so it doesn't sit in the DOM intercepting events.
 */
function dismissSplashScreen(): void {
  const splash = document.getElementById("splash");
  if (!splash) return;

  const elapsed = performance.now() - launchedAt;
  const wait = Math.max(0, SPLASH_MIN_VISIBLE_MS - elapsed);

  const hide = () => {
    splash.classList.add("is-hidden");
    setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  };

  if (wait === 0) {
    requestAnimationFrame(hide);
  } else {
    setTimeout(() => requestAnimationFrame(hide), wait);
  }
}
