import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Interview from "@/models/Interview";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/authorization";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid Interview ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const interview = await Interview.findById(id).populate(
      "userId",
      "name email tier",
    );
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(interview);
  } catch (error) {
    console.error("Error fetching interview:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
