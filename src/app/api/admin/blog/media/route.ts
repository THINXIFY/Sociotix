import { z } from "zod";
import { clientInfo, requireStaff } from "@/server/auth";
import { fetchRemoteImage, MAX_IMAGE_BYTES, storeImage } from "@/server/blog/media";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { assertSameOrigin, privateJson, route } from "@/server/http";
import { enforce } from "@/server/auth/rate-limit";

const UrlBody = z.strictObject({ url: z.string().trim().min(1).max(2000) });

/**
 * Adds an image for a post: a multipart upload (field "file") or JSON { url } to import a public
 * image on the server. Either way the bytes must be a real JPEG, PNG or WebP of at most 5 MB.
 */
export const POST = route(
  async (request) => {
    assertSameOrigin(request);
    const actor = await requireStaff("settings:manage");
    const db = getDb();
    const client = await clientInfo();
    await enforce(db, "blog-media", actor.userId, { limit: 60, windowSeconds: 3600 }, "That's a lot of images in a short time. Please wait a few minutes.");
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) throw new AppError("VALIDATION_FAILED", "Choose an image to upload.", { details: { field: "image" } });
      if (file.size > MAX_IMAGE_BYTES) throw new AppError("VALIDATION_FAILED", "Images can be up to 5 MB.", { details: { field: "image" } });
      return privateJson({ image: await storeImage(db, actor, Buffer.from(await file.arrayBuffer()), { kind: "upload" }, client) }, { status: 201 });
    }
    const { url } = UrlBody.parse(await request.json().catch(() => ({})));
    const fetched = await fetchRemoteImage(url);
    return privateJson({ image: await storeImage(db, actor, fetched.bytes, { kind: "url", url: fetched.url }, client) }, { status: 201 });
  },
  { maxBodyBytes: MAX_IMAGE_BYTES + 64 * 1024 },
);
