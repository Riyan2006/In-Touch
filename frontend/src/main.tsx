import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import MarginWhispers from "./MarginWhispers";
import "./styles.css";
import "./overrides.css";
import "./desktop-shell.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /><MarginWhispers /></StrictMode>);
