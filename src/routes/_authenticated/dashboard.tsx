import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getBootstrap } from "@/lib/courses.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة الدراسة | Mahader" },
      { name: "description", content: "متابعة مقرراتك ومصادرك وتقدمك في محاضر." },
      { property: "og:title", content: "لوحة الدراسة في محاضر" },
      { property: "og:description", content: "متابعة مقرراتك ومصادرك وتقدمك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const fetchBootstrap = useServerFn(getBootstrap);
  const query = useQuery({ queryKey: ["bootstrap"], queryFn: () => fetchBootstrap() });

  const courses = query.data?.courses ?? [];
  const totals = courses.reduce(
    (acc, course) => ({
      sources: acc.sources + course.files_total,
      ready: acc.ready + course.files_ready,
      lessons: acc.lessons + (course.progress?.lessons_total ?? 0),
      done: acc.done + (course.progress?.lessons_completed ?? 0),
    }),
    { sources: 0, ready: 0, lessons: 0, done: 0 },
  );

  const recommendation = () => {
    if (courses.length === 0) return t("dash.recommended.upload");
    const pending = courses.some((c) => c.files_processing > 0);
    if (pending) return t("dash.recommended.wait");
    const unbuilt = courses.find((c) => !c.is_built && c.files_ready > 0);
    if (unbuilt) return t("dash.recommended.build");
    return t("dash.recommended");
  };

  return (
    <AppShell
      title={t("dash.title")}
      actions={
        <Button asChild size="sm">
          <Link to="/courses">
            <Plus className="size-4" aria-hidden="true" />
            {t("courses.new")}
          </Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("dash.sources")}</CardTitle>
              </CardHeader>
              <CardContent className="font-display text-3xl font-bold">{totals.sources}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("dash.processed")}</CardTitle>
              </CardHeader>
              <CardContent className="font-display text-3xl font-bold">{totals.ready}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("progress.lessons")}</CardTitle>
              </CardHeader>
              <CardContent className="font-display text-3xl font-bold">
                {totals.done}
                <span className="text-base text-muted-foreground"> / {totals.lessons}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t("dash.recommended")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed">{recommendation()}</CardContent>
          </Card>

          <section>
            <h2 className="rule-heading font-display text-lg font-bold">{t("courses.title")}</h2>
            {courses.length === 0 ? (
              <Card className="mt-4">
                <CardContent className="space-y-3 py-8 text-center">
                  <BookOpen className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
                  <p className="font-medium">{t("courses.empty.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("courses.empty.body")}</p>
                  <Button asChild size="sm">
                    <Link to="/courses">{t("courses.new")}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {courses.map((course) => {
                  const total = course.progress?.lessons_total ?? 0;
                  const done = course.progress?.lessons_completed ?? 0;
                  return (
                    <li key={course.id}>
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: course.id }}
                        className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                      >
                        <p className="font-semibold">{course.title}</p>
                        {course.subject ? (
                          <p className="mt-1 text-xs text-muted-foreground">{course.subject}</p>
                        ) : null}
                        <p className="mt-3 text-xs text-muted-foreground">
                          {t("dash.sources")}: {course.files_total} · {t("dash.processed")}: {course.files_ready}
                        </p>
                        {total > 0 ? (
                          <div className="mt-3">
                            <Progress value={Math.round((done / total) * 100)} />
                          </div>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
