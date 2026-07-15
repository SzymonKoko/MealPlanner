import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { requireActiveHousehold } from "@/server/require-household-member";
import { updateRecipe } from "@/modules/recipes/repository/recipe-repository";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireActiveHousehold();
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

    const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const imageUrl = `/api/uploads/${filename}`;

    if (recipeId) {
      await updateRecipe(householdId, recipeId, { imageUrl });
    }

    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ error: "Błąd uploadu" }, { status: 500 });
  }
}
