'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';

interface NewProjectForm {
  title: string;
  description: string;
  deliverables: string;
  irbStatus: string;
  irbNumber: string;
  startDate: string;
  targetDate: string;
}

export default function NewProjectPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [specialty, setSpecialty] = useState<any>(null);
  const [form, setForm] = useState<NewProjectForm>({
    title: '',
    description: '',
    deliverables: '',
    irbStatus: 'pending',
    irbNumber: '',
    startDate: '',
    targetDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecialty = async () => {
      const { data, error } = await supabase
        .from('specialties')
        .select('*')
        .eq('slug', params.slug)
        .single();
      if (error) {
        setError(error.message);
      } else {
        setSpecialty(data);
      }
    };
    fetchSpecialty();
  }, [params.slug]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialty) return;
    setLoading(true);
    const { error: insertError } = await supabase.from('projects').insert({
      title: form.title,
      description: form.description,
      deliverables: form.deliverables
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      irb_status: form.irbStatus,
      irb_number: form.irbNumber || null,
      start_date: form.startDate || null,
      target_date: form.targetDate || null,
      specialty_id: specialty.id,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      router.push(`/specialty/${params.slug}`);
    }
  };

  if (!specialty) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add Project to {specialty.name}</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="w-full border rounded p-2"
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Deliverables (comma-separated)
          </label>
          <input
            type="text"
            name="deliverables"
            value={form.deliverables}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IRB Status</label>
          <select
            name="irbStatus"
            value={form.irbStatus}
            onChange={handleChange}
            className="w-full border rounded p-2"
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
            name="irbNumber"
            value={form.irbNumber}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={form.startDate}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Target Date</label>
          <input
            type="date"
            name="targetDate"
            value={form.targetDate}
            onChange={handleChange}
            className="w-full border rounded p-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Saving...' : 'Create Project'}
        </button>
      </form>
    </div>
  );
}
