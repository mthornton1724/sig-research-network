/*
 * Page for editing an existing project. This client-side component
 * fetches the project details by ID and prepopulates the form.
 * On submission, it updates the project record in Supabase.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';

interface EditProjectPageProps {
  params: {
    id: string;
  };
}

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [irbStatus, setIrbStatus] = useState('pending');
  const [irbNumber, setIrbNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing project details for editing
  useEffect(() => {
    async function fetchProject() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .single();
      if (!error && data) {
        setTitle(data.title || '');
        setDescription(data.description || '');
        setDeliverables(
          data.deliverables && Array.isArray(data.deliverables)
            ? data.deliverables.join(', ')
            : ''
        );
        setIrbStatus(data.irb_status || 'pending');
        setIrbNumber(data.irb_number || '');
        setStartDate(data.start_date || '');
        setTargetDate(data.target_date || '');
      }
      setLoading(false);
    }
    fetchProject();
  }, [params.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const deliverablesArray = deliverables
      ? deliverables.split(',').map((d) => d.trim()).filter(Boolean)
      : [];
    const { error } = await supabase
      .from('projects')
      .update({
        title,
        description,
        deliverables: deliverablesArray,
        irb_status: irbStatus,
        irb_number: irbNumber || null,
        start_date: startDate || null,
        target_date: targetDate || null,
      })
      .eq('id', params.id);
    if (error) {
      alert('Error updating project: ' + error.message);
      setSubmitting(false);
    } else {
      // Navigate back to the project page after successful update
      router.push(`/project/${params.id}`);
    }
  }

  if (loading) {
    return <p className="p-8">Loading...</p>;
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Project</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="border rounded w-full p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="border rounded w-full p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Deliverables (comma separated)
          </label>
          <input
            type="text"
            value={deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
            className="border rounded w-full p-2"
            placeholder="abstract, manuscript, poster"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IRB Status</label>
          <select
            value={irbStatus}
            onChange={(e) => setIrbStatus(e.target.value)}
            className="border rounded w-full p-2"
          >
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="exempt">Exempt</option>
            <option value="not_needed">Not Needed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IRB Number</label>
          <input
            type="text"
            value={irbNumber}
            onChange={(e) => setIrbNumber(e.target.value)}
            className="border rounded w-full p-2"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded w-full p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="border rounded w-full p-2"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </main>
  );
}
