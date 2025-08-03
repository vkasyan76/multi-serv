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
import { useState, useEffect, useMemo } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useUser } from "@clerk/nextjs";
import { getLocaleAndCurrency } from "../location-utils";
import LoadingPage from "@/components/shared/loading";

import { NumericFormat, NumberFormatValues } from "react-number-format";
import PhoneInput from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { getCountryCodeFromName } from "../location-utils";

// Create a Zod schema for the tenant/vendor

export function VendorProfileForm() {
  const trpc = useTRPC();
  const { data: categories } = useQuery(trpc.categories.getMany.queryOptions());
  
  // Fetch vendor profile data from database
  const { data: vendorProfile, isLoading } = useQuery(
    trpc.auth.getVendorProfile.queryOptions()
  );

  // Fetch user profile to get country for phone number default
  const { data: userProfile } = useQuery(
    trpc.auth.getUserProfile.queryOptions()
  );

  const [intlConfig] = useState(getLocaleAndCurrency()); // cache the locale/currency (do not run on every render)

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
      phone: undefined,
      hourlyRate: 1,
    },
  });

  // Update form values when vendor profile data is available
  useEffect(() => {
    if (vendorProfile) {
      form.reset({
        name: vendorProfile.name || "",
        firstName: vendorProfile.firstName || "",
        lastName: vendorProfile.lastName || "",
        bio: vendorProfile.bio || "",
        services: vendorProfile.services || [],
        categories: vendorProfile.categories || [], // Now directly slugs
        subcategories: vendorProfile.subcategories || [], // Now directly slugs
        website: vendorProfile.website || "",
        image: typeof vendorProfile.image === 'string' ? vendorProfile.image : vendorProfile.image?.url || "",
        phone: vendorProfile.phone || undefined,
        hourlyRate: vendorProfile.hourlyRate || 1,
      });
    }
  }, [vendorProfile, form]);

  // Watch selected categories
  const selectedCategories = useMemo(() => form.watch("categories") || [], [form.watch("categories")]);

  // Helper functions to generate placeholder text for MultiSelect components
  const getServicesPlaceholder = () => {
    // Get current form values for services
    const currentServices = form.getValues("services") || [];
    
    // If we have current services
    if (currentServices.length > 0) {
      return currentServices.join(", ");
    }
    
    // If no services are selected
    return "Select service types";
  };

  const getCategoriesPlaceholder = () => {
    // Get current form values for categories
    const currentCategories = form.getValues("categories") || [];
    
    // If we have current categories and they're valid
    if (currentCategories.length > 0) {
      // Find category names from the categories data
      const categoryNames = currentCategories.map(slug => {
        const category = categories?.find(cat => cat.slug === slug);
        return category?.name || slug;
      });
      return categoryNames.join(", ");
    }
    
    // If no categories are selected
    return "Select categories";
  };

  const getSubcategoriesPlaceholder = () => {
    // Get current form values for subcategories
    const currentSubcategories = form.getValues("subcategories") || [];
    
    // If we have current subcategories and they're valid for available subcategories
    if (currentSubcategories.length > 0 && availableSubcategories.length > 0) {
      const validSubcategories = currentSubcategories.filter(subSlug => 
        availableSubcategories.some(sub => sub.slug === subSlug)
      );
      
      if (validSubcategories.length > 0) {
        // Find subcategory names from the available subcategories
        const subcategoryNames = validSubcategories.map(slug => {
          const subcategory = availableSubcategories.find(sub => sub.slug === slug);
          return subcategory?.name || slug;
        });
        return subcategoryNames.join(", ");
      }
    }
    
    // If no categories are selected, show "Select categories first"
    if (selectedCategories.length === 0) {
      return "Select categories first";
    }
    
    // If categories are selected but no subcategories are chosen
    return "Select subcategories";
  };

  // Helper function to determine if we should use black font for better visibility
  const shouldUseBlackFont = (fieldType: 'services' | 'categories' | 'subcategories') => {
    switch (fieldType) {
      case 'services': {
        const currentServices = form.getValues("services") || [];
        return currentServices.length > 0;
      }
      case 'categories': {
        const currentCategories = form.getValues("categories") || [];
        return currentCategories.length > 0;
      }
      case 'subcategories': {
        const currentSubcategories = form.getValues("subcategories") || [];
        return currentSubcategories.length > 0;
      }
      default:
        return false;
    }
  };

  // Get subcategories for the selected categories
  const availableSubcategories = useMemo(() =>
    categories
      ?.filter((cat) => selectedCategories.includes(cat.slug))
      .flatMap((cat) =>
        (cat.subcategories || []).map((sub) => ({ ...sub, parent: cat.slug }))
      ) || [], [categories, selectedCategories]);

  // Clear subcategories when categories change
  useEffect(() => {
    // Only run this effect if we have categories data and the form has been initialized
    if (!categories || categories.length === 0) return;
    
    const currentSubcategories = form.getValues("subcategories") || [];
    const availableSubcategorySlugs = availableSubcategories.map(sub => sub.slug);
    
    // Only clear subcategories if we have selected categories but the subcategories are invalid
    if (selectedCategories.length > 0) {
      // Remove subcategories that are no longer valid for the selected categories
      const validSubcategories = currentSubcategories.filter(subSlug => 
        availableSubcategorySlugs.includes(subSlug)
      );
      
      if (validSubcategories.length !== currentSubcategories.length) {
        form.setValue("subcategories", validSubcategories);
      }
    }
  }, [selectedCategories, form, availableSubcategories, categories]);



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

  const createVendorProfile = useMutation(
    trpc.auth.createVendorProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Vendor profile created successfully!");
        // Refresh the vendor profile data
        window.location.reload();
      },
      onError: (error) => {
        console.error("Error creating vendor profile:", error);
        toast.error(error.message || "Failed to create vendor profile. Please try again.");
      },
    })
  );

  const updateVendorProfile = useMutation(
    trpc.auth.updateVendorProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Vendor profile updated successfully!");
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.error(error.message || "Failed to update profile. Please try again.");
      },
    })
  );

  const onSubmit = (values: z.infer<typeof vendorSchema>) => {
    console.log("Form values being submitted:", values);
    console.log("Phone value:", values.phone);
    
    // Check if user already has a vendor profile
    if (vendorProfile && (vendorProfile.name || vendorProfile.firstName || vendorProfile.lastName || vendorProfile.bio || vendorProfile.services?.length > 0 || vendorProfile.categories?.length > 0 || vendorProfile.website || vendorProfile.image || vendorProfile.phone || vendorProfile.hourlyRate > 1)) {
      // Update existing vendor profile
      updateVendorProfile.mutate(values);
    } else {
      // Create new vendor profile
      createVendorProfile.mutate(values);
    }
    
    // File upload logic can be added here:
    if (selectedFile) {
      // File upload logic will be implemented here
    }
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
    // toast.error(messages || "Please fix the errors in the form.");
    toast.error(
      <span style={{ whiteSpace: "pre-line" }}>
        {messages || "Please fix the errors in the form."}
      </span>
    );
  };

  // Show loading state while vendor profile data is loading
  if (isLoading) {
    return <LoadingPage />;
  }

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
                         
                         // Handle empty value case
                         if (values.floatValue === undefined || values.floatValue === null) {
                           form.setValue("hourlyRate", 1);
                         } else {
                           // Ensure we're passing a number, not a string
                           const numericValue = Number(values.floatValue);
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
                      placeholder={getServicesPlaceholder()}
                      placeholderClassName={shouldUseBlackFont('services') ? "text-foreground font-medium" : ""}
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
                      placeholder={getCategoriesPlaceholder()}
                      placeholderClassName={shouldUseBlackFont('categories') ? "text-foreground font-medium" : ""}
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
                        value: sub.slug, // Use slug to match the pattern used for categories
                      }))}
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder={getSubcategoriesPlaceholder()}
                      placeholderClassName={shouldUseBlackFont('subcategories') ? "text-foreground font-medium" : ""}
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

            {/* Phone Number */}
            <FormField
              name="phone"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number (optional)</FormLabel>
                  <FormControl>
                    <PhoneInput
                      international
                      countries={[
                        "DE", "FR", "IT", "ES", "NL", "BE", "AT", "PL", "CZ", "SK", 
                        "HU", "RO", "BG", "HR", "SI", "GR", "PT", "DK", "SE", "FI", 
                        "LU", "MT", "CY", "EE", "LV", "LT", "IE", "GB", "CH", "UA"
                      ]}
                      defaultCountry={userProfile?.country ? getCountryCodeFromName(userProfile.country) as Country : "DE"}
                      value={field.value || undefined}
                      onChange={(value) => {
                        // Ensure empty string is converted to undefined for proper clearing
                        field.onChange(value || "");
                      }}
                      placeholder="+49 123 4567"
                      className="w-full border rounded px-2 py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Website */}
            <FormField
              name="website"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input 
                      {...field} 
                      autoComplete="off" 
                      placeholder="Website (optional)"
                    />
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
          {vendorProfile && (vendorProfile.name || vendorProfile.firstName || vendorProfile.lastName || vendorProfile.bio || vendorProfile.services?.length > 0 || vendorProfile.categories?.length > 0 || vendorProfile.website || vendorProfile.image || vendorProfile.phone || vendorProfile.hourlyRate > 1) ? "Update Provider Profile" : "Create Provider Profile"}
        </Button>
      </form>
    </Form>
  );
}
