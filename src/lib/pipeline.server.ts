/**
 * Source processing and course building. Server-only.
 * All database access goes through the caller's RLS-scoped client, so a user can
 * only ever process and build from their own sources.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiJson, SOURCE_BOUND_SYSTEM } from "./ai.server";
import { assessQuality, extractDocument, isExtractable, toBlocks } from "./extract.server";

type Db = SupabaseClient<Database>;

const MAX_PROMPT_CHARS = 60000;
const MAX_BLOCKS = 320;

export async function processUploadedFile(supabase: Db, userId: string, fileId: string) {
  const { data: file, error } = await supabase
    .from("files")
    .select("id, course_id, storage_path, mime_type, original_name, current_version")
    .eq("id", fileId)
    .single();
  if (error || !file) throw new Error("FILE_NOT_FOUND");

  const job = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      course_id: file.course_id,
      file_id: file.id,
      kind: "process_file",
      status: "RUNNING",
      progress: 5,
    })
    .select("id")
    .single();
  const jobId = job.data?.id;

  const fail = async (reason: string, detail?: string) => {
    await supabase
      .from("files")
      .update({ status: "FAILED", error_message: reason, status_detail: detail ?? null })
      .eq("id", fileId);
    if (jobId) {
      await supabase
        .from("jobs")
        .update({ status: "FAILED", failure_reason: reason, completed_at: new Date().toISOString() })
        .eq("id", jobId);
    }
  };

  if (!isExtractable(file.mime_type, file.original_name)) {
    await fail("UNSUPPORTED_FILE_TYPE");
    return { status: "FAILED" as const, reason: "UNSUPPORTED_FILE_TYPE" };
  }

  try {
    await supabase.from("files").update({ status: "READING" }).eq("id", fileId);
    const download = await supabase.storage.from("sources").download(file.storage_path);
    if (download.error || !download.data) throw new Error("DOWNLOAD_FAILED");
    const bytes = await download.data.arrayBuffer();

    const doc = await extractDocument(bytes, file.mime_type, file.original_name);
    const blocks = toBlocks(doc.pages).slice(0, 4000);
    if (blocks.length === 0) {
      await fail("NO_TEXT_EXTRACTED");
      return { status: "FAILED" as const, reason: "NO_TEXT_EXTRACTED" };
    }

    await supabase.from("files").update({ status: "EXTRACTING_STRUCTURE" }).eq("id", fileId);
    if (jobId) await supabase.from("jobs").update({ progress: 45 }).eq("id", jobId);

    await supabase
      .from("content_blocks")
      .delete()
      .eq("file_id", fileId)
      .eq("file_version", file.current_version);

    const rows = blocks.map((b) => ({
      user_id: userId,
      course_id: file.course_id,
      file_id: fileId,
      file_version: file.current_version,
      block_type: b.block_type,
      original_text: b.original_text,
      page: b.page,
      position: b.position,
      section: b.section,
    }));
    for (let i = 0; i < rows.length; i += 400) {
      const insert = await supabase.from("content_blocks").insert(rows.slice(i, i + 400));
      if (insert.error) throw insert.error;
    }

    const quality = assessQuality(doc, blocks);
    await supabase
      .from("files")
      .update({
        status: "READY",
        page_count: doc.pageCount,
        quality,
        status_detail: null,
        error_message: null,
      })
      .eq("id", fileId);

    if (jobId) {
      await supabase
        .from("jobs")
        .update({ status: "SUCCEEDED", progress: 100, completed_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    return { status: "READY" as const, blocks: blocks.length, pages: doc.pageCount, quality };
  } catch (cause) {
    console.error("[pipeline] processing failed", cause);
    await fail("PROCESSING_ERROR", cause instanceof Error ? cause.message : undefined);
    return { status: "FAILED" as const, reason: "PROCESSING_ERROR" };
  }
}
