import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount, exportWorkspace, updateProfile } from "@/lib/account.functions";
import { getBootstrap } from "@/lib/courses.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme, type ThemeMode } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات | Mahader" },
      { name: "description", content: "إدارة حسابك ومظهر التطبيق ولغته واشتراكك في محاضر." },
      { property: "og:title", content: "الإعدادات في محاضر" },
      { property: "og:description", content: "إدارة حسابك ومظهر التطبيق واشتراكك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchBootstrap = useServerFn(getBootstrap);
  const saveProfile = useServerFn(updateProfile);
  const exportAll = useServerFn(exportWorkspace);
  const removeAccount = useServerFn(deleteAccount);

  const [fullName, setFullName] = useState("");
  const [confirm, setConfirm] = useState("");
  const query = useQuery({ queryKey: ["bootstrap"], queryFn: () => fetchBootstrap() });

  useEffect(() => {
    if (query.data?.profile?.full_name) setFullName(query.data.profile.full_name);
  }, [query.data?.profile?.full_name]);

  const plan = query.data?.plans.find((p) => p.id === query.data?.subscription?.plan_id);

  return (
    <AppShell title={t("settings.title")}>
      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("settings.account")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input id="email" value={query.data?.profile?.email ?? ""} readOnly disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("common.fullName")}</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <Button
                onClick={async () => {
                  try {
                    await saveProfile({ data: { fullName } });
                    toast.success(t("settings.saved"));
                    await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
                  } catch {
                    toast.error(t("common.error"));
                  }
                }}
              >
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("settings.appearance")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label>{t("common.language")}</Label>
                <Select
                  value={lang}
                  onValueChange={(value) => {
                    setLang(value as Lang);
                    void saveProfile({ data: { language: value } });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.theme")}</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => {
                    setMode(value as ThemeMode);
                    void saveProfile({ data: { theme: value } });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t("common.light")}</SelectItem>
                    <SelectItem value="dark">{t("common.dark")}</SelectItem>
                    <SelectItem value="system">{t("common.system")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("settings.plan")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                {t("settings.plan.current")}:{" "}
                <span className="font-medium">
                  {plan ? (lang === "ar" ? plan.name_ar : plan.name_en) : t("settings.plan.free")}
                </span>
              </p>
              <p className="text-muted-foreground">{t("settings.billingPending")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("settings.export")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const payload = await exportAll();
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = "mahader-export.json";
                    anchor.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    toast.error(t("common.error"));
                  }
                }}
              >
                <Download className="size-4" aria-hidden="true" />
                {t("settings.export")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-destructive">{t("settings.dangerZone")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("settings.deleteAccountBody")}</p>
              <Input
                value={confirm}
                placeholder="DELETE"
                onChange={(e) => setConfirm(e.target.value)}
                className="max-w-xs"
              />
              <Button
                variant="destructive"
                disabled={confirm !== "DELETE"}
                onClick={async () => {
                  try {
                    await removeAccount({ data: { confirm } });
                    await supabase.auth.signOut();
                    queryClient.clear();
                    navigate({ to: "/", replace: true });
                  } catch {
                    toast.error(t("common.error"));
                  }
                }}
              >
                {t("common.delete")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
