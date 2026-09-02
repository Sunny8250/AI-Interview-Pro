'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, BarChart3, ArrowLeft, Database } from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(path);
  };

  const navItemStyle = (active: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
    border: active ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
    fontWeight: active ? 600 : 500,
    transition: 'all 0.2s ease'
  });

  return (
    <aside className="glass-panel" style={{ width: '260px', padding: '24px', margin: '24px', display: 'flex', flexDirection: 'column', borderRadius: '16px' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-color)', marginBottom: '32px', paddingLeft: '8px' }}>
        Admin Panel
      </h2>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem' }}>
        <Link href="/admin" className="hover-lift" style={navItemStyle(isActive('/admin'))}>
          <LayoutDashboard size={18} color={isActive('/admin') ? 'var(--primary-color)' : 'currentColor'} />
          Dashboard Overview
        </Link>
        <Link href="/admin/users" className="hover-lift" style={navItemStyle(isActive('/admin/users'))}>
          <Users size={18} color={isActive('/admin/users') ? 'var(--primary-color)' : 'currentColor'} />
          User Management
        </Link>
        <Link href="/admin/interviews" className="hover-lift" style={navItemStyle(isActive('/admin/interviews'))}>
          <BarChart3 size={18} color={isActive('/admin/interviews') ? 'var(--primary-color)' : 'currentColor'} />
          Interview Analytics
        </Link>
        
        <div style={{ flex: 1 }}></div>
        
        <Link href="/dashboard" className="hover-lift" style={{ ...navItemStyle(false), marginTop: 'auto', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          Back to App
        </Link>
        <Link 
          href="/admin/questions"
          style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', textDecoration: 'none',
            background: pathname === '/admin/questions' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: pathname === '/admin/questions' ? '#818cf8' : 'var(--text-secondary)',
            fontWeight: pathname === '/admin/questions' ? 600 : 500,
            border: pathname === '/admin/questions' ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Database size={20} />
          Question Bank
        </Link>
      </nav>
    </aside>
  );
}
