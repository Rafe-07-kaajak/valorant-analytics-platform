import { NextResponse } from "next/server";
import { teams } from "@repo/prediction-engine";

export async function GET() {
  return NextResponse.json(teams, { status: 200 });
}
