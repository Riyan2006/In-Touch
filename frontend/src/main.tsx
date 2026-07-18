import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import MarginWhispers from "./MarginWhispers";
import "./styles.css";
import "./overrides.css";
import "./desktop-shell.css";

const androidBuild = import.meta.env.MODE === "android";
function WebThemeToggle() { const [theme, setTheme] = useState<"dark" | "light">("dark"); useEffect(() => { const sync = (event: Event) => setTheme((event as CustomEvent<"dark" | "light">).detail); window.addEventListener("intouch-theme", sync); return () => window.removeEventListener("intouch-theme", sync); }, []); const next = theme === "dark" ? "light" : "dark"; return <button className="theme-toggle theme-toggle-web" type="button" aria-label={`Switch to ${next} theme`} onClick={() => { setTheme(next); window.dispatchEvent(new CustomEvent("intouch-theme", { detail: next })); }}><span aria-hidden>{theme === "dark" ? "☾" : "☀"}</span><small>{theme === "dark" ? "Moon" : "Sun"}</small></button>; }
createRoot(document.getElementById("root")!).render(<StrictMode><App />{!androidBuild && <><MarginWhispers /><WebThemeToggle/></>}</StrictMode>);
