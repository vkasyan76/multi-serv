"use client";

import {
  useForm,
  type SubmitHandler,
  type SubmitErrorHandler,
  type Resolver,
} from "react-hook-form"; // Adding fields made the schema type wider; TypeScript’s automatic inference fell out of sync between the schema, the form, and the fields.
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

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import {
  vendorSchema,
  type VendorFormValues,
  VENDOR_FIELD_LABELS,
  SERVICE_OPTIONS,
} from "../schemas";
import { toast } from "sonner";
// import type { FieldErrors } from "react-hook-form";
import {
  isEU,
  normalizeVat,
  composeVatWithIso,
  fullNormalize,
} from "../vat-validation-utils";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { useUser } from "@clerk/nextjs";
import {
  getLocaleAndCurrency,
  getCountryCodeFromName,
  countryNameFromCode,
} from "../location-utils";
import LoadingPage from "@/components/shared/loading";
import { useRouter } from "next/navigation";

import { NumericFormat, NumberFormatValues } from "react-number-format";
import PhoneInput from "react-phone-number-input";
import type { Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import SettingsHeader from "./SettingsHeader"; // responsive reusable profile tabs header

import Link from "next/link";

// Single source-of-truth form type
// type VendorFormValues = z.infer<typeof vendorSchema>;

export function VendorProfileForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: categories } = useQuery(trpc.categories.getMany.queryOptions());

  // Fetch vendor profile data from database
  const { data: vendorProfile, isLoading } = useQuery(
    trpc.auth.getVendorProfile.queryOptions()
  );

  // Fetch user profile to get country for phone number default
  // Fetch user profile fresh when mounting this tab (no stale DE)
  const { data: userProfile } = useQuery({
    ...trpc.auth.getUserProfile.queryOptions(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  // country from the user profile for default selection
  const profileISO =
    (userProfile?.country
      ? getCountryCodeFromName(userProfile.country)
      : undefined) ?? userProfile?.coordinates?.countryISO;

  // read current Stripe snapshot to decide whether to show the banner
  const { data: stripeStatus } = useQuery(
    trpc.auth.getStripeStatus.queryOptions()
  );

  const [intlConfig] = useState(getLocaleAndCurrency()); // cache the locale/currency (do not run on every render)

  // ✅ add a mutation for the VIES check (matches your trpc client pattern)
  const validateVat = useMutation(trpc.vat.validate.mutationOptions());

  // NEW: mirror VIES behavior — strip country code & separators

  // what we loaded from DB (treated as already valid)
  const initialVatRef = useRef<string>("");

  const [vatChecked, setVatChecked] = useState(false);

  const form = useForm<VendorFormValues>({
    mode: "onSubmit",
    resolver: zodResolver(vendorSchema) as Resolver<VendorFormValues>,
    shouldUnregister: true, // ✅ ensures hidden/unmounted fields (e.g., vatId) are removed from the payload
    defaultValues: {
      name: "",
      firstName: "",
      lastName: "",
      bio: "",
      services: [],
      categories: [],
      subcategories: [],
      website: "",
      phone: undefined,
      hourlyRate: 1,
      // NEW - VAT fields
      country: "DE", // prefill, will be overridden below
      vatRegistered: false, // keep simple
      vatId: "", // required only when vatRegistered = true
      // optional but useful so the status chip can render immediately
      vatIdValid: false,
    },
  });

  // always sets the form country to the user’s country whenever userProfile changes:
  useEffect(() => {
    if (!vendorProfile && profileISO) {
      const st = form.getFieldState("country");
      if (!st.isDirty && form.getValues("country") !== profileISO) {
        form.setValue("country", profileISO);
      }
    }
  }, [vendorProfile, profileISO, form]);

  // Update form values when vendor profile data is available
  useEffect(() => {
    if (vendorProfile) {
      form.reset({
        name: vendorProfile.name || "",
        firstName: vendorProfile.firstName || "",
        lastName: vendorProfile.lastName || "",
        bio: vendorProfile.bio || "",
        services: Array.isArray(vendorProfile.services)
          ? vendorProfile.services
          : [],
        categories: Array.isArray(vendorProfile.categories)
          ? vendorProfile.categories
          : [],
        subcategories: Array.isArray(vendorProfile.subcategories)
          ? vendorProfile.subcategories
          : [],
        website: vendorProfile.website || "",
        phone: vendorProfile.phone || undefined,
        hourlyRate: vendorProfile.hourlyRate || 1,
        // NEW - VAT fields
        // ISO-2, matches schema default/transform
        country: profileISO || vendorProfile.country || "DE",
        vatRegistered: vendorProfile.vatRegistered ?? false, // keep simple
        vatId: vendorProfile.vatId || "", // only required when vatRegistered = true
        // if you persist it on the model, use vendorProfile.vatIdValid ?? false
        // vatIdValid: vendorProfile.vatIdValid ?? false,
        // treat value from DB as already validated
        vatIdValid: !!vendorProfile.vatId && (vendorProfile.vatIdValid ?? true),
      });
      const initCountry = vendorProfile.country || "DE";
      initialVatRef.current =
        vendorProfile.vatRegistered && vendorProfile.vatId
          ? fullNormalize(initCountry, vendorProfile.vatId)
          : "";

      setVatChecked(false); // chip isn’t needed anymore
    } else if (profileISO) {
      // brand new vendor: seed from General
      form.setValue("country", profileISO);
    }
  }, [vendorProfile, profileISO, form]);

  // Watch selected categories
  const watchedCategories = form.watch("categories");
  const selectedCategories = useMemo(
    () => watchedCategories || [],
    [watchedCategories]
  );

  // watch VAT registered
  const watchedVatRegistered = form.watch("vatRegistered");
  const watchedCountry = form.watch("country");
  const isEUCountry = isEU(watchedCountry);

  // ✅ If country or the "have VAT" toggle changes, require a fresh check
  useEffect(() => {
    setVatChecked(false);
  }, [watchedCountry]);

  // useEffect(() => {
  //   if (!watchedVatRegistered) {
  //     setVatChecked(false);
  //     form.setValue("vatId", "");
  //     form.setValue("vatIdValid", false);
  //   }
  // }, [watchedVatRegistered, form]);

  // Helper functions to generate placeholder text for MultiSelect components
  const getServicesPlaceholder = () => {
    // Get current form values for services
    const currentServices = form.getValues("services");
    const servicesArray = Array.isArray(currentServices) ? currentServices : [];

    // If we have current services
    if (servicesArray.length > 0) {
      return servicesArray.join(", ");
    }

    // If no services are selected
    return "Select service types";
  };

  const getCategoriesPlaceholder = () => {
    // Get current form values for categories
    const currentCategories = form.getValues("categories");
    const categoriesArray = Array.isArray(currentCategories)
      ? currentCategories
      : [];

    // If we have current categories and they're valid
    if (categoriesArray.length > 0) {
      // Find category names from the categories data
      const categoryNames = categoriesArray.map((slug) => {
        const category = categories?.find((cat) => cat.slug === slug);
        return category?.name || slug;
      });
      return categoryNames.join(", ");
    }

    // If no categories are selected
    return "Select categories";
  };

  const getSubcategoriesPlaceholder = () => {
    // Get current form values for subcategories
    const currentSubcategories = form.getValues("subcategories");
    const subcategoriesArray = Array.isArray(currentSubcategories)
      ? currentSubcategories
      : [];

    // If we have current subcategories and they're valid for available subcategories
    if (subcategoriesArray.length > 0 && availableSubcategories.length > 0) {
      const validSubcategories = subcategoriesArray.filter((subSlug) =>
        availableSubcategories.some((sub) => sub.slug === subSlug)
      );

      if (validSubcategories.length > 0) {
        // Find subcategory names from the available subcategories
        const subcategoryNames = validSubcategories.map((slug) => {
          const subcategory = availableSubcategories.find(
            (sub) => sub.slug === slug
          );
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
  const shouldUseBlackFont = (
    fieldType: "services" | "categories" | "subcategories"
  ) => {
    switch (fieldType) {
      case "services": {
        const currentServices = form.getValues("services");
        const servicesArray = Array.isArray(currentServices)
          ? currentServices
          : [];
        return servicesArray.length > 0;
      }
      case "categories": {
        const currentCategories = form.getValues("categories");
        const categoriesArray = Array.isArray(currentCategories)
          ? currentCategories
          : [];
        return categoriesArray.length > 0;
      }
      case "subcategories": {
        const currentSubcategories = form.getValues("subcategories");
        const subcategoriesArray = Array.isArray(currentSubcategories)
          ? currentSubcategories
          : [];
        return subcategoriesArray.length > 0;
      }
      default:
        return false;
    }
  };

  // Get subcategories for the selected categories
  const availableSubcategories = useMemo(
    () =>
      categories
        ?.filter((cat) => selectedCategories.includes(cat.slug))
        .flatMap((cat) =>
          (cat.subcategories || []).map((sub) => ({ ...sub, parent: cat.slug }))
        ) || [],
    [categories, selectedCategories]
  );

  // Clear subcategories when categories change
  useEffect(() => {
    // Only run this effect if we have categories data and the form has been initialized
    if (!categories || categories.length === 0) return;

    const currentSubcategories = form.getValues("subcategories") || [];
    const availableSubcategorySlugs = availableSubcategories.map(
      (sub) => sub.slug
    );

    // Only clear subcategories if we have selected categories but the subcategories are invalid
    if (selectedCategories.length > 0) {
      // Remove subcategories that are no longer valid for the selected categories
      const validSubcategories = currentSubcategories.filter((subSlug) =>
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
  // track image upload progress to prevent double-submits
  const [isUploading, setIsUploading] = useState(false);

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
        // toast.success("Vendor profile created successfully!");
        // ✅ Add invalidation to update the cache immediately
        queryClient.invalidateQueries({
          queryKey: trpc.auth.getVendorProfile.queryOptions().queryKey,
        });
        // Note: Success handling is now done in onSubmit for better control
        // This prevents double success messages
      },
      onError: (error) => {
        console.error("Error creating vendor profile:", error);
        toast.error(
          error.message || "Failed to create vendor profile. Please try again."
        );
      },
    })
  );

  const updateVendorProfile = useMutation(
    trpc.auth.updateVendorProfile.mutationOptions({
      onSuccess: () => {
        toast.success("Vendor profile updated successfully!");
        // Invalidate the getVendorProfile query to update the cache
        queryClient.invalidateQueries({
          queryKey: trpc.auth.getVendorProfile.queryOptions().queryKey,
        });
      },
      onError: (error) => {
        console.error("Error updating profile:", error);
        toast.error(
          error.message || "Failed to update profile. Please try again."
        );
      },
    })
  );

  const onSubmit: SubmitHandler<VendorFormValues> = async (values) => {
    try {
      // Prevent double submits
      if (
        createVendorProfile.isPending ||
        updateVendorProfile.isPending ||
        isUploading
      ) {
        console.log("Submit already in progress (or uploading), ignoring");
        return;
      }

      const finalCountry = values.country || "DE";

      // ✅ normalize for submit (ensure non-empty when vatRegistered is true)
      let submitVat = "";
      if (values.vatRegistered) {
        const { iso, vat } = normalizeVat(finalCountry, values.vatId ?? "");
        submitVat = composeVatWithIso(iso, vat); // e.g., "DE123456789"
      }

      // Build one payload so vatId is always explicit (on -> normalized, off -> empty)
      const payload = {
        ...values,
        country: finalCountry,
        vatId: values.vatRegistered ? submitVat : "", // off => send empty; server will store null
      };

      if (vendorProfile) {
        // EXISTING PROFILE: Upload image first, then update
        let imageData = values.image;

        if (selectedFile) {
          setIsUploading(true);
          try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            if (vendorProfile?.id) {
              formData.append("tenantId", vendorProfile.id);
            }

            const uploadResponse = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error("Failed to upload image");
            }

            const uploadResult = await uploadResponse.json();
            imageData = uploadResult.file.id;
          } finally {
            setIsUploading(false);
          }
        }
        // Await to avoid races
        await updateVendorProfile.mutateAsync({
          ...payload,
          image: imageData,
        });

        // Then invalidate/refetch to update UI
        await queryClient.invalidateQueries({
          queryKey: trpc.auth.getVendorProfile.queryOptions().queryKey,
        });
      } else {
        // NEW PROFILE: Create first, then upload image
        try {
          // Step 1: Create profile without image
          console.log("Creating vendor profile without image...");
          const createdProfile = await createVendorProfile.mutateAsync(payload);

          if (!createdProfile || !createdProfile.id) {
            throw new Error("Profile created but no ID returned");
          }

          console.log("Profile created successfully, ID:", createdProfile.id);

          // Step 2: Upload image if selected
          if (selectedFile) {
            console.log("Uploading image for new profile...");
            setIsUploading(true);
            try {
              const formData = new FormData();
              formData.append("file", selectedFile);
              formData.append("tenantId", createdProfile.id);

              const uploadResponse = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });

              if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                console.warn(
                  "Profile created but image upload failed:",
                  errorData
                );
                toast.warning(
                  "Profile created successfully, but image upload failed. You can add the image later from the profile editor."
                );
              } else {
                console.log("Image uploaded successfully");
                setSelectedFile(null);
                setPreviewUrl(null);
              }
            } finally {
              setIsUploading(false);
            }
          }

          toast.success("Vendor profile created. Next: set up payouts.");

          // Step 4: Hydrate cache and stay on vendor tab
          // Invalidate and refetch to get the complete profile data
          await queryClient.invalidateQueries({
            queryKey: trpc.auth.getVendorProfile.queryOptions().queryKey,
          });
          // Show vendor first, then ProfileTabs will auto-hop to payouts
          router.replace("/profile?tab=vendor&autopayout=1");
        } catch (error) {
          console.error("Error creating profile:", error);

          if (
            error instanceof Error &&
            error.message.includes("already taken")
          ) {
            toast.error(
              "Business name is already taken. Please choose a different name."
            );
          } else {
            toast.error("Failed to create vendor profile. Please try again.");
          }
        }
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image. Please try again.");
    }
  };

  const onError: SubmitErrorHandler<VendorFormValues> = (errors) => {
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

  const vatRegistered = form.watch("vatRegistered");
  const vatId = form.watch("vatId");
  const country = form.watch("country");
  // do we need a validation? Only if user has VAT + entered something + it differs from DB
  const requiresVatValidation =
    isEUCountry &&
    vatRegistered &&
    !!vatId &&
    fullNormalize(country, vatId) !== initialVatRef.current;

  // Submit is disabled until validation has been run and marked valid
  const submitDisabled =
    isUploading ||
    createVendorProfile.isPending ||
    updateVendorProfile.isPending ||
    (requiresVatValidation && !(vatChecked && form.getValues("vatIdValid")));

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, onError)}
        className="flex flex-col gap-2 p-4 lg:p-7 overflow-y-auto max-h-[80vh]"
        autoComplete="off"
      >
        <SettingsHeader title="Service Provider Settings" />

        {/* payments onboarding reminder */}
        {vendorProfile &&
          stripeStatus &&
          stripeStatus.onboardingStatus !== "completed" && (
            <Alert className="mb-4">
              <AlertTitle>Complete payments onboarding</AlertTitle>
              <AlertDescription>
                To receive payouts, finish your Stripe onboarding.{" "}
                <Link
                  href="/profile?tab=payouts"
                  className="underline font-medium"
                >
                  Go to Payments
                </Link>
              </AlertDescription>
            </Alert>
          )}

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
                  <FormLabel>Business Name (for your page URL)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="off"
                      placeholder="Enter business name"
                    />
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
                        if (
                          values.floatValue === undefined ||
                          values.floatValue === null
                        ) {
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
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder={getServicesPlaceholder()}
                      placeholderClassName={
                        shouldUseBlackFont("services")
                          ? "text-foreground font-medium"
                          : ""
                      }
                      // aligns badges to the top and gives a touch more breathing room
                      className="items-start py-2.5"
                      maxCount={4}
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
                      value={field.value || []}
                      onValueChange={field.onChange}
                      placeholder={getCategoriesPlaceholder()}
                      placeholderClassName={
                        shouldUseBlackFont("categories")
                          ? "text-foreground font-medium"
                          : ""
                      }
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
                // extra bottom space so the border that follows the grid never visually “cuts” chips
                <FormItem className="mb-4">
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
                      placeholderClassName={
                        shouldUseBlackFont("subcategories")
                          ? "text-foreground font-medium"
                          : ""
                      }
                      // let the badges wrap comfortably; override Button’s default vertical centering
                      className="items-start py-2"
                      // show a few before “+N more” to reduce height jumps
                      maxCount={4}
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
                    (typeof vendorProfile?.image === "string"
                      ? vendorProfile.image
                      : vendorProfile?.image?.url) ||
                    imageUrl ||
                    "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=facearea&w=256&h=256&facepad=2"
                  }
                  alt="Profile preview"
                  fill
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <label
                className={
                  "cursor-pointer px-4 py-2 bg-gray-100 rounded-lg border text-sm font-medium transition-colors " +
                  (isUploading ||
                  createVendorProfile.isPending ||
                  updateVendorProfile.isPending
                    ? "opacity-60 cursor-not-allowed pointer-events-none"
                    : "hover:bg-gray-200")
                }
              >
                {selectedFile
                  ? selectedFile.name
                  : "Select Image for upload (max 5MB)"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={
                    isUploading ||
                    createVendorProfile.isPending ||
                    updateVendorProfile.isPending
                  }
                />
              </label>
            </div>

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
                        "DE",
                        "FR",
                        "IT",
                        "ES",
                        "NL",
                        "BE",
                        "AT",
                        "PL",
                        "CZ",
                        "SK",
                        "HU",
                        "RO",
                        "BG",
                        "HR",
                        "SI",
                        "GR",
                        "PT",
                        "DK",
                        "SE",
                        "FI",
                        "LU",
                        "MT",
                        "CY",
                        "EE",
                        "LV",
                        "LT",
                        "IE",
                        "GB",
                        "CH",
                        "UA",
                      ]}
                      defaultCountry={
                        userProfile?.country
                          ? (getCountryCodeFromName(
                              userProfile.country
                            ) as Country)
                          : "DE"
                      }
                      value={field.value || undefined}
                      onChange={(value) => {
                        // Ensure empty string is converted to undefined for proper clearing
                        field.onChange(value ?? undefined);
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

            {/* Description - Fixed Height with Scroll */}
            <FormField
              name="bio"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      maxLength={600}
                      className="w-full border rounded px-3 py-2 bg-white resize-none overflow-y-auto"
                      autoComplete="off"
                      style={{
                        height: "120px", // Fixed height instead of h-full
                        minHeight: "120px",
                      }}
                      placeholder="Describe your services, experience, and what makes you unique..."
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground mt-1">
                    {field.value?.length || 0}/600 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        {/* ===== Business details (used for invoices & tax where applicable) ===== */}
        <div className="mt-4 border-t pt-6">
          {/* Business country — display only (ISO-2 kept in form state). */}
          <FormField
            name="country"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                {/* keep ISO-2 in the form state */}
                <input type="hidden" {...field} value={field.value} />

                {/* Label row with inline helper copy */}
                <div className="flex items-center justify-between gap-3">
                  <FormLabel className="m-0">Business country</FormLabel>
                  <span className="text-xs text-muted-foreground">
                    Prepopulated from your user profile. To change it, edit{" "}
                    <Link
                      href="/profile?tab=general"
                      className="underline font-medium"
                    >
                      General settings
                    </Link>
                    .
                  </span>
                </div>

                <FormControl>
                  <Input
                    value={countryNameFromCode(field.value, intlConfig.locale)}
                    readOnly
                    disabled
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          {/* VAT UI — compact two-column row */}
          {isEUCountry && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* left: checkbox unchanged */}
              <FormField
                name="vatRegistered"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <input
                        id="vat-registered"
                        type="checkbox"
                        className="h-4 w-4 accent-black"
                        checked={!!field.value}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          field.onChange(checked);
                          setVatChecked(false);
                          if (!checked) {
                            form.setValue("vatId", "");
                            form.setValue("vatIdValid", false);
                          }
                        }}
                      />
                      <FormLabel htmlFor="vat-registered" className="m-0">
                        Do you have VAT ID? (optional)
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* right: VAT input + Validate button + status chip */}
              {watchedVatRegistered ? (
                <FormField
                  name="vatId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-3">
                        <FormLabel className="m-0 shrink-0 w-16">
                          Valid VAT ID:
                        </FormLabel>

                        <div className="flex-1">
                          <FormControl>
                            <Input
                              {...field}
                              autoComplete="off"
                              value={field.value ?? ""} // <- keep controlled so DB value renders immediately
                              placeholder="e.g., DE123456789"
                              onChange={(e) => {
                                field.onChange(e);
                                setVatChecked(false); // editing invalidates previous check
                                form.setValue("vatIdValid", false);
                              }}
                              onBlur={async () => {
                                const raw = field.value?.trim();
                                if (!raw) return;
                                try {
                                  const { iso, vat } = normalizeVat(
                                    form.getValues("country"),
                                    raw
                                  );
                                  const res = await validateVat.mutateAsync({
                                    countryCode: iso,
                                    vat,
                                  });
                                  // ✅ write normalized value back into the field (e.g., "DE123456789")
                                  form.setValue(
                                    "vatId",
                                    composeVatWithIso(iso, vat),
                                    {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    }
                                  );
                                  form.setValue("vatIdValid", !!res.valid);
                                  setVatChecked(true);
                                } catch (e: unknown) {
                                  form.setValue("vatIdValid", false);
                                  setVatChecked(true);
                                  const msg =
                                    e instanceof Error ? e.message : String(e);
                                  toast.error(`VAT validation failed: ${msg}`);
                                }
                              }}
                            />
                          </FormControl>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={
                            validateVat.isPending || !form.getValues("vatId")
                          }
                          onClick={async () => {
                            try {
                              const { iso, vat } = normalizeVat(
                                form.getValues("country"),
                                form.getValues("vatId")!
                              );
                              const res = await validateVat.mutateAsync({
                                countryCode: iso,
                                vat,
                              });
                              form.setValue("vatIdValid", !!res.valid);
                              // ✅ normalize & write back to ensure a non-empty value is submitted
                              form.setValue(
                                "vatId",
                                composeVatWithIso(iso, vat),
                                {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                }
                              );
                              setVatChecked(true);
                              toast[res.valid ? "success" : "error"](
                                res.valid
                                  ? "VAT number is valid via VIES."
                                  : "VAT number is NOT valid."
                              );
                            } catch (e: unknown) {
                              form.setValue("vatIdValid", false);
                              setVatChecked(true);
                              const msg =
                                e instanceof Error ? e.message : String(e);
                              toast.error(`VAT validation failed: ${msg}`);
                            }
                          }}
                        >
                          {validateVat.isPending ? "Validating..." : "Validate"}
                        </Button>
                      </div>

                      {/* tiny status chip */}
                      <div className="text-xs mt-1">
                        {vatChecked ? (
                          form.watch("vatIdValid") ? (
                            <span className="text-green-600">Valid VAT ID</span>
                          ) : (
                            <span className="text-red-600">Invalid VAT ID</span>
                          )
                        ) : null}
                      </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="hidden md:block" />
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="bg-black text-white hover:bg-pink-400 hover:text-primary"
          disabled={submitDisabled}
        >
          {isUploading ||
          createVendorProfile.isPending ||
          updateVendorProfile.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isUploading
                ? "Uploading…"
                : vendorProfile
                  ? "Updating..."
                  : "Creating..."}
            </>
          ) : vendorProfile &&
            (vendorProfile.name ||
              vendorProfile.firstName ||
              vendorProfile.lastName ||
              vendorProfile.bio ||
              vendorProfile.services?.length > 0 ||
              vendorProfile.categories?.length > 0 ||
              vendorProfile.website ||
              vendorProfile.image ||
              vendorProfile.phone ||
              vendorProfile.hourlyRate > 1) ? (
            "Update Provider Profile"
          ) : (
            "Create Provider Profile"
          )}
        </Button>
      </form>
    </Form>
  );
}
