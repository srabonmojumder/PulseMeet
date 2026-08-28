import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 });
  }

  // If Vercel Blob store token is configured, upload to Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(file.name, file, { access: "public" });
      return NextResponse.json({
        url: blob.url,
        name: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
    } catch (err) {
      console.error("Vercel Blob upload failed, falling back to data URL:", err);
    }
  }

  // Seamless Base64 fallback (works for voice notes, photos, documents)
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    return NextResponse.json({
      url: dataUrl,
      name: file.name,
      contentType: mimeType,
      size: file.size,
    });
  } catch (err) {
    console.error("File processing error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
