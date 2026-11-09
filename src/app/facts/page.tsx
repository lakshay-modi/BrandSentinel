import type { Metadata } from "next";
import { FactsView } from "@/components/facts-view";

export const metadata: Metadata = { title: "Fact Bank" };

export default function Page() {
  return <FactsView />;
}
