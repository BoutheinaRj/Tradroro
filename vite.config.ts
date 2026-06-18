import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use relative paths so Electron can load built files via file:// protocol
  base: "./",
})
