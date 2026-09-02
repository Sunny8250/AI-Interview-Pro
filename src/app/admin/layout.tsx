import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import AdminSidebar from './AdminSidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user as any).role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 70px)' }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: '24px 24px 24px 0' }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '32px', minHeight: '100%', borderRadius: '16px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
