import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrototypeApp } from "./prototype-app.js";
import "./prototype-global.css";

const root = document.getElementById("prototype-root");

if (root === null) {
  throw new Error("SlopStop prototype renderer root is missing.");
}

createRoot(root).render(
  <StrictMode>
    <PrototypeApp />
  </StrictMode>,
);
