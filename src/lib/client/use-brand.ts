"use client";
import { useEffect, useState } from "react";
import { api, type BrandData } from "./api";

// The brand's rules and facts, fetched once per page load and shared by every component that needs them.
let brandCache: Promise<BrandData> | null = null;

export function useBrand(): BrandData | null {
  const [brand, setBrand] = useState<BrandData | null>(null);
  useEffect(() => {
    let live = true;
    brandCache ??= api.brand();
    brandCache.then((b) => live && setBrand(b)).catch(() => (brandCache = null));
    return () => {
      live = false;
    };
  }, []);
  return brand;
}
