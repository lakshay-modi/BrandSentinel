import type { Metadata } from "next";
import { ConnectView } from "@/components/connect-view";

export const metadata: Metadata = { title: "Connect" };

export default function Page() {
  return <ConnectView />;
}
