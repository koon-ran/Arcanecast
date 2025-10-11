"use client";

import React from "react";
import { SolanaProvider } from "@/contexts/SolanaContext";
import { ArciumProvider } from "@/contexts/ArciumContext";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider>
      <ArciumProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1a1a2e",
              color: "#fff",
              border: "1px solid rgba(168, 85, 247, 0.3)",
              borderRadius: "12px",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#fff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
            },
          }}
        />
      </ArciumProvider>
    </SolanaProvider>
  );
}
