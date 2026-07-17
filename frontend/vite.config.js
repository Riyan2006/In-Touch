import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    resolve: { alias: { "@app-data": fileURLToPath(new URL(mode === "android" ? "./src/data/sample-data.ts" : "./src/data/demo-data.json", import.meta.url)) } },
    build: { outDir: mode === "android" ? "dist-android" : "dist" },
}));
