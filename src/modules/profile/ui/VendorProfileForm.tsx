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

import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { vendorSchema, VENDOR_FIELD_LABELS, SERVICE_OPTIONS } from "../schemas";
import { toast } from "sonner";
import type { FieldErrors } from "react-hook-form";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useUser } from "@clerk/nextjs";
import { getLocaleAndCurrency } from "../location-utils";

import { NumericFormat, NumberFormatValues } from "react-number-format";

// Create a Zod schema for the tenant/vendor

export function VendorProfileForm() {
  const trpc = useTRPC();
  const { data: categories } = useQuery(trpc.categories.getMany.queryOptions());

  const [intlConfig] = useState(getLocaleAndCurrency()); // cache the locale/currency (do not run on every render)

  // console.log("categories:", categories);

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
      hourlyRate: 1,
    },
  });

  // Watch selected categories
  const selectedCategories = form.watch("categories") || [];
  
  // Watch hourlyRate to debug
  const hourlyRateValue = form.watch("hourlyRate");
  console.log("Watched hourlyRate:", hourlyRateValue, "type:", typeof hourlyRateValue);

  // Get subcategories for the selected categories
  const availableSubcategories =
    categories
      ?.filter((cat) => selectedCategories.includes(cat.id))
      .flatMap((cat) =>
        (cat.subcategories || []).map((sub) => ({ ...sub, parent: cat.id }))
      ) || [];

  // File upload:
  // obtaining image placeholder:
  const { user } = useUser(); // user is null if not signed in
  const imageUrl = user?.imageUrl; // This is the profile photo Clerk provides

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const updateVendorProfile = useMutation(
    trpc.auth.updateVendorProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Vendor profile saved successfully!");
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.error(error.message || "Failed to update profile. Please try again.");
      },
    })
  );

  const onSubmit = (values: z.infer<typeof vendorSchema>) => {
    // hourlyRate is now a proper number from NumericFormat
    console.log("Form values:", values);
    console.log("hourlyRate type:", typeof values.hourlyRate);
    console.log("hourlyRate value:", values.hourlyRate);
    console.log("hourlyRate isNaN:", isNaN(values.hourlyRate));
    
    updateVendorProfile.mutate(values);
    
    // File upload logic can be added here:
    if (selectedFile) {
      console.log("File to upload:", selectedFile.name, selectedFile);
    }
  };

  const onError = (errors: FieldErrors<z.infer<typeof vendorSchema>>) => {
    console.log("Form validation errors:", errors);
    
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
    // toast.error(messages || "Please fix the errors in the form.");
    toast.error(
      <span style={{ whiteSpace: "pre-line" }}>
        {messages || "Please fix the errors in the form."}
      </span>
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-col gap-2 p-4 lg:p-10 overflow-y-auto max-h-[80vh]"
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

        {/* 2 column grid; for wider right column adjsut container - md:grid-cols-5, left: md:col-span-2, right:md:col-span-3  */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-8">
          {/* Left Column */}
          <div className="md:col-span-3 flex flex-col gap-4">
            {/* First Name */}
            <FormField
              name="firstName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      onChange={(e) => {
                        field.onChange(e);
                        // auto-update business name if empty
                        if (!form.getValues("name")) {
                          form.setValue(
                            "name",
                            `${e.target.value}_${form.getValues("lastName")}`
                          );
                        }
                      }}
                    />
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
                    <Input
                      {...field}
                      autoComplete="off"
                      onChange={(e) => {
                        field.onChange(e);
                        // auto-update business name if empty
                        if (!form.getValues("name")) {
                          form.setValue(
                            "name",
                            `${form.getValues("firstName")}_${e.target.value}`
                          );
                        }
                      }}
                    />
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
            {/* Hourly rate */}
            <FormField
              name="hourlyRate"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hourly Rate ({intlConfig.currency})</FormLabel>
                  <FormControl>
                                        <NumericFormat
                      className="w-full border rounded px-2 py-2"
                      thousandSeparator
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      allowLeadingZeros={false}
                      prefix={intlConfig.currency === "EUR" ? "€ " : ""}
                      placeholder={`Enter hourly rate in ${intlConfig.currency}`}
                      value={field.value}
                      valueIsNumericString={false}
                      onBlur={field.onBlur}
                      name={field.name}
                      onValueChange={(values: NumberFormatValues) => {
                         // Pass the numeric value to the form
                         console.log("NumericFormat values:", values);
                         console.log("floatValue:", values.floatValue);
                         
                         // Handle empty value case
                         if (values.floatValue === undefined || values.floatValue === null) {
                           form.setValue("hourlyRate", 1);
                         } else {
                           // Ensure we're passing a number, not a string
                           const numericValue = Number(values.floatValue);
                           console.log("Setting field value to:", numericValue, "type:", typeof numericValue);
                           form.setValue("hourlyRate", numericValue);
                         }
                       }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Type of Service */}
            <FormField
              name="services"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of Service</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={SERVICE_OPTIONS}
                      defaultValue={field.value || []}
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder="Select service types"
                      maxCount={2}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {/* Category dropdown (at bottom of col 1) */}
            <FormField
              name="categories"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categories</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={
                        categories
                          ? categories.map((cat) => ({
                              label: cat.name,
                              value: cat.slug,
                            }))
                          : []
                      }
                      defaultValue={field.value || []}
                      onValueChange={field.onChange}
                      placeholder="Select categories"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {/* SUBCATEGORIES Multi-select */}
            <FormField
              name="subcategories"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategories</FormLabel>
                  <FormControl>
                    <MultiSelect
                      disabled={availableSubcategories.length === 0}
                      options={availableSubcategories.map((sub) => ({
                        label: sub.name,
                        value: sub.id,
                      }))}
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder={
                        availableSubcategories.length === 0
                          ? "Select categories first"
                          : "Select subcategories"
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Right Column (wider) */}
          <div className="md:col-span-4 flex flex-col gap-2">
            {/* Profile Image */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-full h-60 aspect-square  flex items-center justify-center overflow-hidden rounded-lg bg-white relative">
                <Image
                  src={
                    previewUrl ||
                    imageUrl ||
                    "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=facearea&w=256&h=256&facepad=2"
                  }
                  alt="Profile preview"
                  // width={160}
                  // height={160}
                  fill
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <label className="cursor-pointer px-4 py-2 bg-gray-100 rounded-lg border text-sm font-medium hover:bg-gray-200 transition-colors">
                {selectedFile ? selectedFile.name : "Select Image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <FormField
              name="image"
              control={form.control}
              render={({ field }) => (
                <FormItem className="hidden">
                  {/* Hide the manual URL input; keep it for possible backend compatibility */}
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

            {/* Description - Make Only the Description Stretch Without Changing the Grid */}

            <div className="flex-1 flex flex-col">
              <FormField
                name="bio"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="h-full flex flex-col">
                    <FormLabel>Description</FormLabel>
                    <FormControl className="flex-1 flex flex-col rounded-lg">
                      <textarea
                        {...field}
                        maxLength={600}
                        className="w-full h-full border rounded px-2 py-2 bg-white flex-1 resize-none"
                        autoComplete="off"
                        style={{ minHeight: 150 }} // optional: ensures minimum height on all screens
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
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
