import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./app/query-client.ts";
import { router } from "./app/router.tsx";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

const app = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = createRoot(rootElement);

if (publishableKey) {
  const { ClerkProvider } = await import("@clerk/react");
  root.render(<ClerkProvider publishableKey={publishableKey}>{app}</ClerkProvider>);
} else {
  root.render(app);
}
