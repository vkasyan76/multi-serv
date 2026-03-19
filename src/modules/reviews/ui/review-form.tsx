"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { StarPicker } from "./star-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Review } from "@payload-types";

type ReviewsTranslator = ReturnType<typeof useTranslations>;

const buildSchema = (tReviews: ReviewsTranslator) =>
  z.object({
    rating: z
      .number()
      .min(1, tReviews("validation.rating"))
      .max(5, tReviews("validation.rating")),
    title: z
      .string()
      .trim()
      .min(3, tReviews("validation.title"))
      .max(120, tReviews("validation.title")),
    body: z
      .string()
      .trim()
      .min(10, tReviews("validation.body"))
      .max(5000, tReviews("validation.body")),
  });

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

type ReviewFormProps = {
  slug: string;
  existingReview?: Review | null;
};

export default function ReviewForm({ slug, existingReview }: ReviewFormProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const tReviews = useTranslations("reviews");
  const isUpdate = !!existingReview;
  const schema = useMemo(() => buildSchema(tReviews), [tReviews]);
  const messageToToastMap: Record<string, string> = {
    "You can only review providers you have purchased from.":
      tReviews("toasts.purchase_required"),
    "Sign in to write a review.": tReviews("toasts.sign_in_required"),
    "User account not found.": tReviews("toasts.account_missing"),
    "Tenant not found": tReviews("toasts.tenant_missing"),
  };

  const mapReviewMessage = (message?: string) =>
    (message ? messageToToastMap[message] : undefined) ??
    tReviews("toasts.generic_error");

  const mapReviewError = (err: unknown) => {
    // Prefer stable TRPC error codes first where possible.
    if (err instanceof TRPCClientError) {
      const code = err.data?.code;

      if (code === "UNAUTHORIZED") {
        return tReviews("toasts.sign_in_required");
      }

      return mapReviewMessage(err.data?.message ?? err.message);
    }

    if (err instanceof Error) {
      return mapReviewMessage(err.message);
    }

    return tReviews("toasts.generic_error");
  };

  const create = useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries();
        toast.success(
          isUpdate
            ? tReviews("toasts.update_success")
            : tReviews("toasts.create_success"),
        );
        router.refresh();
      },
      onError: (err) => {
        console.error("reviews.create failed:", err);
        toast.error(mapReviewError(err));
      },
    }),
  );

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(schema),
    defaultValues: {
      rating: existingReview?.rating ?? 0,
      title: existingReview?.title ?? "",
      body: existingReview?.body ?? "",
    },
  });

  const bodyValue = form.watch("body");
  const titleId = "review-title";
  const bodyId = "review-body";

  const submit = (values: FormValues) => create.mutate({ slug, ...values });

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(submit)}>
      <div>
        <div className="flex items-center justify-center gap-3">
          <span className="font-medium">{tReviews("form.rating")}</span>
          <StarPicker
            value={form.watch("rating")}
            ariaLabel={tReviews("a11y.rating_group")}
            getStarAriaLabel={(value) =>
              tReviews("a11y.rating_option", { count: value })
            }
            onChange={(v) =>
              form.setValue("rating", v, { shouldValidate: true })
            }
          />
        </div>
        {form.formState.errors.rating && (
          <p className="text-sm text-destructive mt-1 text-center">
            {form.formState.errors.rating.message ??
              tReviews("validation.rating")}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={titleId} className="block mb-2 font-medium">
          {tReviews("form.title")}
        </label>
        <Input
          id={titleId}
          maxLength={120}
          {...form.register("title")}
          placeholder={tReviews("form.title_placeholder")}
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.title.message ??
              tReviews("validation.title")}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={bodyId} className="block mb-2 font-medium">
          {tReviews("form.body")}
        </label>
        <Textarea
          rows={10}
          id={bodyId}
          className="min-h-[12rem]"
          maxLength={5000}
          {...form.register("body")}
          placeholder={tReviews("form.body_placeholder")}
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {bodyValue?.length ?? 0}/5000
        </div>
        {form.formState.errors.body && (
          <p className="text-sm text-destructive mt-1">
            {form.formState.errors.body.message ?? tReviews("validation.body")}
          </p>
        )}
      </div>

      <div className="pt-2 flex justify-center">
        <Button
          type="submit"
          size="lg"
          className="bg-black text-white hover:bg-pink-400 hover:text-primary"
          variant="elevated"
          disabled={
            create.isPending ||
            form.formState.isSubmitting ||
            !form.formState.isValid
          }
        >
          {create.isPending || form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUpdate
                ? tReviews("form.updating")
                : tReviews("form.submitting")}
            </>
          ) : isUpdate ? (
            tReviews("form.update")
          ) : (
            tReviews("form.submit")
          )}
        </Button>
      </div>
    </form>
  );
}
