import { redirect, notFound } from "next/navigation";
import { HttpError } from "@/lib/auth";
import { actor, admin } from "@/lib/auth";
import { records, categories } from "@/lib/public-site";
import { db } from "@/lib/db";
import Editor from "./editor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Website content | CAMNOVA",
  robots: { index: false, follow: false },
};
export default async function Content() {
  try {
    const a = await actor();
    admin(a);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login");
    if (e instanceof HttpError && e.status === 403) notFound();
    throw e;
  }
  const [content, inventory] = await Promise.all([
    records(),
    db.equipment.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <Editor initial={content} inventory={inventory} categories={categories} />
  );
}
