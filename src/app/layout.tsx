import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/shared/app-toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealPlanner",
  description: "Wspólne planowanie posiłków i zakupów",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MealPlanner",
  },
};

export const viewport: Viewport = {
  themeColor: "#3d7a4a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
