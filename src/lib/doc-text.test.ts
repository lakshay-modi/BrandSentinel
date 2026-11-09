import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { docKind, docxText, documentText, unzipEntry } from "./doc-text";

/** A minimal .zip with one file, stored or deflated, like a .docx. */
function zip(name: string, content: string, deflate = true): Buffer {
  const raw = Buffer.from(content, "utf8");
  const data = deflate ? deflateRawSync(raw) : raw;
  const nameBuf = Buffer.from(name, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(deflate ? 8 : 0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(deflate ? 8 : 0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const cdStart = local.length + nameBuf.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBuf.length, 12);
  end.writeUInt32LE(cdStart, 16);
  return Buffer.concat([local, nameBuf, data, central, nameBuf, end]);
}

const XML = `<?xml version="1.0"?><w:document><w:body>
<w:p><w:r><w:t>Meet the Voltaro Zip</w:t></w:r><w:r><w:t xml:space="preserve">! Fast &amp; calm.</w:t></w:r></w:p>
<w:p><w:r><w:t>Price: ₹89,999</w:t><w:tab/><w:t>#RideVoltaro</w:t></w:r></w:p>
</w:body></w:document>`;

describe("reading uploaded documents", () => {
  it("recognises the kind of file", () => {
    expect(docKind("a.pdf", "", new TextEncoder().encode("%PDF-1.7"))).toBe("pdf");
    expect(docKind("a.docx", "", new Uint8Array([0x50, 0x4b, 3, 4]))).toBe("docx");
    expect(docKind("a.docx", "", new TextEncoder().encode("not a zip"))).toBeNull();
    expect(docKind("notes.md", "", new Uint8Array())).toBe("text");
    expect(docKind("photo.heic", "image/heic", new Uint8Array())).toBeNull();
  });

  it("takes one file out of a zip, stored or compressed", () => {
    expect(unzipEntry(zip("word/document.xml", "hello"), "word/document.xml")?.toString()).toBe("hello");
    expect(unzipEntry(zip("word/document.xml", "hello", false), "word/document.xml")?.toString()).toBe("hello");
    expect(unzipEntry(zip("other.xml", "x"), "word/document.xml")).toBeNull();
    expect(unzipEntry(Buffer.from("not a zip at all, just text"), "word/document.xml")).toBeNull();
  });

  it("reads a Word document's paragraphs, keeping symbols and tabs", async () => {
    expect(docxText(XML)).toBe("Meet the Voltaro Zip! Fast & calm.\nPrice: ₹89,999\t#RideVoltaro");
    const doc = await documentText("post.docx", "", new Uint8Array(zip("word/document.xml", XML)));
    expect(doc.kind).toBe("docx");
    expect(doc.text).toContain("₹89,999");
  });

  it("refuses files it can't read", async () => {
    await expect(documentText("photo.heic", "image/heic", new Uint8Array([1, 2]))).rejects.toThrow("unsupported");
  });
});
