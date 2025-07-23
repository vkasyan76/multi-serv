"use client";

import { useJsApiLoader, StandaloneSearchBox } from "@react-google-maps/api";

import { Input } from "@/components/ui/input";
import { useRef } from "react";

export const PlacesAutocompleteSearch = () => {
  const inputRef = useRef<google.maps.places.SearchBox | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ["places"],
  });

  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="text-red-500 text-sm">
        Google Maps API key is not configured
      </div>
    );
  }

  console.log("isLoaded", isLoaded);

  const handleOnPlacesChanged = () => {
    if (!inputRef.current) return;
    const address = inputRef.current.getPlaces();
    console.log("Selected address:", address);
  };

  return (
    <div>
      {isLoaded && (
        <StandaloneSearchBox
          onLoad={(ref) => (inputRef.current = ref)}
          onPlacesChanged={() => {
            handleOnPlacesChanged();
          }}
        >
          <Input placeholder="Search for a place" />
        </StandaloneSearchBox>
      )}
    </div>
  );
};
