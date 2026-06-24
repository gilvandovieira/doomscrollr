import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
import { CLERK_PUBLISHABLE_KEY, HAS_CLERK } from "./app/auth.ts";
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

const root = createRoot(rootElement);

if (HAS_CLERK && CLERK_PUBLISHABLE_KEY) {
  const { ClerkProvider } = await import("@clerk/react");
  root.render(
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: "#f25f3d",
          borderRadius: "0px",
        },
      }}
    >
      {app}
    </ClerkProvider>,
  );
} else {
  root.render(app);
}
