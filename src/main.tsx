import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App.tsx";
import "./index.css";

console.log("🎬 main.tsx loaded");
console.log("📦 React version:", StrictMode);

const rootElement = document.getElementById("root");
console.log("🎯 Root element:", rootElement);

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log("✅ App rendered");
} else {
  console.error("❌ Root element not found!");
}
