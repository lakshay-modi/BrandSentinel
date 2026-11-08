import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { RoleProvider } from "@/components/role-provider";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";

const DESCRIPTION = "Check posts against brand rules and approved facts, see the proof behind every problem, and approve with a human in control.";

export const metadata: Metadata = {
  metadataBase: new URL("https://brand-sentinel-delta.vercel.app"),
  title: { default: "BrandSentinel: catch brand mistakes before they go live", template: "%s · BrandSentinel" },
  description: DESCRIPTION,
  // a clean preview when the link is shared (for example in a chat)
  openGraph: { type: "website", siteName: "BrandSentinel", title: "BrandSentinel: catch brand mistakes before they go live", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary", title: "BrandSentinel", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <RoleProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </RoleProvider>
      </body>
    </html>
  );
}
