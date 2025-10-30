// "use client";

import { useForm } from "react-hook-form";
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

export default function ReviewForm({
  onSubmit,
  pending,
}: {
  onSubmit: (v: FormValues) => void;
  pending?: boolean;
}) {
  const form = useForm<FormValues>({
    mode: "onChange",
    resolver: zodResolver(schema),
    defaultValues: { rating: 0, title: "", body: "" },
  });

  return (
    <form className="max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label className="block mb-2 font-medium">Your rating</label>
        <StarPicker
          value={form.watch("rating")}
          onChange={(v) => form.setValue("rating", v, { shouldValidate: true })}
        />
      </div>

      <div>
        <label className="block mb-2 font-medium">Title</label>
        <Input
          {...form.register("title")}
          placeholder="What’s most important to know?"
        />
      </div>

      <div>
        <label className="block mb-2 font-medium">Write a review</label>
        <Textarea
          rows={6}
          {...form.register("body")}
          placeholder="What should other customers know?"
        />
      </div>

      <Button type="submit" disabled={pending || !form.formState.isValid}>
        {pending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
