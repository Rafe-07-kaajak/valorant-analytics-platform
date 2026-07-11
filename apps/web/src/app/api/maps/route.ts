import { NextResponse } from "next/server";
import { maps } from "@repo/prediction-engine";

export async function GET() {
  return NextResponse.json(maps, { status: 200 });
}
