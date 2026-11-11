import { requireCustomer } from "@/server/auth";
import { MAX_IMAGE_BYTES } from "@/server/blog/media";
import { storeMedia } from "@/server/content";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertSameOrigin, privateJson, route } from "@/server/http";

/**
 * Adds an image to the signed-in customer's media library (multipart field "file"). The bytes must be a
 * real JPEG, PNG or WebP of at most 5 MB; the file name and declared type are never trusted.
 */
export const POST = route(
  async (request) => {
    assertSameOrigin(request);
    const actor = await requireCustomer();
    if (!(request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) throw new AppError("VALIDATION_FAILED", "Choose an image to upload.", { details: { field: "file" } });
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_FAILED", "Choose an image to upload.", { details: { field: "file" } });
    if (file.size > MAX_IMAGE_BYTES) throw new AppError("VALIDATION_FAILED", "Images can be up to 5 MB.", { details: { field: "file" } });
    return privateJson({ media: await storeMedia(getDb(), actor.customerId, Buffer.from(await file.arrayBuffer()), file.name) }, { status: 201 });
  },
  { maxBodyBytes: MAX_IMAGE_BYTES + 64 * 1024 },
);
