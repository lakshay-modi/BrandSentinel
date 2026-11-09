import type { Metadata } from "next";
import { RulebookView } from "@/components/rulebook-view";

export const metadata: Metadata = { title: "Rulebook" };

export default function Page() {
  return <RulebookView />;
}
