import type { Metadata } from "next";
import { QueueList } from "@/components/queue-list";

export const metadata: Metadata = { title: "Review queue" };

export default function QueuePage() {
  return <QueueList />;
}
