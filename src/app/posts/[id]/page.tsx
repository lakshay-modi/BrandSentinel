import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PostWorkspace } from "@/components/post-workspace";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PostPage({ params }: PageProps<"/posts/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Loading the post…</p>}>
      <Post params={params} />
    </Suspense>
  );
}

async function Post({ params }: Pick<PageProps<"/posts/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return <PostWorkspace id={id} />;
}
