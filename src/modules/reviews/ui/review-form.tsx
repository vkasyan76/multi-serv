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

const schema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(5000),
});
type FormValues = z.infer<typeof schema>;

export default function ReviewForm({ slug }: { slug: string }) {
  const trpc = useTRPC();
  const router = useRouter();
  const qc = useQueryClient();

  const create = useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: async () => {
        // invalidate anything you show on the tenant page
        await qc.invalidateQueries();
        router.replace(`/tenants/${slug}`);
      },
    })
  );

  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(schema),
    defaultValues: { rating: 0, title: "", body: "" },
  });

  const submit = (values: FormValues) => create.mutate({ slug, ...values });

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(submit)}>
      <div>
        <label className="block mb-2 font-medium">Your rating</label>
        <StarPicker
          value={form.watch("rating")}
          onChange={(v) => form.setValue("rating", v, { shouldValidate: true })}
        />
        {form.formState.errors.rating && (
          <p className="text-sm text-destructive mt-1">Pick 1–5 stars.</p>
        )}
      </div>

      <div>
        <label className="block mb-2 font-medium">Title</label>
        <Input
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
          rows={6}
          {...form.register("body")}
          placeholder="What should other customers know?"
        />
        {form.formState.errors.body && (
          <p className="text-sm text-destructive mt-1">
            At least 10 characters.
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={create.isPending || !form.formState.isValid}
      >
        {create.isPending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
