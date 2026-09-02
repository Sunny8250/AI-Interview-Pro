import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

export async function requireActiveUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) return null;

  await connectToDatabase();
  const user = await User.findOne({ email })
    .select("_id email role isBanned isVerified")
    .lean();

  if (!user || user.isBanned || !user.isVerified) return null;

  return { session, user };
}

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim();

  if (!email) return null;

  await connectToDatabase();
  const user = await User.findOne({ email })
    .select("_id email role isBanned isVerified")
    .lean();

  if (!user || user.role !== "ADMIN" || user.isBanned || !user.isVerified) {
    return null;
  }

  return { session, user };
}
