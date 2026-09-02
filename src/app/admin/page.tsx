'use client';
import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, proUsers: 0, freeUsers: 0, interviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, interviewsRes] = await Promise.all([
          fetch('/api/admin/users?limit=200'),
          fetch('/api/admin/interviews')
        ]);
        
        if (usersRes.ok && interviewsRes.ok) {
          const usersPayload = await usersRes.json();
          const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.users || [];
          const interviews = await interviewsRes.json();
          const pro = users.filter((u: any) => u.tier === 'pro').length;
          const free = users.filter((u: any) => u.tier !== 'pro').length;
          
          setStats({ 
            users: users.length, 
            proUsers: pro,
            freeUsers: free,
            interviews: interviews.length 
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Overview</h1>
      
      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading metrics...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          <div className="glass-panel hover-lift" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Users size={20} color="var(--primary-color)" />
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</h3>
            </div>
            <p className="gradient-text" style={{ fontSize: '2.5rem', fontWeight: 800 }}>{stats.users}</p>
          </div>
          
          <div className="glass-panel hover-lift" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <UserCheck size={20} color="var(--warning)" />
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pro Users</h3>
            </div>
            <p style={{ color: 'var(--warning)', fontSize: '2.5rem', fontWeight: 800 }}>{stats.proUsers}</p>
          </div>

          <div className="glass-panel hover-lift" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <UserX size={20} color="var(--text-secondary)" />
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Free Users</h3>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: '2.5rem', fontWeight: 800 }}>{stats.freeUsers}</p>
          </div>
          
          <div className="glass-panel hover-lift" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <BarChart3 size={20} color="var(--success)" />
              <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interviews</h3>
            </div>
            <p style={{ color: 'var(--success)', fontSize: '2.5rem', fontWeight: 800 }}>{stats.interviews}</p>
          </div>
        </div>
      )}
    </div>
  );
}
