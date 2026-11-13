import type { Metadata } from "next";
import { LoginView } from "@/components/account-views";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginView />;
}
