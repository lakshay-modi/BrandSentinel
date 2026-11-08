import type { Metadata } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { RoleProvider } from "@/components/role-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "BrandSentinel: catch brand mistakes before they go live",
  description:
    "Check posts against brand rules and approved facts, see the proof behind every problem, and approve with a human in control.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <RoleProvider>
          <AppShell>{children}</AppShell>
        </RoleProvider>
      </body>
    </html>
  );
}
