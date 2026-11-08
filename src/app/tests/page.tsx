import type { Metadata } from "next";
import { TestResults } from "@/components/test-results";

export const metadata: Metadata = { title: "Test results" };

export default function Page() {
  return <TestResults />;
}
