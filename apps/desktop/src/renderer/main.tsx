import "@fontsource/red-hat-text/400.css";
import "@fontsource/red-hat-text/500.css";
import "@fontsource/red-hat-text/600.css";
import "@fontsource/cinzel/400.css";
import "@fontsource/cascadia-code/400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.js";
import "./global.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("SlopStop renderer root is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
