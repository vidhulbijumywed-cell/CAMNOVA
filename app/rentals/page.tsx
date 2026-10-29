import { notFound } from "next/navigation";
import { customerCatalogue } from "@/lib/customer-portal";
import { publicInventory, meta } from "@/lib/public-site";
import CustomerStorefront from "./storefront";
import CatalogueLinks from "../components/catalogue-links";
import "../customer-portal.css";
export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function options(searchParams: Props["searchParams"]) {
  const q = await searchParams;
  const value = q.page ?? "1";
  if (typeof value !== "string" || !/^\d+$/.test(value)) notFound();
  const page = Number(value);
  if (
    page < 1 ||
    page > Math.max(1, Math.ceil((await publicInventory()).length / 24))
  )
    notFound();
  return { page, q };
}
export async function generateMetadata({ searchParams }: Props) {
  const { page, q } = await options(searchParams);
  return meta(
    `Camera & equipment rentals${page > 1 ? ` — Page ${page}` : ""} | CAMNOVA`,
    "Browse real camera, lens, lighting and audio rental equipment from CAMNOVA in Kochi. Choose your dates and send a booking request.",
    page > 1 ? `/rentals?page=${page}` : "/rentals",
    Object.keys(q).some((k) => k !== "page"),
  );
}
export default async function RentalsPage({ searchParams }: Props) {
  const { page } = await options(searchParams);
  return (
    <>
      <CustomerStorefront initial={await customerCatalogue()} />
      <CatalogueLinks page={page} />
    </>
  );
}
