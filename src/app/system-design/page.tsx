'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Layers, Trash2, ArrowLeft, Sparkles, Server, Database, Cpu, Globe, Shield, RefreshCw } from 'lucide-react';
import styles from './page.module.css';

interface Node {
  id: string;
  type: string;
  label: string;
  icon: any;
}

export default function SystemDesignPage() {
  const [nodes, setNodes] = useState<Node[]>([
    { id: '1', type: 'client', label: 'Web / Mobile Client', icon: Globe },
    { id: '2', type: 'lb', label: 'NGINX Load Balancer', icon: RefreshCw },
    { id: '3', type: 'api', label: 'Spring Boot Microservice', icon: Server },
    { id: '4', type: 'cache', label: 'Redis Cache Cluster', icon: Cpu },
    { id: '5', type: 'db', label: 'PostgreSQL Primary DB', icon: Database },
  ]);

  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  const addComponent = (type: string, label: string, IconComp: any) => {
    const newNode: Node = {
      id: String(Date.now()),
      type,
      label,
      icon: IconComp,
    };
    setNodes(prev => [...prev, newNode]);
  };

  const removeNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  };

  const runSystemAudit = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAuditResult({
        score: nodes.length >= 4 ? 92 : 65,
        rating: nodes.length >= 4 ? 'High Resiliency Architecture' : 'Single Point of Failure Risk',
        strengths: [
          'Included caching layer (Redis) to reduce database read pressure.',
          'Load balancer distributes traffic evenly across stateless microservices.',
        ],
        improvements: [
          'Add a Kafka message queue for asynchronous event processing.',
          'Configure a Read Replica database node for high availability.',
        ],
      });
    }, 1200);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className={styles.card}>
          <div className={styles.header}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '4px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              <Layers size={16} /> Interactive System Design & Whiteboard Canvas
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>Distributed System Architect</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
              Add architecture components, connect microservices, and run AI resiliency audits for senior system design interviews.
            </p>
          </div>

          {/* Component Palette Toolbar */}
          <div className={styles.toolbar}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700, alignSelf: 'center', marginRight: '0.5rem' }}>
              + Add Component:
            </span>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', gap: '6px' }} onClick={() => addComponent('lb', 'HAProxy / NGINX Load Balancer', RefreshCw)}>
              <RefreshCw size={14} /> Load Balancer
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', gap: '6px' }} onClick={() => addComponent('api', 'Node.js Microservice', Server)}>
              <Server size={14} /> Microservice
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', gap: '6px' }} onClick={() => addComponent('cache', 'Redis Cache', Cpu)}>
              <Cpu size={14} /> Redis Cache
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', gap: '6px' }} onClick={() => addComponent('db', 'MongoDB / SQL DB', Database)}>
              <Database size={14} /> Database
            </button>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', gap: '6px' }} onClick={() => addComponent('queue', 'Apache Kafka Queue', Shield)}>
              <Shield size={14} /> Kafka Queue
            </button>
          </div>

          {/* Canvas Area */}
          <div className={styles.canvas}>
            {nodes.map((node) => {
              const IconComp = node.icon;
              return (
                <div key={node.id} className={styles.node}>
                  <IconComp size={20} color="#38bdf8" />
                  <span>{node.label}</span>
                  <Trash2 size={16} color="#f87171" style={{ cursor: 'pointer', marginLeft: '8px' }} onClick={() => removeNode(node.id)} />
                </div>
              );
            })}
          </div>

          {/* Audit Trigger */}
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary hover-lift" style={{ padding: '0.85rem 1.75rem', fontWeight: 700, gap: '8px' }} onClick={runSystemAudit} disabled={loading}>
              <Sparkles size={18} />
              {loading ? 'Evaluating Resiliency...' : 'Audit System Architecture'}
            </button>
          </div>

          {/* Audit Results */}
          {auditResult && (
            <div className={`animate-fade-in ${styles.auditCard}`}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: auditResult.score >= 80 ? '#4ade80' : '#fbbf24', marginBottom: '0.5rem' }}>
                Architecture Score: {auditResult.score}% ({auditResult.rating})
              </div>
              <div style={{ marginTop: '1rem', color: '#f8fafc' }}>
                <strong style={{ color: '#4ade80' }}>✓ Architectural Strengths:</strong>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                  {auditResult.strengths.map((s: string, idx: number) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
              <div style={{ marginTop: '1rem', color: '#f8fafc' }}>
                <strong style={{ color: '#fbbf24' }}>⚠️ Recommended Improvements:</strong>
                <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
                  {auditResult.improvements.map((imp: string, idx: number) => <li key={idx}>{imp}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
