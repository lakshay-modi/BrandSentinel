import type { Metadata } from "next";
import { BrandsView } from "@/components/brands-view";

export const metadata: Metadata = { title: "Brands" };

export default function BrandsPage() {
  return <BrandsView />;
}
