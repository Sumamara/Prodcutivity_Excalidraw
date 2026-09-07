import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
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
