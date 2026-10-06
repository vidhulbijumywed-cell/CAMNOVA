import { NextRequest, NextResponse } from "next/server";
import { actor, HttpError, admin } from "@/lib/auth";
import {
  addPayment,
  bookingAction,
  saveBooking,
  saveEntity,
  snapshot,
  locked,
  audit,
} from "@/lib/service";
import { previewImport, commitImport, rollbackImport } from "@/lib/importer";
import { documentPdf, exportSheet } from "@/lib/documents";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const a = await actor(),
      { path } = await params;
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (
        !origin ||
        origin !== new URL(process.env.NEXTAUTH_URL ?? req.url).origin
      )
        throw new HttpError(403, "Untrusted request origin");
      const size = Number(req.headers.get("content-length") ?? 0);
      if (size > 11 * 1024 * 1024)
        throw new HttpError(413, "Request too large");
    }
    if (req.method === "GET") {
      if (path[0] === "snapshot")
        return NextResponse.json(
          await snapshot(
            a,
            req.nextUrl.searchParams.get("month") ??
              new Date()
                .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
                .slice(0, 7),
          ),
        );
      if (path[0] === "export") {
        const kind = path[1],
          format =
            req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
        if (!["bookings", "collections", "inventory", "reports"].includes(kind))
          throw new HttpError(400, "Invalid export");
        const data = await exportSheet(
          kind,
          format,
          kind === "reports"
            ? await snapshot(
                a,
                req.nextUrl.searchParams.get("month") ??
                  new Date()
                    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
                    .slice(0, 7),
              )
            : undefined,
        );
        return new Response(new Uint8Array(data), {
          headers: {
            "Content-Type":
              format === "csv"
                ? "text/csv"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="camnova-${kind}.${format}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (path[0] === "documents") {
        const data = await documentPdf(
          Number(path[1]),
          req.nextUrl.searchParams.get("kind") ?? "summary",
          req.nextUrl.searchParams.get("payment") ?? undefined,
        );
        return new Response(new Uint8Array(data), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="camnova-${path[1]}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
    }
    if (req.method === "POST") {
      if (path[0] === "import") {
        admin(a);
        if (path[1] === "rollback") {
          const body = await req.json();
          return NextResponse.json(await rollbackImport(a, body.id));
        }
        const form = await req.formData(),
          file = form.get("file");
        if (!(file instanceof File))
          throw new HttpError(400, "Workbook required");
        if (file.size > 10 * 1024 * 1024)
          throw new HttpError(413, "Maximum workbook size is 10 MB");
        const buffer = Buffer.from(await file.arrayBuffer()),
          mapping = JSON.parse(String(form.get("mapping") ?? "{}"));
        for (const value of Object.values(mapping))
          if (
            !Number.isInteger(value) ||
            Number(value) < 1 ||
            Number(value) > 50
          )
            throw new HttpError(400, "Invalid column mapping");
        const result =
          path[1] === "commit"
            ? await commitImport(
                a,
                buffer,
                file.name,
                JSON.parse(String(form.get("rows") ?? "[]")),
                mapping,
              )
            : await previewImport(buffer, file.name, mapping);
        return NextResponse.json(result);
      }
      const body = await req.json();
      if (path[0] === "bookings") {
        const id = path[1] ? Number(path[1]) : undefined;
        if (path[2] === "payment" && id)
          return NextResponse.json(await addPayment(a, id, body));
        if (path[2] === "action" && id)
          return NextResponse.json(await bookingAction(a, id, body));
        return NextResponse.json(await saveBooking(a, body, id));
      }
      return NextResponse.json(await saveEntity(a, path[0], body));
    }
    throw new HttpError(404, "Endpoint not found");
  } catch (e) {
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    const code = (e as { code?: string }).code;
    if (code === "P2002")
      return NextResponse.json(
        { error: "A record with this identity already exists" },
        { status: 409 },
      );
    if (code === "P2025")
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    console.error("CAMNOVA request failed", { type: (e as Error).name, code });
    return NextResponse.json(
      { error: "Unable to complete request. Verify your input and try again." },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST };
