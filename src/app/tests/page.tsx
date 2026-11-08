import type { Metadata } from "next";
import { TestResults } from "@/components/test-results";

export const metadata: Metadata = { title: "Test results · BrandSentinel" };

export default function Page() {
  return <TestResults />;
}
