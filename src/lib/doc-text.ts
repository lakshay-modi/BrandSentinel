import { inflateRawSync } from "node:zlib";

/** Text from a document a person uploads: PDF, Word (.docx), or plain text / Markdown. Server only. */
export type DocKind = "pdf" | "docx" | "text";

export function docKind(name: string, type: string, bytes: Uint8Array): DocKind | null {
  const head = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (type === "application/pdf" || /\.pdf$/i.test(name) || head === "%PDF-") return "pdf";
  if (/\.docx$/i.test(name) || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return head.startsWith("PK") ? "docx" : null;
  if (/\.(txt|md|markdown)$/i.test(name) || type.startsWith("text/")) return "text";
  return null;
}

/** One file out of a .zip (a .docx is a zip), using only Node's zlib. Returns null if it isn't there. */
export function unzipEntry(zip: Buffer, wanted: string): Buffer | null {
  // the end-of-central-directory record sits in the last 64 KB
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    if (name === wanted) {
      if (zip.readUInt32LE(local) !== 0x04034b50) return null;
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data, { maxOutputLength: 20 * 1024 * 1024 });
      return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()],
  );

/** The visible text of a Word document's body: one line per paragraph, tabs and line breaks kept. */
export function docxText(xml: string): string {
  const body = xml.match(/<w:body[\s>][\s\S]*<\/w:body>/)?.[0] ?? xml;
  const paras = body.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  return paras
    .map((p) =>
      (p.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) ?? [])
        .map((t) => (t === "<w:tab/>" ? "\t" : t === "<w:br/>" ? "\n" : decode(t.replace(/^<w:t[^>]*>|<\/w:t>$/g, ""))))
        .join(""),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function documentText(name: string, type: string, bytes: Uint8Array): Promise<{ text: string; pages: number; kind: DocKind }> {
  const kind = docKind(name, type, bytes);
  if (!kind) throw new Error("unsupported");
  if (kind === "text") return { text: Buffer.from(bytes).toString("utf8"), pages: 1, kind };
  if (kind === "docx") {
    const xml = unzipEntry(Buffer.from(bytes), "word/document.xml");
    if (!xml) throw new Error("not a Word document");
    return { text: docxText(xml.toString("utf8")), pages: 1, kind };
  }
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  return { text: (text as string[]).map((t, i) => `[Page ${i + 1}]\n${t}`).join("\n\n"), pages: totalPages, kind };
}
