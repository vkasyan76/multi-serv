// src/modules/profile/ui/VendorProfileForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { vendorSchema, VENDOR_FIELD_LABELS, SERVICE_OPTIONS } from "../schemas";
import { toast } from "sonner";
import type { FieldErrors } from "react-hook-form";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

// Create a Zod schema for the tenant/vendor

export function VendorProfileForm() {
  const trpc = useTRPC();
  const { data: categories, isLoading } = useQuery(
    trpc.categories.getMany.queryOptions()
  );

  console.log("categories:", categories);

  const form = useForm<z.infer<typeof vendorSchema>>({
    mode: "onBlur",
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: "",
      firstName: "",
      lastName: "",
      bio: "",
      services: [],
      website: "",
      image: "",
    },
  });

  const onSubmit = (values: z.infer<typeof vendorSchema>) => {
    // Add upload/image API logic here
    // Create slug from name (simple example)
    const slug = values.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const submission = { ...values, slug };
    alert(JSON.stringify(submission, null, 2));
    toast.success("Vendor profile saved successfully!");
  };

  const onError = (errors: FieldErrors<z.infer<typeof vendorSchema>>) => {
    const messages = Object.entries(errors)
      .map(([field, err]) => {
        const label =
          VENDOR_FIELD_LABELS[field as keyof typeof VENDOR_FIELD_LABELS] ||
          field;
        if (Array.isArray(err)) {
          return err.map((e) => `${label}: ${e?.message}`).join("\n");
        }
        return `${label}: ${err?.message}`;
      })
      .filter(Boolean)
      .join("\n");
    toast.error(messages || "Please fix the errors in the form.");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-col gap-8 p-4 lg:p-16 overflow-y-auto max-h-[80vh]" // form scrollable:
        autoComplete="off"
      >
        <div className="flex items-center gap-4 mb-8">
          <Image
            src="/images/infinisimo_logo_illustrator.png"
            alt="Infinisimo Logo"
            width={48}
            height={48}
            className="rounded-full bg-white"
            priority
          />
          <h1 className="text-3xl font-bold">Service Provider Settings</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* First Name */}
          <FormField
            name="firstName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
              </FormItem>
            )}
          />
          {/* Last Name */}
          <FormField
            name="lastName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
              </FormItem>
            )}
          />
          {/* Business Name */}
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name (one word)</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
              </FormItem>
            )}
          />
          {/* Website */}
          <FormField
            name="website"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website (optional)</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            name="category"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Select
                    disabled={isLoading}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      {categories?.find((c) => c.slug === field.value)?.name ||
                        "Select a category"}
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />

          {/* Services Checkboxes */}
          <FormField
            name="services"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Type of Service</FormLabel>
                <FormControl>
                  <div className="flex gap-6 bg-white rounded px-2 py-2">
                    {SERVICE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={field.value?.includes(opt.value)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...(field.value || []), opt.value]
                              : (field.value || []).filter(
                                  (v: string) => v !== opt.value
                                );
                            field.onChange(newValue);
                          }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
          {/* Description */}
          <FormField
            name="bio"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    rows={5}
                    maxLength={600}
                    className="w-full border rounded px-2 py-2 bg-white"
                    autoComplete="off"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Profile Image */}
          <FormField
            name="image"
            control={form.control}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Profile Image URL</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete="off" />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="bg-black text-white hover:bg-pink-400 hover:text-primary"
          disabled={form.formState.isSubmitting}
        >
          Save Provider Profile
        </Button>
      </form>
    </Form>
  );
}
