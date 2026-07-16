"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 2800,
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
