/**
 * Text extraction for uploaded sources. Runs server-side only.
 * Returns page-wise text so every extracted block keeps a real page reference.
 */

export type ExtractedDoc = { pages: string[]; pageCount: number; method: "pdf" | "text" };

const TEXT_MIMES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
];

export function isExtractable(mime: string, name: string): boolean {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return true;
  if (TEXT_MIMES.includes(mime)) return true;
  return /\.(txt|md|csv|json|htm|html)$/.test(lower);
}

function chunkPlainText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const pages: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length > 2800 && current.length > 0) {
      pages.push(current.trim());
      current = "";
    }
    current += `${p}\n\n`;
  }
  if (current.trim()) pages.push(current.trim());
  return pages.length ? pages : [text.trim()];
}

export async function extractDocument(
  bytes: ArrayBuffer,
  mime: string,
  name: string,
): Promise<ExtractedDoc> {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = (text as string[]).map((p) => p.replace(/\s+\n/g, "\n").trim());
    return { pages, pageCount: totalPages, method: "pdf" };
  }

  if (isExtractable(mime, name)) {
    const decoded = new TextDecoder("utf-8").decode(bytes);
    const pages = chunkPlainText(decoded);
    return { pages, pageCount: pages.length, method: "text" };
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}

export type RawBlock = {
  block_type: string;
  original_text: string;
  page: number;
  position: number;
  section: string | null;
};

/** Splits page text into ordered blocks, tagging headings by shape (no invented content). */
export function toBlocks(pages: string[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let position = 0;
  let section: string | null = null;

  pages.forEach((pageText, pageIndex) => {
    const parts = pageText
      .split(/\n\s*\n|\r\n\r\n/)
      .map((p) => p.replace(/[ \t]+/g, " ").trim())
      .filter((p) => p.length > 1);

    for (const part of parts) {
      const isHeading =
        part.length <= 90 && !/[.!؟?]$/.test(part) && part.split(/\s+/).length <= 12;
      if (isHeading) section = part;
      blocks.push({
        block_type: isHeading ? "heading" : /^\s*([-*•]|\d+[.)])\s/.test(part) ? "list" : "paragraph",
        original_text: part.slice(0, 6000),
        page: pageIndex + 1,
        position: position++,
        section: isHeading ? part : section,
      });
    }
  });

  return blocks;
}

/** Extraction quality signal shown to the user; no fabricated scores. */
export function assessQuality(doc: ExtractedDoc, blocks: RawBlock[]) {
  const chars = blocks.reduce((sum, b) => sum + b.original_text.length, 0);
  const emptyPages = doc.pages.filter((p) => p.trim().length < 20).length;
  const charsPerPage = doc.pageCount ? Math.round(chars / doc.pageCount) : 0;
  const score =
    chars === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (emptyPages / Math.max(1, doc.pageCount)) * 100)));
  return {
    method: doc.method,
    characters: chars,
    blocks: blocks.length,
    pages: doc.pageCount,
    empty_pages: emptyPages,
    chars_per_page: charsPerPage,
    score,
    needs_ocr: doc.method === "pdf" && charsPerPage < 120,
  };
}
