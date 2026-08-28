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

type AiLesson = {
  title?: string;
  objective?: string;
  brief?: string;
  explanation_simple?: string;
  explanation_standard?: string;
  explanation_detailed?: string;
  refs?: number[];
};
type AiChapter = { title?: string; lessons?: AiLesson[] };
type AiUnit = { title?: string; chapters?: AiChapter[] };
type AiQuestion = {
  type?: string;
  prompt?: string;
  options?: string[];
  correct_answer?: unknown;
  explanation?: string;
  difficulty?: number;
  lesson_title?: string;
  refs?: number[];
};
type AiBuild = {
  units?: AiUnit[];
  course_summary?: { body?: string; refs?: number[] };
  questions?: AiQuestion[];
};

const QUESTION_TYPES = [
  "MCQ",
  "TRUE_FALSE",
  "FILL_BLANK",
  "DEFINITION",
  "SHORT_ANSWER",
  "CALCULATION",
  "SCENARIO",
  "PROBLEM_SOLVING",
] as const;

export async function buildCourseContent(supabase: Db, userId: string, courseId: string) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, title, subject, language")
    .eq("id", courseId)
    .single();
  if (courseError || !course) throw new Error("COURSE_NOT_FOUND");

  const { data: files } = await supabase
    .from("files")
    .select("id, original_name, current_version, status")
    .eq("course_id", courseId);
  const readyFiles = (files ?? []).filter((f) => f.status === "READY");
  if (readyFiles.length === 0) throw new Error("NO_READY_SOURCES");

  const { data: blocks } = await supabase
    .from("content_blocks")
    .select("id, file_id, page, position, section, original_text, block_type")
    .eq("course_id", courseId)
    .order("file_id", { ascending: true })
    .order("position", { ascending: true })
    .limit(4000);

  const usable = (blocks ?? []).filter((b) => b.original_text.trim().length > 2);
  if (usable.length === 0) throw new Error("NO_SOURCE_CONTENT");

  const step = Math.max(1, Math.ceil(usable.length / MAX_BLOCKS));
  const sampled = usable.filter((_, i) => i % step === 0).slice(0, MAX_BLOCKS);

  const fileNames = new Map(readyFiles.map((f) => [f.id, f.original_name]));
  let budget = MAX_PROMPT_CHARS;
  const lines: string[] = [];
  const indexed: typeof sampled = [];
  sampled.forEach((b) => {
    const text = b.original_text.slice(0, 700);
    if (budget - text.length < 0) return;
    budget -= text.length;
    const id = indexed.length;
    indexed.push(b);
    lines.push(
      `[${id}] (file: ${fileNames.get(b.file_id) ?? "source"}, page ${b.page ?? "-"}) ${text}`,
    );
  });

  const prompt = [
    `Course: ${course.title}${course.subject ? ` — ${course.subject}` : ""}`,
    "Source blocks follow. Build the study system from them only.",
    "",
    lines.join("\n"),
    "",
    "Return JSON with this exact shape:",
    `{"units":[{"title":"...","chapters":[{"title":"...","lessons":[{"title":"...","objective":"...","brief":"concise useful summary in bullet lines","explanation_simple":"...","explanation_standard":"...","explanation_detailed":"...","refs":[0,3]}]}]}],`,
    `"course_summary":{"body":"...","refs":[0,1]},`,
    `"questions":[{"type":"MCQ","prompt":"...","options":["a","b","c","d"],"correct_answer":"a","explanation":"...","difficulty":2,"lesson_title":"matching lesson title","refs":[2]}]}`,
    "",
    "Limits: at most 4 units, 10 chapters total, 24 lessons total, 30 questions.",
    "Allowed question types: MCQ, TRUE_FALSE, FILL_BLANK, DEFINITION, SHORT_ANSWER, CALCULATION, SCENARIO, PROBLEM_SOLVING.",
    "For MCQ include 4 options and set correct_answer to the exact correct option text.",
    "For TRUE_FALSE set correct_answer to true or false.",
    "difficulty is 1 (easy) to 3 (hard).",
  ].join("\n");

  const result = await aiJson<AiBuild>(SOURCE_BOUND_SYSTEM, prompt);

  const validRefs = (refs: unknown): string[] => {
    if (!Array.isArray(refs)) return [];
    return refs
      .map((r) => (typeof r === "number" ? indexed[r]?.id : undefined))
      .filter((v): v is string => typeof v === "string");
  };
  const blockById = new Map(indexed.map((b) => [b.id, b]));

  // Rebuild generated content from scratch; sources and uploads are untouched.
  await supabase.from("source_references").delete().eq("course_id", courseId);
  await supabase.from("questions").delete().eq("course_id", courseId);
  await supabase.from("summaries").delete().eq("course_id", courseId);
  await supabase.from("study_plan_items").delete().eq("course_id", courseId);
  await supabase.from("study_plans").delete().eq("course_id", courseId);
  await supabase.from("reviews").delete().eq("course_id", courseId);
  await supabase.from("lessons").delete().eq("course_id", courseId);
  await supabase.from("chapters").delete().eq("course_id", courseId);
  await supabase.from("units").delete().eq("course_id", courseId);

  const references: Database["public"]["Tables"]["source_references"]["Insert"][] = [];
  const addRefs = (objectType: string, objectId: string, blockIds: string[]) => {
    blockIds.slice(0, 6).forEach((blockId) => {
      const block = blockById.get(blockId);
      if (!block) return;
      references.push({
        user_id: userId,
        course_id: courseId,
        object_type: objectType,
        object_id: objectId,
        file_id: block.file_id,
        file_version: 1,
        content_block_id: block.id,
        page: block.page,
        section: block.section,
        quoted_text: block.original_text.slice(0, 500),
      });
    });
  };

  const lessonIdByTitle = new Map<string, string>();
  let unitPosition = 0;
  let chapterPosition = 0;
  let lessonPosition = 0;

  for (const unit of (result.units ?? []).slice(0, 4)) {
    if (!unit?.title) continue;
    const unitRow = await supabase
      .from("units")
      .insert({ user_id: userId, course_id: courseId, title: unit.title, position: unitPosition++ })
      .select("id")
      .single();
    if (unitRow.error || !unitRow.data) continue;

    for (const chapter of (unit.chapters ?? []).slice(0, 10)) {
      if (!chapter?.title) continue;
      const chapterRow = await supabase
        .from("chapters")
        .insert({
          user_id: userId,
          course_id: courseId,
          unit_id: unitRow.data.id,
          title: chapter.title,
          position: chapterPosition++,
        })
        .select("id")
        .single();
      if (chapterRow.error || !chapterRow.data) continue;

      for (const lesson of (chapter.lessons ?? []).slice(0, 12)) {
        if (!lesson?.title) continue;
        const refs = validRefs(lesson.refs);
        if (refs.length === 0) continue; // unsupported by the sources: never stored
        const lessonRow = await supabase
          .from("lessons")
          .insert({
            user_id: userId,
            course_id: courseId,
            chapter_id: chapterRow.data.id,
            title: lesson.title,
            objective: lesson.objective ?? null,
            explanation_simple: lesson.explanation_simple ?? null,
            explanation_standard: lesson.explanation_standard ?? null,
            explanation_detailed: lesson.explanation_detailed ?? null,
            support_status: "SUPPORTED",
            position: lessonPosition++,
          })
          .select("id")
          .single();
        if (lessonRow.error || !lessonRow.data) continue;
        lessonIdByTitle.set(lesson.title.trim(), lessonRow.data.id);
        addRefs("lesson", lessonRow.data.id, refs);

        if (lesson.brief) {
          const summaryRow = await supabase
            .from("summaries")
            .insert({
              user_id: userId,
              course_id: courseId,
              lesson_id: lessonRow.data.id,
              kind: "lesson",
              body: lesson.brief,
              is_published: true,
              validation: { refs: refs.length, source_bound: true },
            })
            .select("id")
            .single();
          if (summaryRow.data) addRefs("summary", summaryRow.data.id, refs);
        }
      }
    }
  }

  if (lessonPosition === 0) throw new Error("NO_SUPPORTED_CONTENT");

  if (result.course_summary?.body) {
    const refs = validRefs(result.course_summary.refs);
    const summaryRow = await supabase
      .from("summaries")
      .insert({
        user_id: userId,
        course_id: courseId,
        kind: "course",
        body: result.course_summary.body,
        is_published: refs.length > 0,
        validation: { refs: refs.length, source_bound: refs.length > 0 },
      })
      .select("id")
      .single();
    if (summaryRow.data && refs.length) addRefs("summary", summaryRow.data.id, refs);
  }

  let questionCount = 0;
  for (const question of (result.questions ?? []).slice(0, 30)) {
    if (!question?.prompt) continue;
    const refs = validRefs(question.refs);
    if (refs.length === 0) continue;
    const type = (QUESTION_TYPES as readonly string[]).includes(question.type ?? "")
      ? (question.type as Database["public"]["Enums"]["question_type"])
      : "SHORT_ANSWER";
    const options = Array.isArray(question.options) ? question.options.slice(0, 6) : [];
    if (type === "MCQ" && options.length < 2) continue;
    const questionRow = await supabase
      .from("questions")
      .insert({
        user_id: userId,
        course_id: courseId,
        lesson_id: question.lesson_title
          ? (lessonIdByTitle.get(question.lesson_title.trim()) ?? null)
          : null,
        type,
        prompt: question.prompt,
        options,
        correct_answer: (question.correct_answer ?? null) as Database["public"]["Tables"]["questions"]["Insert"]["correct_answer"],
        explanation: question.explanation ?? null,
        difficulty: Math.min(3, Math.max(1, Math.round(question.difficulty ?? 2))),
        support_status: "SUPPORTED",
        is_published: true,
        validation: { refs: refs.length, source_bound: true },
      })
      .select("id")
      .single();
    if (questionRow.error || !questionRow.data) continue;
    questionCount++;
    addRefs("question", questionRow.data.id, refs);
  }

  for (let i = 0; i < references.length; i += 300) {
    await supabase.from("source_references").insert(references.slice(i, i + 300));
  }

  await supabase
    .from("courses")
    .update({ is_built: true, built_at: new Date().toISOString() })
    .eq("id", courseId);

  await supabase
    .from("progress")
    .upsert(
      { user_id: userId, course_id: courseId, lessons_total: lessonPosition },
      { onConflict: "user_id,course_id" },
    );

  return { lessons: lessonPosition, questions: questionCount, references: references.length };
}
