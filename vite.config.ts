import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve el sitio en /<repo>/. El workflow pasa BASE_PATH; en
  // local queda "/". import.meta.env.BASE_URL refleja este valor.
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  define: {
    // Excalidraw expects this to be defined at build time.
    "process.env.IS_PREACT": JSON.stringify("false"),
  },
  server: {
    port: 5173,
    open: true,
  },
});
