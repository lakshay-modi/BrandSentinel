import type { Metadata } from "next";
import { WorkspaceView } from "@/components/workspace-view";

export const metadata: Metadata = { title: "Team" };

export default function Page() {
  return <WorkspaceView />;
}
