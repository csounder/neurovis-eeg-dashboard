import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { resolveV12CsdPath, v12CsdDownloadFilename } from "@/lib/v12CsdPath";

export async function GET() {
  const csdPath = resolveV12CsdPath();
  const filename = v12CsdDownloadFilename(csdPath);
  try {
    const csd = await readFile(csdPath, "utf8");
    return new NextResponse(csd, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to read V12 CSD",
        path: csdPath,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
