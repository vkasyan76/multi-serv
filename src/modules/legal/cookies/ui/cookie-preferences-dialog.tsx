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
  return (
    <Dialog open={open} onOpenChange={setOpenAction}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): translate */}
            Website Data Collection Preferences
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Essential (always on) */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {/* TODO(i18n): translate */}
                  Essential
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {/* TODO(i18n): translate */}
                  These cookies are necessary for the site to function and
                  cannot be turned off.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">Essential</Label>
                <Switch checked disabled />
              </div>
            </div>
          </div>

          {/* Analytics */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {/* TODO(i18n): translate */}
                  Marketing and Analytics
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {/* TODO(i18n): translate */}
                  Helps us understand usage and improve the product experience.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">Analytics</Label>
                <Switch
                  checked={prefs.analytics}
                  onCheckedChange={(checked) =>
                    setPrefsAction({ ...prefs, analytics: !!checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Advertising */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {/* TODO(i18n): translate */}
                  Advertising
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {/* TODO(i18n): translate */}
                  Used to personalize and measure advertising effectiveness.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Label className="sr-only">Advertising</Label>
                <Switch
                  checked={prefs.advertising}
                  onCheckedChange={(checked) =>
                    setPrefsAction({ ...prefs, advertising: !!checked })
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
              {/* TODO(i18n): translate */}
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-black text-white hover:bg-pink-400 hover:text-primary"
              onClick={onSaveAction}
            >
              {/* TODO(i18n): translate */}
              Save settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
