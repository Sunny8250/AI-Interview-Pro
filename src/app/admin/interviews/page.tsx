'use client';
import { useEffect, useState } from 'react';
import { Search, Bot, User } from 'lucide-react';

export default function AdminInterviews() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInterview, setSelectedInterview] = useState<any>(null);

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      const res = await fetch('/api/admin/interviews');
      if (res.ok) {
        setInterviews(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredInterviews = interviews.filter(i => 
    i.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Interview Analytics</h1>
        {!selectedInterview && (
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by candidate email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 16px 10px 40px', borderRadius: '99px',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
              }}
            />
          </div>
        )}
      </div>
      
      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading interviews...</div>
      ) : selectedInterview ? (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
          <button 
            onClick={() => setSelectedInterview(null)}
            style={{ fontSize: '0.85rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', fontWeight: 600 }}
          >
            &larr; Back to list
          </button>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Candidate</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInterview.userId?.email || 'Unknown'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Role</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInterview.role} ({selectedInterview.experience})</p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Score</p>
              <p style={{ fontWeight: 800, color: selectedInterview.feedback?.overallScore >= 70 ? 'var(--success)' : 'var(--error)' }}>
                {selectedInterview.feedback?.overallScore || 'N/A'}/100
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fallback Used?</p>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInterview.fallbackUsed ? 'Yes (AI Failed)' : 'No'}</p>
            </div>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Transcript</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px', background: 'var(--bg-color)', borderRadius: '16px' }}>
            {selectedInterview.messages?.map((msg: any, i: number) => {
              const isAi = msg.role === 'ai';
              return (
                <div key={i} style={{ 
                  alignSelf: isAi ? 'flex-start' : 'flex-end',
                  maxWidth: '80%',
                  padding: '16px 20px', 
                  borderRadius: isAi ? '2px 16px 16px 16px' : '16px 2px 16px 16px', 
                  background: isAi ? 'rgba(255, 255, 255, 0.05)' : 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                  border: isAi ? '1px solid var(--glass-border)' : 'none',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: isAi ? 'var(--text-secondary)' : 'rgba(255,255,255,0.8)' }}>
                    {isAi ? <Bot size={14} /> : <User size={14} />}
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      {isAi ? 'Interviewer' : 'Candidate'}
                    </p>
                  </div>
                  <p style={{ color: isAi ? 'var(--text-primary)' : '#fff', whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem' }}>
                    {msg.content}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto', borderRadius: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px', fontWeight: 600 }}>User</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Role & Experience</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Score</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInterviews.map((i, idx) => (
                <tr key={i._id} className="hover-lift" style={{ borderBottom: idx === filteredInterviews.length - 1 ? 'none' : '1px solid var(--glass-border)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600 }}>{i.userId?.email || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', color: i.userId?.tier === 'pro' ? 'var(--success)' : 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 800, marginTop: '4px' }}>
                      {i.userId?.tier || 'free'} Tier
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 500 }}>{i.role}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{i.experience}</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: i.feedback?.overallScore >= 70 ? 'var(--success)' : i.feedback?.overallScore ? 'var(--warning)' : 'var(--text-secondary)' }}>
                      {i.feedback?.overallScore || 'N/A'}
                    </span>
                    {i.fallbackUsed && <span style={{ marginLeft: '8px', fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)', padding: '4px 6px', borderRadius: '4px', fontWeight: 600 }}>Fallback</span>}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(i.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button 
                      onClick={() => setSelectedInterview(i)}
                      className="btn hover-lift"
                      style={{ padding: '8px 16px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                    >
                      View Transcript
                    </button>
                  </td>
                </tr>
              ))}
              {filteredInterviews.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No interviews found matching "{searchTerm}"
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
