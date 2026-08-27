import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

/**
 * Single translation source. UI components must never hardcode display strings;
 * add the key here instead.
 */
export const dict: Dict = {
  "app.name": { ar: "محاضر", en: "Mahader" },
  "app.tagline": {
    ar: "محاضر يحول موادك الدراسية إلى نظام دراسة متكامل.",
    en: "Mahader turns your own study material into a complete study system.",
  },
  "app.tagline.alt": {
    ar: "ارفع موادك، ونظّم دراستك، وتعلّم منها في مكان واحد.",
    en: "Upload your material, organise your study, and learn from it in one place.",
  },

  "common.signIn": { ar: "تسجيل الدخول", en: "Sign in" },
  "common.signUp": { ar: "إنشاء حساب", en: "Create account" },
  "common.signOut": { ar: "تسجيل الخروج", en: "Sign out" },
  "common.email": { ar: "البريد الإلكتروني", en: "Email" },
  "common.password": { ar: "كلمة المرور", en: "Password" },
  "common.fullName": { ar: "الاسم الكامل", en: "Full name" },
  "common.cancel": { ar: "إلغاء", en: "Cancel" },
  "common.save": { ar: "حفظ", en: "Save" },
  "common.create": { ar: "إنشاء", en: "Create" },
  "common.delete": { ar: "حذف", en: "Delete" },
  "common.retry": { ar: "إعادة المحاولة", en: "Retry" },
  "common.open": { ar: "فتح", en: "Open" },
  "common.close": { ar: "إغلاق", en: "Close" },
  "common.loading": { ar: "جارٍ التحميل", en: "Loading" },
  "common.optional": { ar: "اختياري", en: "Optional" },
  "common.language": { ar: "اللغة", en: "Language" },
  "common.theme": { ar: "المظهر", en: "Theme" },
  "common.light": { ar: "فاتح", en: "Light" },
  "common.dark": { ar: "داكن", en: "Dark" },
  "common.system": { ar: "النظام", en: "System" },
  "common.back": { ar: "رجوع", en: "Back" },
  "common.error": {
    ar: "تعذر إكمال العملية. حاول مرة أخرى.",
    en: "The operation could not be completed. Please try again.",
  },
  "common.notInSources": {
    ar: "هذه المعلومة غير موجودة في المصادر المرفقة.",
    en: "This information is not available in the attached sources.",
  },
  "common.pending": { ar: "قيد التطوير", en: "Pending" },

  "nav.home": { ar: "الرئيسية", en: "Home" },
  "nav.courses": { ar: "مقرراتي", en: "My courses" },
  "nav.library": { ar: "المكتبة", en: "Library" },
  "nav.settings": { ar: "الإعدادات", en: "Settings" },

  "landing.hero.badge": { ar: "نظام دراسة مرتبط بمصادرك", en: "A source-bound study system" },
  "landing.hero.lead": {
    ar: "ارفع محاضراتك وملفاتك، ويبني محاضر منها مقرراً منظماً: دروس، مختصر مفيد، أسئلة، اختبارات، خطة دراسة ومراجعة — كل معلومة مرتبطة بمصدرها في ملفك.",
    en: "Upload your lectures and files, and Mahader builds a structured course from them: lessons, a clean summary, questions, exams, a study plan and reviews - every statement linked back to its place in your own file.",
  },
  "landing.hero.cta": { ar: "ابدأ الآن", en: "Get started" },
  "landing.hero.secondary": { ar: "كيف يعمل", en: "How it works" },
  "landing.problem.title": { ar: "المشكلة", en: "The problem" },
  "landing.problem.body": {
    ar: "المواد الدراسية موزعة على ملفات وصور ومحاضرات، والأدوات العامة تجيب من الإنترنت لا من مقررك، فتحصل على معلومات لا تُسأل عنها ولا تعرف من أين جاءت.",
    en: "Study material is scattered across files, images and lectures, and general tools answer from the internet instead of your course - so you get information you were never asked about, with no idea where it came from.",
  },
  "landing.solution.title": { ar: "الحل", en: "The solution" },
  "landing.solution.body": {
    ar: "محاضر يقرأ ملفاتك ويستخرج بنيتها، ثم يبني بيئة دراسة كاملة مقيدة بمصادرك المعتمدة فقط. إن لم تكن المعلومة في ملفاتك، لا يخترعها.",
    en: "Mahader reads your files, extracts their structure, and builds a full study environment bound to your approved sources only. If the information is not in your files, it is not invented.",
  },
  "landing.how.title": { ar: "كيف يعمل", en: "How it works" },
  "landing.how.1.title": { ar: "أنشئ مقرراً", en: "Create a course" },
  "landing.how.1.body": {
    ar: "كل مقرر معزول تماماً عن غيره، ولا تُخلط مصادره مع أي مقرر آخر.",
    en: "Each course is fully isolated; its sources are never mixed with another course.",
  },
  "landing.how.2.title": { ar: "ارفع مصادرك", en: "Upload your sources" },
  "landing.how.2.body": {
    ar: "ملفات PDF ومستندات وعروض وجداول وصور، مع حفظ الأصل ونسخه.",
    en: "PDFs, documents, slides, spreadsheets and images, with the original and its versions preserved.",
  },
  "landing.how.3.title": { ar: "ابنِ نظام الدراسة", en: "Build the study system" },
  "landing.how.3.body": {
    ar: "بنية المقرر ودروسه ومفاهيمه وطرق الحل المستخرجة من مصادرك.",
    en: "Course structure, lessons, concepts and solution methods extracted from your sources.",
  },
  "landing.how.4.title": { ar: "ادرس وتابع", en: "Study and track" },
  "landing.how.4.body": {
    ar: "مختصر مفيد وأسئلة واختبارات ومراجعة مجدولة وتقدم مقاس.",
    en: "A clean summary, questions, exams, scheduled reviews and measured progress.",
  },
  "landing.features.title": { ar: "المزايا الأساسية", en: "Core features" },
  "landing.sourceControl.title": { ar: "التحكم في المصادر", en: "Source control" },
  "landing.sourceControl.body": {
    ar: "لكل مقرر جرد مصادر واضح: عدد الملفات، حالة المعالجة، جودة الاستخراج، آخر تحديث، والنسخة. وعند تعارض مصدرين تختار أنت المصدر المعتمد.",
    en: "Every course has a clear source inventory: file count, processing state, extraction quality, last update and version. When two sources disagree, you choose the authoritative one.",
  },
  "landing.trust.title": { ar: "من أين جاءت هذه المعلومة", en: "Where did this come from" },
  "landing.trust.body": {
    ar: "كل معلومة أكاديمية مرفقة بمرجعها: الملف، النسخة، الصفحة، والنص الأصلي — بضغطة واحدة.",
    en: "Every academic statement carries its reference: file, version, page and original text - one click away.",
  },
  "landing.pricing.title": { ar: "الخطط", en: "Pricing" },
  "landing.pricing.monthly": { ar: "شهرياً", en: "per month" },
  "landing.pricing.yearly": { ar: "سنوياً", en: "per year" },
  "landing.security.title": { ar: "الأمان والخصوصية", en: "Security and privacy" },
  "landing.security.body": {
    ar: "ملفاتك خاصة ومخزنة في مساحة غير عامة، والتحقق من الملكية يتم في الخادم لا في المتصفح. لا تُستخدم مواد مستخدم لبناء محتوى مستخدم آخر.",
    en: "Your files are private and stored in a non-public area, and ownership is verified on the server, never in the browser. One person's material is never used to build another person's content.",
  },
  "landing.faq.title": { ar: "أسئلة متكررة", en: "FAQ" },
  "landing.faq.q1": { ar: "هل يجيب من الإنترنت؟", en: "Does it answer from the internet?" },
  "landing.faq.a1": {
    ar: "لا. المحتوى الأكاديمي مقيد بمصادرك المعتمدة في المقرر نفسه. وإن لم تكن المعلومة موجودة يظهر لك ذلك صريحاً.",
    en: "No. Academic content is bound to your approved sources inside that same course. If the information is missing, you are told so explicitly.",
  },
  "landing.faq.q2": { ar: "هل تُخلط مقرراتي؟", en: "Can my courses get mixed?" },
  "landing.faq.a2": {
    ar: "لا. لكل مقرر عزل كامل على مستوى قاعدة البيانات والتصاريح.",
    en: "No. Each course is isolated at the database and authorization level.",
  },
  "landing.faq.q3": { ar: "ما الصيغ المدعومة؟", en: "Which formats are supported?" },
  "landing.faq.a3": {
    ar: "PDF، DOC/DOCX، PPT/PPTX، XLS/XLSX، CSV، TXT، RTF، والصور JPG/PNG/WEBP/HEIC.",
    en: "PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, CSV, TXT, RTF, and JPG/PNG/WEBP/HEIC images.",
  },
  "landing.cta.title": { ar: "ابدأ بمقررك الأول", en: "Start with your first course" },

  "auth.title": { ar: "الدخول إلى محاضر", en: "Sign in to Mahader" },
  "auth.signupTitle": { ar: "إنشاء حساب جديد", en: "Create a new account" },
  "auth.google": { ar: "المتابعة بحساب Google", en: "Continue with Google" },
  "auth.or": { ar: "أو", en: "or" },
  "auth.haveAccount": { ar: "لدي حساب بالفعل", en: "I already have an account" },
  "auth.noAccount": { ar: "ليس لدي حساب", en: "I do not have an account" },
  "auth.forgot": { ar: "نسيت كلمة المرور", en: "Forgot password" },
  "auth.resetTitle": { ar: "إعادة تعيين كلمة المرور", en: "Reset your password" },
  "auth.resetSent": {
    ar: "أرسلنا رابط إعادة التعيين إلى بريدك.",
    en: "We sent a reset link to your email.",
  },
  "auth.newPassword": { ar: "كلمة المرور الجديدة", en: "New password" },
  "auth.updatePassword": { ar: "تحديث كلمة المرور", en: "Update password" },
  "auth.passwordUpdated": { ar: "تم تحديث كلمة المرور.", en: "Password updated." },
  "auth.confirmEmail": {
    ar: "تحقق من بريدك لتأكيد الحساب، ثم عد لتسجيل الدخول.",
    en: "Check your email to confirm the account, then come back to sign in.",
  },

  "dash.title": { ar: "لوحة الدراسة", en: "Study dashboard" },
  "dash.greeting": { ar: "أهلاً بك", en: "Welcome" },
  "dash.currentCourse": { ar: "المقرر الحالي", en: "Current course" },
  "dash.sources": { ar: "المصادر", en: "Sources" },
  "dash.processed": { ar: "جاهزة للمعالجة", en: "Ready" },
  "dash.recommended": { ar: "الخطوة المقترحة", en: "Recommended next action" },
  "dash.recommended.createCourse": {
    ar: "أنشئ أول مقرر لك لتبدأ.",
    en: "Create your first course to begin.",
  },
  "dash.recommended.upload": {
    ar: "ارفع مصادر المقرر ليتمكن النظام من بناء الدراسة.",
    en: "Upload the course sources so the system can build your study material.",
  },
  "dash.recommended.wait": {
    ar: "بعض الملفات ما زالت قيد المعالجة.",
    en: "Some files are still being processed.",
  },
  "dash.recommended.build": {
    ar: "مصادرك جاهزة. راجع البنية المستخرجة ثم ابنِ نظام الدراسة.",
    en: "Your sources are ready. Review the extracted structure, then build the study system.",
  },
  "dash.activity": { ar: "النشاط الأخير", en: "Recent activity" },
  "dash.noActivity": { ar: "لا نشاط بعد.", en: "No activity yet." },

  "courses.title": { ar: "مقرراتي", en: "My courses" },
  "courses.new": { ar: "مقرر جديد", en: "New course" },
  "courses.empty.title": { ar: "لا مقررات بعد.", en: "No courses yet." },
  "courses.empty.body": {
    ar: "المقرر هو الحدود التي لا تخرج عنها معلوماتك. أنشئ مقرراً وارفع مصادره.",
    en: "A course is the boundary your information never leaves. Create one and upload its sources.",
  },
  "courses.field.title": { ar: "اسم المقرر", en: "Course name" },
  "courses.field.subject": { ar: "المادة", en: "Subject" },
  "courses.field.description": { ar: "وصف", en: "Description" },
  "courses.field.examDate": { ar: "تاريخ الاختبار", en: "Exam date" },
  "courses.created": { ar: "تم إنشاء المقرر.", en: "Course created." },
  "courses.deleted": { ar: "تم حذف المقرر.", en: "Course deleted." },
  "courses.deleteConfirm": {
    ar: "سيُحذف المقرر مع مصادره ومحتواه المستخرج. لا يمكن التراجع.",
    en: "The course, its sources and extracted content will be deleted. This cannot be undone.",
  },
  "courses.sourcesCount": { ar: "مصدر", en: "sources" },

  "course.tab.overview": { ar: "نظرة عامة", en: "Overview" },
  "course.tab.sources": { ar: "المصادر", en: "Sources" },
  "course.tab.structure": { ar: "البنية المستخرجة", en: "Extracted structure" },
  "course.inventory": { ar: "جرد المصادر", en: "Source inventory" },
  "course.coverage": { ar: "التغطية", en: "Coverage" },
  "course.lastUpdated": { ar: "آخر تحديث", en: "Last updated" },
  "course.notBuilt": { ar: "لم يُبنَ نظام الدراسة بعد", en: "Study system not built yet" },

  "sources.upload": { ar: "رفع ملفات", en: "Upload files" },
  "sources.uploading": { ar: "جارٍ الرفع", en: "Uploading" },
  "sources.empty.title": { ar: "لا مصادر بعد.", en: "No sources yet." },
  "sources.empty.body": {
    ar: "ارفع ملفاتك الدراسية لبناء المقرر. الملفات هي المرجع الوحيد للمحتوى الأكاديمي.",
    en: "Upload your study files to build the course. Your files are the only reference for academic content.",
  },
  "sources.openOriginal": { ar: "فتح الأصل", en: "Open original" },
  "sources.reprocess": { ar: "إعادة المعالجة", en: "Reprocess" },
  "sources.blocks": { ar: "مقاطع مستخرجة", en: "extracted blocks" },
  "sources.quality": { ar: "جودة الاستخراج", en: "Extraction quality" },
  "sources.tooLarge": { ar: "حجم الملف أكبر من المسموح.", en: "The file is larger than allowed." },
  "sources.unsupported": { ar: "صيغة الملف غير مدعومة.", en: "This file type is not supported." },
  "sources.deleteConfirm": {
    ar: "سيُحذف الملف والمحتوى المستخرج منه.",
    en: "The file and the content extracted from it will be deleted.",
  },
  "sources.processingPending": {
    ar: "استخراج هذا النوع من الملفات لم يُفعّل بعد؛ الملف محفوظ ومحفوظة نسخته، وسيُعالج عند تفعيل خط المعالجة.",
    en: "Extraction for this file type is not enabled yet; the file and its version are stored and will be processed once the pipeline is enabled.",
  },

  "status.UPLOADING": { ar: "جارٍ الرفع", en: "Uploading" },
  "status.PROCESSING": { ar: "قيد المعالجة", en: "Processing" },
  "status.READING": { ar: "قراءة", en: "Reading" },
  "status.OCR": { ar: "تعرّف ضوئي", en: "OCR" },
  "status.EXTRACTING_STRUCTURE": { ar: "استخراج البنية", en: "Extracting structure" },
  "status.ORGANIZING": { ar: "تنظيم", en: "Organizing" },
  "status.INDEXING": { ar: "فهرسة", en: "Indexing" },
  "status.QUALITY_CHECK": { ar: "فحص الجودة", en: "Quality check" },
  "status.READY": { ar: "جاهز", en: "Ready" },
  "status.FAILED": { ar: "فشل", en: "Failed" },

  "settings.title": { ar: "الإعدادات", en: "Settings" },
  "settings.account": { ar: "الحساب", en: "Account" },
  "settings.appearance": { ar: "المظهر واللغة", en: "Appearance and language" },
  "settings.plan": { ar: "الاشتراك", en: "Subscription" },
  "settings.plan.current": { ar: "خطتك الحالية", en: "Your current plan" },
  "settings.plan.free": { ar: "مجاني", en: "Free" },
  "settings.billingPending": {
    ar: "الدفع غير مفعّل في هذه البيئة؛ لا توجد أزرار دفع صورية.",
    en: "Payments are not enabled in this environment; no placeholder checkout buttons are shown.",
  },
  "settings.saved": { ar: "تم الحفظ.", en: "Saved." },
  "settings.dangerZone": { ar: "حذف الحساب", en: "Delete account" },
  "settings.deleteAccountBody": {
    ar: "حذف الحساب يزيل ملفاتك ومقرراتك وتقدمك نهائياً.",
    en: "Deleting your account permanently removes your files, courses and progress.",
  },
};

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict | string) => string;
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "mahader.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = dict[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang],
  );

  const value = useMemo<Ctx>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
