import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "tailwindcss";
import { defineConfig, loadEnv } from "vite";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, ["VITE_", "CLERK_PUBLISHABLE_KEY"]);
  const clerkPublishableKey = env.VITE_CLERK_PUBLISHABLE_KEY ?? env.CLERK_PUBLISHABLE_KEY ?? "";

  return {
    envDir: workspaceRoot,
    define: {
      "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(clerkPublishableKey),
    },
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      fs: {
        allow: ["../.."],
      },
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    resolve: {
      alias: {
        "@doomscrollr/shared": fileURLToPath(
          new URL("../../packages/shared/src", import.meta.url),
        ),
      },
    },
    css: {
      postcss: {
        plugins: [
          tailwindcss({
            content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/shared/src/**/*.ts"],
            theme: {
              extend: {
                colors: {
                  ink: "#181512",
                  pitch: "#24201c",
                  paper: "#f5f1e8",
                  newsprint: "#e8dfcf",
                  oxide: "#c14b30",
                  signal: "#d9ff45",
                  cyan: "#28bdd2",
                  bruised: "#6f63c6",
                },
                fontFamily: {
                  display: ["Impact", "Arial Black", "system-ui", "sans-serif"],
                  body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
                  mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
                },
                boxShadow: {
                  hard: "6px 6px 0 #181512",
                },
              },
            },
          }),
          autoprefixer(),
        ],
      },
    },
  };
});
