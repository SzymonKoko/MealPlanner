import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const safeName = path.basename(filename);

  if (!/^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$/.test(safeName)) {
    return NextResponse.json({ error: "Nieprawidłowa nazwa pliku" }, { status: 400 });
  }

  try {
    const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
    const filepath = path.join(uploadDir, safeName);
    const buffer = await readFile(filepath);

    const ext = safeName.split(".").pop();
    const contentType =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

    return new NextResponse(buffer, {
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000" },
    });
  } catch {
    return NextResponse.json({ error: "Nie znaleziono" }, { status: 404 });
  }
}
