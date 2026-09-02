import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const requestedUpdates = await request.json();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    if (
      !requestedUpdates ||
      typeof requestedUpdates !== "object" ||
      Array.isArray(requestedUpdates)
    ) {
      return NextResponse.json(
        { error: "Invalid update payload" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (
      requestedUpdates.role !== undefined &&
      ["USER", "ADMIN"].includes(requestedUpdates.role)
    )
      updates.role = requestedUpdates.role;
    if (
      requestedUpdates.tier !== undefined &&
      ["free", "pro"].includes(requestedUpdates.tier)
    )
      updates.tier = requestedUpdates.tier;
    if (
      requestedUpdates.isVerified !== undefined &&
      typeof requestedUpdates.isVerified === "boolean"
    )
      updates.isVerified = requestedUpdates.isVerified;
    if (
      requestedUpdates.isBanned !== undefined &&
      typeof requestedUpdates.isBanned === "boolean"
    )
      updates.isBanned = requestedUpdates.isBanned;
    if (
      requestedUpdates.aiCredits !== undefined &&
      typeof requestedUpdates.aiCredits === "number" &&
      Number.isFinite(requestedUpdates.aiCredits) &&
      requestedUpdates.aiCredits >= 0 &&
      requestedUpdates.aiCredits <= 1_000_000
    ) {
      updates.aiCredits = requestedUpdates.aiCredits;
    }
    if (
      Object.keys(updates).length === 0 ||
      Object.keys(updates).length !== Object.keys(requestedUpdates).length
    ) {
      return NextResponse.json(
        {
          error:
            "One or more requested fields are invalid or cannot be changed",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // The user has a User record and a UserData record that need to stay in sync.
    // Update the main User model first
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Now sync those specific updates to the `userdatas` collection to ensure
    // things like aiCredits and tier stay perfectly in sync.
    const db = mongoose.connection.db;
    if (db) {
      const syncUpdates: any = {};
      if (updates.tier !== undefined) syncUpdates.tier = updates.tier;
      if (updates.role !== undefined) syncUpdates.role = updates.role;
      if (updates.aiCredits !== undefined)
        syncUpdates.aiCredits = updates.aiCredits;
      if (updates.isVerified !== undefined)
        syncUpdates.isVerified = updates.isVerified;
      if (updates.isBanned !== undefined)
        syncUpdates.isBanned = updates.isBanned;

      if (Object.keys(syncUpdates).length > 0) {
        await db
          .collection("userdatas")
          .updateOne({ email: updatedUser.email }, { $set: syncUpdates });
      }
    }

    return NextResponse.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      tier: updatedUser.tier,
      aiCredits: updatedUser.aiCredits,
      isVerified: updatedUser.isVerified,
      isBanned: updatedUser.isBanned,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete from users collection
    await User.findByIdAndDelete(id);

    // Delete from userdatas collection to ensure no orphaned data
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("userdatas").deleteOne({ email: user.email });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
