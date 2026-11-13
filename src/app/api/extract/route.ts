import { withSession } from "@/lib/session";
import { z } from "zod";
import { fail, json, readJson, serverError } from "@/lib/api";
import { documentText } from "@/lib/doc-text";

export const maxDuration = 30;

const bodySchema = z.object({
  file: z.object({
    name: z.string().trim().min(1).max(160),
    type: z.string().max(120).default(""),
    base64: z.string().min(1).max(4_000_000, "That file is too big. Use a document under 3 MB."),
  }),
});

/** Read the text of a dropped document (PDF or Word) so it can become a post's caption. Nothing is stored. */
export const POST = withSession(async (req) => {
  const body = await readJson(req, bodySchema);
  if (!body.ok) return body.res;
  const { file } = body.data;
  let text: string;
  try {
    const doc = await documentText(file.name, file.type, new Uint8Array(Buffer.from(file.base64, "base64")));
    text = doc.text;
  } catch (e) {
    if (e instanceof Error && e.message === "unsupported") return fail("Use a PDF, a Word (.docx) file, or a .txt or .md file.", 415);
    return serverError(e, "extract");
  }
  text = text
    .replace(/\u0000/g, "")
    .replace(/^\[Page \d+\]\n/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return fail("No readable text found. If it's a scanned PDF, export it with selectable text first.", 422);
  return json({ text: text.slice(0, 3000), truncated: text.length > 3000 });
}, "extract");
