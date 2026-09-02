'use client';
import { useEffect, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stagedEdits, setStagedEdits] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users?limit=200');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveEdits = async (id: string) => {
    const updates = stagedEdits[id];
    if (!updates) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setStagedEdits(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to update user', err);
    }
  };

  const cancelEdits = (id: string) => {
    setStagedEdits(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const deleteUser = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to completely delete the user ${email}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  const handleStageEdit = (id: string, field: string, value: any) => {
    setStagedEdits(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>User Management</h1>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Search by email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', padding: '10px 16px 10px 40px', borderRadius: '99px',
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
            }}
          />
        </div>
      </div>
      
      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading users...</div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Tier</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Verified</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>AI Credits</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Joined</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => {
                const isEdited = !!stagedEdits[u._id];
                const currentRole = stagedEdits[u._id]?.role ?? u.role;
                const currentTier = stagedEdits[u._id]?.tier ?? u.tier;
                const currentCredits = stagedEdits[u._id]?.aiCredits ?? u.aiCredits;

                return (
                <tr key={u._id} className="hover-lift" style={{ borderBottom: i === filteredUsers.length - 1 ? 'none' : '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 500 }}>{u.email}</td>
                  <td style={{ padding: '16px' }}>
                    <select
                      style={{ 
                        background: currentRole === 'ADMIN' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                        border: currentRole === 'ADMIN' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)', 
                        color: currentRole === 'ADMIN' ? 'var(--warning)' : 'var(--primary-color)', 
                        padding: '6px 12px', borderRadius: '99px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none'
                      }}
                      value={currentRole}
                      onChange={(e) => handleStageEdit(u._id, 'role', e.target.value)}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <select
                      style={{ 
                        background: currentTier === 'pro' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)', 
                        border: currentTier === 'pro' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--glass-border)', 
                        color: currentTier === 'pro' ? 'var(--success)' : 'var(--text-secondary)', 
                        padding: '6px 12px', borderRadius: '99px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none'
                      }}
                      value={currentTier}
                      onChange={(e) => handleStageEdit(u._id, 'tier', e.target.value)}
                    >
                      <option value="free">Normal</option>
                      <option value="pro">Pro</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <select
                      style={{ 
                        background: stagedEdits[u._id]?.isBanned ?? u.isBanned ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', 
                        border: stagedEdits[u._id]?.isBanned ?? u.isBanned ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)', 
                        color: stagedEdits[u._id]?.isBanned ?? u.isBanned ? 'var(--error)' : 'var(--success)', 
                        padding: '6px 12px', borderRadius: '99px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none'
                      }}
                      value={(stagedEdits[u._id]?.isBanned ?? u.isBanned) ? 'true' : 'false'}
                      onChange={(e) => handleStageEdit(u._id, 'isBanned', e.target.value === 'true')}
                    >
                      <option value="false">Active</option>
                      <option value="true">Banned</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <select
                      style={{ 
                        background: stagedEdits[u._id]?.isVerified ?? u.isVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                        border: stagedEdits[u._id]?.isVerified ?? u.isVerified ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', 
                        color: stagedEdits[u._id]?.isVerified ?? u.isVerified ? 'var(--success)' : 'var(--error)', 
                        padding: '6px 12px', borderRadius: '99px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none'
                      }}
                      value={(stagedEdits[u._id]?.isVerified ?? u.isVerified) ? 'true' : 'false'}
                      onChange={(e) => handleStageEdit(u._id, 'isVerified', e.target.value === 'true')}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <input 
                      type="number"
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', width: '80px', textAlign: 'center', fontWeight: 600 }}
                      value={currentCredits}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          handleStageEdit(u._id, 'aiCredits', val);
                        }
                      }}
                    />
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isEdited ? (
                        <>
                          <button 
                            onClick={() => saveEdits(u._id)}
                            className="btn hover-lift"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' }}
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => cancelEdits(u._id)}
                            className="btn hover-lift"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleStageEdit(u._id, 'aiCredits', currentCredits + 10)}
                          className="btn hover-lift"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary-color)' }}
                        >
                          +10 Credits
                        </button>
                      )}
                      <button 
                        onClick={() => deleteUser(u._id, u.email)}
                        className="btn hover-lift"
                        title="Delete User"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No users found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
