'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, FileText, Check, X, Database, Trash2, Search, Loader2, ChevronDown } from 'lucide-react';

export default function QuestionBank() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [mounted, setMounted] = useState(false);
  
  // Upload State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [uploadCategory, setUploadCategory] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/questions');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf' || selectedFile.type === 'text/plain') {
        setFile(selectedFile);
      } else {
        alert('Please select a PDF or TXT file.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory || 'General');

    try {
      const res = await fetch('/api/admin/questions/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPreviewQuestions(data.questions || []);
      } else {
        alert(data.error || 'Failed to process document');
      }
    } catch (err) {
      alert('An error occurred during upload.');
    }
    setUploading(false);
  };

  const handleSaveToBank = async () => {
    setUploading(true);
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questions: previewQuestions,
          sourceDocument: file?.name 
        })
      });
      if (res.ok) {
        setUploadModalOpen(false);
        setPreviewQuestions([]);
        setFile(null);
        fetchQuestions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save questions');
      }
    } catch (err) {
      alert('An error occurred while saving.');
    }
    setUploading(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchQuestions();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || q.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = Array.from(new Set(questions.map(q => q.category || 'General')));

  return (
    <div style={{ padding: '2rem 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={32} color="var(--primary-color)" /> Question Bank
        </h1>
        <button 
          onClick={() => setUploadModalOpen(true)}
          className="btn btn-primary hover-lift"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
        >
          <Upload size={18} />
          Upload Document
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', borderRadius: '24px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search questions or answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '10px 16px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="All">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading question bank...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '16px', fontWeight: 600, width: '40%' }}>Question</th>
                  <th style={{ padding: '16px', fontWeight: 600, width: '40%' }}>Answer</th>
                  <th style={{ padding: '16px', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No questions found.</td>
                  </tr>
                ) : filteredQuestions.map((q) => (
                  <tr key={q._id} className="hover-lift" style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '16px' }}>
                      <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>
                        {q.category}
                      </span>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      {q.question}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                      <div style={{ maxHeight: '80px', overflowY: 'auto' }}>{q.answer}</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <button 
                        onClick={() => deleteQuestion(q._id)}
                        className="btn hover-lift"
                        title="Delete Question"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {mounted && uploadModalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '2rem', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={24} color="var(--primary-color)" /> Document Processor
              </h2>
              <button onClick={() => setUploadModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {previewQuestions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Category (Select or type a new one)</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      value={uploadCategory}
                      onChange={(e) => {
                        setUploadCategory(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                      placeholder="e.g. React, Python, Behavioral..."
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }}>
                      <ChevronDown size={18} />
                    </div>
                  </div>
                  {dropdownOpen && uniqueCategories.filter(c => c.toLowerCase().includes(uploadCategory.toLowerCase())).length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'var(--card-bg, #1e293b)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden', zIndex: 50, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                      {uniqueCategories.filter(c => c.toLowerCase().includes(uploadCategory.toLowerCase())).map((cat, i, arr) => (
                        <div 
                          key={i} 
                          onClick={() => {
                            setUploadCategory(cat);
                            setDropdownOpen(false);
                          }}
                          style={{ padding: '12px 16px', cursor: 'pointer', color: 'var(--text-primary)', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', fontSize: '0.95rem' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--glass-border)', borderRadius: '16px', padding: '3rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}
                >
                  <Upload size={48} color="var(--text-secondary)" style={{ margin: '0 auto 1rem' }} />
                  {file ? (
                    <p style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Selected: {file.name}</p>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>Click to upload PDF or TXT file</p>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.txt" 
                    style={{ display: 'none' }}
                  />
                </div>

                <button 
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {uploading ? (
                    <><Loader2 size={18} className="animate-spin" /> Processing via AI...</>
                  ) : (
                    <><Check size={18} /> Extract Questions</>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: '12px', color: 'var(--success)' }}>
                  Successfully extracted {previewQuestions.length} questions! Review them below before saving to the Question Bank.
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                  {previewQuestions.map((q, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px' }}>
                      <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '0.95rem' }}>Q: {q.question}</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>A: {q.answer}</p>
                      <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--primary-color)' }}>Category: {q.category}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button 
                    onClick={() => { setPreviewQuestions([]); setFile(null); }}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '12px', borderRadius: '12px' }}
                    disabled={uploading}
                  >
                    Discard
                  </button>
                  <button 
                    onClick={handleSaveToBank}
                    className="btn btn-primary"
                    style={{ flex: 2, padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                    Save to Bank
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
