import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session.user.email;
    await connectToDatabase();

    const db = mongoose.connection.db;
    if (!db)
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 },
      );

    const transaction = mongoose.connection.getClient().startSession();
    try {
      await transaction.withTransaction(async () => {
        const user = await db
          .collection("users")
          .findOne({ email }, { session: transaction });
        if (!user) return;

        await Promise.all([
          db
            .collection("users")
            .deleteOne({ _id: user._id }, { session: transaction }),
          db
            .collection("userdatas")
            .deleteOne({ email }, { session: transaction }),
          db
            .collection("interviews")
            .deleteMany({ userId: user._id }, { session: transaction }),
          db
            .collection("public_reports")
            .deleteMany({ ownerId: user._id }, { session: transaction }),
        ]);
      });
    } finally {
      await transaction.endSession();
    }

    return NextResponse.json({ message: "User data successfully deleted" });
  } catch (error) {
    console.error("Error deleting user data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
