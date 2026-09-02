import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import QuestionBank from "@/models/QuestionBank";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/authorization";

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Support filtering by category
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const query = category && category !== "All" ? { category } : {};

    const questions = await QuestionBank.find(query).sort({ createdAt: -1 });

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching question bank:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { questions, sourceDocument } = await request.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "No questions provided" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const existingQuestions = await QuestionBank.find({}, { question: 1 });
    const existingTexts = new Set(
      existingQuestions.map((q) => q.question.toLowerCase().trim()),
    );

    const formattedQuestions = questions
      .filter(
        (q: any) => !existingTexts.has((q.question || "").toLowerCase().trim()),
      )
      .map((q: any) => ({
        question: q.question,
        answer: q.answer,
        category: q.category || "General",
        difficulty: q.difficulty || "Mid",
        sourceDocument: sourceDocument || "Manual Entry",
      }));

    if (formattedQuestions.length === 0) {
      return NextResponse.json({
        message: "All questions already exist in the database.",
        result: [],
      });
    }

    const result = await QuestionBank.insertMany(formattedQuestions);

    return NextResponse.json({
      message: `Successfully added ${result.length} questions.`,
      result,
    });
  } catch (error) {
    console.error("Error saving questions to bank:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid question ID" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const result = await QuestionBank.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
