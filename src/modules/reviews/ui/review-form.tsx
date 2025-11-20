"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { StarPicker } from "./star-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Review } from "@payload-types";

const schema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(5000),
});
type FormValues = z.infer<typeof schema>;

type ReviewFormProps = {
  slug: string;
  existingReview?: Review | null;
};

export default function ReviewForm({ slug, existingReview }: ReviewFormProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();

  const create = useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: async () => {
        await qc.invalidateQueries();
        toast.success("Your review has been submitted.");
        router.refresh(); //  show review data on this page
      },
      onError: (err) => {
        console.error("reviews.create failed:", err);
        toast.error(err.message || "Could not submit your review.");
      },
    })
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

  const isUpdate = !!existingReview; // flag to indicate if this is an update

  const bodyValue = form.watch("body");

  const submit = (values: FormValues) => create.mutate({ slug, ...values });

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(submit)}>
      <div>
        <div className="flex items-center justify-center gap-3">
          <span className="font-medium">Your rating</span>
          <StarPicker
            value={form.watch("rating")}
            onChange={(v) =>
              form.setValue("rating", v, { shouldValidate: true })
            }
          />
        </div>
        {form.formState.errors.rating && (
          <p className="text-sm text-destructive mt-1 text-center">
            Pick 1–5 stars.
          </p>
        )}
      </div>

      <div>
        <label className="block mb-2 font-medium">Title</label>
        <Input
          maxLength={120}
          {...form.register("title")}
          placeholder="What’s most important to know?"
        />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive mt-1">3–120 characters.</p>
        )}
      </div>

      <div>
        <label className="block mb-2 font-medium">Write a review</label>
        <Textarea
          rows={10}
          className="min-h-[12rem]" // ~192px; comfortable default on desktop
          maxLength={5000} // matches schema
          {...form.register("body")}
          placeholder="What should other customers know?"
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {bodyValue?.length ?? 0}/5000
        </div>
        {form.formState.errors.body && (
          <p className="text-sm text-destructive mt-1">
            At least 10 characters.
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
              {isUpdate ? "Updating…" : "Submitting…"}
            </>
          ) : isUpdate ? (
            "Update review"
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </form>
  );
}
