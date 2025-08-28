import { createSupabaseServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

// Renders a single project's details, including its slots, milestones and resources.
export default async function ProjectPage({ params }: ProjectPageProps) {
  const supabase = createSupabaseServerClient();

  // Fetch the project by ID. If not found, show a 404 page.
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();
  if (projectError || !project) {
    notFound();
  }

  // Fetch related entities: slots, milestones and resources.
  const { data: slots } = await supabase
    .from('project_slots')
    .select('*')
    .eq('project_id', params.id);
  const { data: milestones } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', params.id)
    .order('order_index', { ascending: true });
  const { data: resources } = await supabase
    .from('project_resources')
    .select('*')
    .eq('project_id', params.id);

  // Fetch assignments for slots to determine assignee names/status.
  let assignmentsMap: Record<string, any> = {};
  if (slots && slots.length > 0) {
    const slotIds = slots.map((s: any) => s.id);
    const { data: assignments } = await supabase
      .from('slot_assignments')
      .select('*')
      .in('slot_id', slotIds as string[]);
    // Index by slot_id for quick lookup.
    if (assignments) {
      for (const a of assignments) {
        assignmentsMap[a.slot_id] = a;
      }
    }
  }

  return (
    <main className="p-8">
      <Link href=".." className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
      <h1 className="text-3xl font-bold mb-4 mt-2">{project.title}</h1>
      {project.description && (
        <p className="mb-6 text-gray-700 max-w-prose">
          {project.description}
        </p>
      )}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Deliverables</h2>
        {project.deliverables && project.deliverables.length > 0 ? (
          <ul className="list-disc list-inside text-gray-600">
            {project.deliverables.map((d: string) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No deliverables specified.</p>
        )}
      </div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Slots</h2>
        {slots && slots.length > 0 ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Role</th>
                <th className="text-left py-2 px-2">Estimated Hours</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id} className="border-b">
                  <td className="py-2 px-2">{slot.role_name}</td>
                  <td className="py-2 px-2">{slot.est_hours}</td>
                  <td className="py-2 px-2 capitalize">{slot.status}</td>
                <td className="py-2 px-2">
                  {assignmentsMap[slot.id]
                    ? // If assigned, display a placeholder text. You could fetch the student's name by joining student_profiles & users tables.
                      'Assigned'
                    : 'Open'}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No slots defined.</p>
        )}
      </div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2">Milestones</h2>
        {milestones && milestones.length > 0 ? (
          <ol className="list-decimal list-inside text-gray-700">
            {milestones.map((m) => (
              <li key={m.id} className="mb-1">
                <span className="font-medium">{m.name}</span> — {m.status}
                {m.due_date && (
                  <span className="text-gray-500 ml-1">
                    (due {new Date(m.due_date).toLocaleDateString()})
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-gray-500">No milestones set.</p>
        )}
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-2">Resources</h2>
        {resources && resources.length > 0 ? (
          <ul className="list-none pl-0 text-gray-700">
            {resources.map((r) => (
              <li key={r.id} className="mb-1">
                <a
                  href={r.url}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {r.label || r.type}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No resources attached.</p>
        )}
      </div>
    </main>
  );
}