"use client";

import * as React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { Provider as JotaiProvider } from "jotai";
import { store } from "@/store/store";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <JotaiProvider>
        <div className="flex min-h-0 flex-1 flex-col">
          {children}
          <Toaster />
        </div>
      </JotaiProvider>
    </ReduxProvider>
  );
}

