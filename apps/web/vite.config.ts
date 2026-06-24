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
      dedupe: ["react", "react-dom"],
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
                  ink: "oklch(var(--color-ink) / <alpha-value>)",
                  pitch: "oklch(var(--color-pitch) / <alpha-value>)",
                  page: "oklch(var(--color-page) / <alpha-value>)",
                  paper: "oklch(var(--color-paper) / <alpha-value>)",
                  newsprint: "oklch(var(--color-newsprint) / <alpha-value>)",
                  oxide: "oklch(var(--color-oxide) / <alpha-value>)",
                  signal: "oklch(var(--color-signal) / <alpha-value>)",
                  cyan: "oklch(var(--color-cyan) / <alpha-value>)",
                  bruised: "oklch(var(--color-bruised) / <alpha-value>)",
                },
                fontFamily: {
                  display: ["var(--font-display)", "system-ui", "sans-serif"],
                  body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
                  mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
                },
                boxShadow: {
                  hard: "var(--shadow-hard)",
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
