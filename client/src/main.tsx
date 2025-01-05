import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");
const root = createRoot(rootEl!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
