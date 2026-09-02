import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '../components/AuthProvider';
import Navbar from '@/components/Navbar';
import PricingModal from '@/components/PricingModal';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/User';
import BannedScreen from '@/components/BannedScreen';

export const metadata: Metadata = {
  title: 'AI Interview & Quiz Pro',
  description: 'Advanced AI-powered platform for real-world interviews and quizzes.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  let isBanned = false;

  if (session?.user?.email) {
    try {
      await connectToDatabase();
      const dbUser = await User.findOne({ email: session.user.email });
      if (dbUser?.isBanned) {
        isBanned = true;
      }
    } catch (err) {
      console.error('Error checking ban status in layout', err);
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {isBanned ? (
            <BannedScreen />
          ) : (
            <>
              <Navbar />
              {children}
              <PricingModal />
            </>
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
