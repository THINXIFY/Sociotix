import { MAX_PRODUCT_FILE_BYTES } from "@/lib/digital-products/admin";
import { clientInfo, requireStaff } from "@/server/auth";
import { enforce } from "@/server/auth/rate-limit";
import { getDb } from "@/server/db/client";
import { addProductFile } from "@/server/digital-products/files";
import { digitalProductsChanged } from "@/server/digital-products/public";
import { AppError } from "@/server/errors";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/** Adds a download file (multipart field "file", optional "version"). Checked by its bytes; stored privately. */
export const POST = route<{ params: Promise<{ id: string }> }>(
  async (request, { params }) => {
    assertSameOrigin(request);
    const actor = await requireStaff("settings:manage");
    const db = getDb();
    await enforce(db, "digital-product-files", actor.userId, { limit: 60, windowSeconds: 3600 }, "That's a lot of uploads in a short time. Please wait a few minutes.");
    const form = (request.headers.get("content-type") ?? "").startsWith("multipart/form-data") ? await request.formData().catch(() => null) : null;
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_FAILED", "Choose a file to upload.", { details: { field: "file" } });
    if (file.size > MAX_PRODUCT_FILE_BYTES) throw new AppError("VALIDATION_FAILED", "Files can be up to 8 MB.", { details: { field: "file" } });
    const version = form?.get("version");
    const result = await addProductFile(db, actor, (await params).id, { name: file.name, bytes: Buffer.from(await file.arrayBuffer()), version: typeof version === "string" ? version : "" }, await clientInfo());
    digitalProductsChanged();
    return privateJson(result, { status: 201 });
  },
  { maxBodyBytes: MAX_PRODUCT_FILE_BYTES + 64 * 1024 },
);
