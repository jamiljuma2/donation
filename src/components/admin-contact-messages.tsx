'use client';

import { useEffect, useState } from 'react';
import { formatEATDateTime } from '@/lib/types';

type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  created_at: string;
};

export default function AdminContactMessages() {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/contact', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load messages.');
      setItems(result.messages || []);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(message: Message, status: Message['status']) {
    setBusyId(message.id);
    setError('');
    try {
      const response = await fetch('/api/contact', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: message.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update message.');
      setItems((current) => current.map((item) => item.id === message.id ? { ...item, status } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update message.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="admin-panel" id="messages">
      <div className="admin-section-heading">
        <div><div className="eyebrow">Inbox</div><h2>Contact messages</h2></div>
        <button className="btn light" type="button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {loading ? <p className="muted">Loading messages…</p> : items.length ? (
        <div className="admin-message-list">
          {items.map((message) => (
            <article className="admin-message" key={message.id}>
              <div className="admin-message-top">
                <div><span className={`admin-status admin-status-${message.status}`}>{message.status}</span><h3>{message.subject}</h3></div>
                <time dateTime={message.created_at}>{formatEATDateTime(message.created_at)}</time>
              </div>
              <p className="admin-message-sender"><b>{message.name}</b> · <a href={`mailto:${message.email}`}>{message.email}</a></p>
              <p className="admin-message-body">{message.message}</p>
              <div className="admin-actions">
                <a className="btn light" href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`}>Reply by email</a>
                {message.status !== 'read' && message.status !== 'resolved' && <button className="btn light" disabled={busyId === message.id} onClick={() => void updateStatus(message, 'read')}>Mark read</button>}
                {message.status !== 'resolved' && <button className="btn" disabled={busyId === message.id} onClick={() => void updateStatus(message, 'resolved')}>Resolve</button>}
                {message.status === 'resolved' && <button className="btn light" disabled={busyId === message.id} onClick={() => void updateStatus(message, 'new')}>Reopen</button>}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted">No contact messages yet.</p>}
    </section>
  );
}
