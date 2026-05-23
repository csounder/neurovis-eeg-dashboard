import { NextResponse } from "next/server";
import {
  ReplicateClientError,
  cancelReplicatePrediction,
  createReplicatePrediction,
  getReplicatePrediction,
  readReplicateTokenFromRequest,
} from "@/lib/replicateServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  model?: string;
  input?: Record<string, unknown>;
}

/**
 * POST `/api/replicate/predictions`
 *   body: `{ model: "owner/name", input: { ... } }`  → kicks off prediction, returns Replicate JSON.
 *
 * GET `/api/replicate/predictions?id=<predictionId>`  → polls a single prediction.
 *
 * DELETE `/api/replicate/predictions?id=<predictionId>` → cancels.
 *
 * Auth: requires `X-Replicate-Token` on every request.
 */
export async function POST(request: Request) {
  const token = readReplicateTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Replicate token (header X-Replicate-Token)." },
      { status: 401 },
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch (error) {
    return NextResponse.json(
      { error: "Body must be JSON.", detail: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }

  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(
      { error: "`model` is required (e.g. \"google/gemini-3.5-flash\")." },
      { status: 400 },
    );
  }
  if (!body.input || typeof body.input !== "object") {
    return NextResponse.json(
      { error: "`input` must be an object matching the Replicate model schema." },
      { status: 400 },
    );
  }

  try {
    const prediction = await createReplicatePrediction({
      token,
      model,
      input: body.input,
    });
    return NextResponse.json(prediction);
  } catch (error) {
    if (error instanceof ReplicateClientError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Replicate prediction creation failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  const token = readReplicateTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Replicate token (header X-Replicate-Token)." },
      { status: 401 },
    );
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Query param `id` is required." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await getReplicatePrediction({ token, id }));
  } catch (error) {
    if (error instanceof ReplicateClientError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Replicate prediction fetch failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const token = readReplicateTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Replicate token (header X-Replicate-Token)." },
      { status: 401 },
    );
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Query param `id` is required." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await cancelReplicatePrediction({ token, id }));
  } catch (error) {
    if (error instanceof ReplicateClientError) {
      return NextResponse.json(
        { error: error.message, detail: error.detail },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Replicate prediction cancel failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
