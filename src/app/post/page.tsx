import { Suspense } from "react";
import { PostWorkspace } from "@/components/post-workspace";

export default function PostPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading the post…</p>}>
      <PostWorkspace />
    </Suspense>
  );
}
