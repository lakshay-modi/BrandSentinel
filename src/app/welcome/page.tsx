import type { Metadata } from "next";
import { WelcomeView } from "@/components/account-views";

export const metadata: Metadata = { title: "New workspace" };

export default function Page() {
  return <WelcomeView />;
}
