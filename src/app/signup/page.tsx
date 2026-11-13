import type { Metadata } from "next";
import { SignupView } from "@/components/account-views";

export const metadata: Metadata = { title: "Create a workspace" };

export default function Page() {
  return <SignupView />;
}
