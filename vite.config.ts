import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 55510
  },
  build: {
    /* Electron embarque un Chromium récent ; évite l’échec esbuild (destructuring) avec la cible legacy par défaut de Vite 6 */
    target: "es2022"
  },
  esbuild: {
    charset: "utf8"
  }
});
