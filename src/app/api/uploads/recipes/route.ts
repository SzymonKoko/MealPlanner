import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { requireActiveHouseholdEditor } from "@/server/require-household-member";
import {
  getRecipe,
  updateRecipe,
} from "@/modules/recipes/repository/recipe-repository";
import { isAppError } from "@/lib/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function hasValidImageSignature(buffer: Buffer, type: string) {
  if (type === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (type === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }
  return false;
}
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireActiveHouseholdEditor();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const recipeId = formData.get("recipeId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Brak pliku" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Nieobsługiwany format" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Plik za duży" }, { status: 400 });
    }

    if (recipeId && !(await getRecipe(householdId, recipeId))) {
      return NextResponse.json({ error: "Przepis nie istnieje" }, { status: 404 });
    }

    const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
    await mkdir(uploadDir, { recursive: true });

    const ext = EXTENSION_BY_TYPE[file.type];
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(buffer, file.type)) {
      return NextResponse.json({ error: "Plik nie jest poprawnym obrazem" }, { status: 400 });
    }
    await writeFile(filepath, buffer);

    const imageUrl = `/api/uploads/${filename}`;

    if (recipeId) {
      await updateRecipe(householdId, recipeId, { imageUrl });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Błąd uploadu" }, { status: 500 });
  }
}
