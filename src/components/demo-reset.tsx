"use client";

import { useState } from "react";
import { reloadBrand, useBrand } from "@/lib/client/use-brand";
import { refreshPosts } from "@/lib/client/use-posts";
import { send } from "@/lib/client/send";
import { Button, ConfirmDialog } from "./ui";
import { useRole } from "./role-provider";
import { useToast } from "./toast";

/**
 * A testing tool, not part of the product: puts the demo brands back as they were, so anyone trying the app
 * can delete or change the samples and still leave the demo working for the next person.
 */
export function DemoReset({ always = false }: { always?: boolean }) {
  const brand = useBrand();
  const { role, name } = useRole();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  if (!brand || (!always && !brand.brand.settings.protected)) return null;
  return (
    <section aria-labelledby="demo-reset-h" className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="demo-reset-h" className="flex items-center gap-2 text-[13px] font-bold">
            <span className="rounded-md bg-line px-1.5 py-px text-[11px] uppercase tracking-wide text-ink-soft">For testing only</span>
            Reset demo
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Deleted or changed a sample post? This puts the demo brands, Oatvia Foods and Solvira Skincare, back as they were: their sample posts, rulebooks and
            facts. It changes the demo for everyone using it. Posts you created and other brands are not touched. It is here so the demo can be tried freely; a real
            workspace would not have it.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Reset demo
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the demo brands?"
        action="Reset demo"
        onConfirm={async () => {
          try {
            const res = await send<{ posts: number }>("/api/demo/reset", "POST", { role, actor: name });
            await Promise.all([reloadBrand(), refreshPosts()]);
            toast(`Demo reset: ${res.posts} sample posts are back as they were.`);
            setOpen(false);
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "error");
          }
        }}
      >
        <p>
          Oatvia Foods and Solvira Skincare go back to how they were set up: sample posts with their checks and history, rulebooks and facts. Any changes made to
          them since are undone, for everyone. Posts you created yourself stay. This is a testing tool only.
        </p>
      </ConfirmDialog>
    </section>
  );
}
