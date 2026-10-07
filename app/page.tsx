import { redirect } from "next/navigation";
import { actor, HttpError } from "@/lib/auth";
import { snapshot } from "@/lib/service";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  let a;
  try {
    a = await actor();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login");
    if (e instanceof HttpError && e.status === 403) redirect("/rentals");
    throw e;
  }
  const month = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .slice(0, 7);
  return (
    <Workspace initial={JSON.parse(JSON.stringify(await snapshot(a, month)))} />
  );
}
