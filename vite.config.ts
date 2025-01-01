import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    plugins: [
        react(),
        tsConfigPaths(),
    ],
    server: {
        port: 3000,
        open: true // Automatically open browser
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})