import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/**
 * Returns to the previous page. Falls back to a route when there is no history
 * entry (direct link, refresh), so the button is never a dead control.
 */
export function BackButton({ fallbackTo = "/dashboard" }: { fallbackTo?: string }) {
  const router = useRouter();
  const { t, dir } = useI18n();
  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.history.back();
          return;
        }
        void router.navigate({ to: fallbackTo });
      }}
    >
      <Icon className="size-4" aria-hidden="true" />
      {t("common.back")}
    </Button>
  );
}
