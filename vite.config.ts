import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 55510
  },
  esbuild: {
    charset: "utf8"
  }
});
