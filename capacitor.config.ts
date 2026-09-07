import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.innerbase.journaldehoras",
  appName: "Journal de Horas",
  webDir: "dist",
  ios: {
    // El contenido llega hasta los bordes; los safe-area insets los maneja
    // el CSS (env(safe-area-inset-*)).
    contentInset: "never",
    // Fondo mientras carga el WebView (evita un flash blanco/negro).
    backgroundColor: "#eceef1ff",
  },
  plugins: {
    Keyboard: {
      // El teclado no empuja/redimensiona el WebView: el lienzo no se mueve.
      resize: "none",
      resizeOnFullScreen: true,
    },
  },
  // Para recarga en vivo en el iPad (mismo Wi-Fi), descomenta y pon tu IP LAN:
  // server: { url: "http://192.168.1.50:5174", cleartext: true },
};

export default config;
