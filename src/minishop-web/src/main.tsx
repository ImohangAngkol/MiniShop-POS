import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api";
import { App } from "./App";
import { FlashProvider } from "./ui";
import "./styles.css";
import "./readability.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FlashProvider>
          <App />
        </FlashProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
