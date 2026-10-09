import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { customerActor, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  customerCatalogue,
  customerRequests,
  registerCustomer,
  submitCustomerRequest,
} from "@/lib/customer-portal";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;
    if (req.method === "GET") {
      if (path[0] === "catalogue" && path.length === 1)
        return NextResponse.json(
          await customerCatalogue(
            req.nextUrl.searchParams.get("from"),
            req.nextUrl.searchParams.get("to"),
          ),
          { headers: { "Cache-Control": "no-store" } },
        );
      if (path[0] === "photos" && path.length === 2) {
        const photo = await db.equipmentPhoto.findFirst({
          where: {
            equipmentId: path[1],
            equipment: { assets: { some: { status: { not: "RETIRED" } } } },
          },
        });
        if (!photo) throw new HttpError(404, "Photo not found");
        return new Response(new Uint8Array(photo.data), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (path[0] === "me" && path.length === 1) {
        const a = await customerActor();
        const account = await db.customerAccount.findUniqueOrThrow({
          where: { id: a.id },
          select: { customer: { select: { phones: true } } },
        });
        return NextResponse.json(
          {
            phone: account.customer.phones[0] ?? "",
            name: a.name,
            email: a.email,
            requests: await customerRequests(a.id),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    if (req.method === "POST" && path.length === 1) {
      if (
        req.headers.get("origin") !==
        new URL(process.env.NEXTAUTH_URL ?? req.url).origin
      )
        throw new HttpError(403, "Untrusted request origin");
      if (Number(req.headers.get("content-length") ?? 0) > 16384)
        throw new HttpError(413, "Request too large");
      const text = await req.text();
      if (text.length > 16384) throw new HttpError(413, "Request too large");
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new HttpError(400, "Invalid request");
      }
      if (path[0] === "register") {
        const source =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        return NextResponse.json(await registerCustomer(body, source), {
          status: 201,
        });
      }
      if (path[0] === "requests") {
        const a = await customerActor();
        return NextResponse.json(await submitCustomerRequest(a.id, body), {
          status: 201,
        });
      }
    }
    throw new HttpError(404, "Endpoint not found");
  } catch (e) {
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    if ((e as { code?: string }).code === "P2002")
      return NextResponse.json(
        { error: "Unable to create this account. Try signing in instead" },
        { status: 409 },
      );
    console.error("Customer portal request failed", {
      type: (e as Error).name,
      code: (e as { code?: string }).code,
    });
    return NextResponse.json(
      { error: "Unable to complete your request. Please try again" },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST };
