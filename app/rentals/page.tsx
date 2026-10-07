import { customerCatalogue } from "@/lib/customer-portal";
import CustomerStorefront from "./storefront";
import "../customer-portal.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "CAMNOVA Rentals — Find your gear" };
export default async function RentalsPage() {
  return <CustomerStorefront initial={await customerCatalogue()} />;
}
