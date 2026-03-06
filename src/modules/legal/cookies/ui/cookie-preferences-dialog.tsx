"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import type { CookieConsentPrefs } from "../consent";

type CookiePreferencesDialogProps = {
  open: boolean;
  setOpenAction: (open: boolean) => void;

  prefs: CookieConsentPrefs;
  setPrefsAction: (prefs: CookieConsentPrefs) => void;

  onSaveAction: () => void;
};

export function CookiePreferencesDialog({
  open,
  setOpenAction,
  prefs,
  setPrefsAction,
  onSaveAction,
}: CookiePreferencesDialogProps) {
  const t = useTranslations("common");

  return (
    <Dialog open={open} onOpenChange={setOpenAction}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("cookie.dialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Essential (always on) */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("cookie.dialog.essential_title")}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("cookie.dialog.essential_text")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">{t("cookie.dialog.essential_title")}</Label>
                <Switch checked disabled />
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("cookie.dialog.analytics_title")}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("cookie.dialog.analytics_text")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">{t("cookie.dialog.analytics_title")}</Label>
                <Switch
                  checked={prefs.analytics}
                  onCheckedChange={(checked) =>
                    setPrefsAction({ ...prefs, analytics: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Advertising */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">{t("cookie.dialog.advertising_title")}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("cookie.dialog.advertising_text")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">{t("cookie.dialog.advertising_title")}</Label>
                <Switch
                  checked={prefs.advertising}
                  onCheckedChange={(checked) =>
                    setPrefsAction({ ...prefs, advertising: checked })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenAction(false)}
            >
              {t("buttons.cancel")}
            </Button>
            <Button
              type="button"
              className="bg-black text-white hover:bg-pink-400 hover:text-black"
              onClick={onSaveAction}
            >
              {t("buttons.save_settings")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
