import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Interview from "@/models/Interview";
import { requireAdmin } from "@/lib/authorization";

export async function GET() {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const interviews = await Interview.find()
      .populate("userId", "name email tier")
      .sort({ createdAt: -1 })
      .limit(100); // Fetch latest 100 for performance

    return NextResponse.json(interviews);
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
