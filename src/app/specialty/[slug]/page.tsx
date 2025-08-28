import { createSupabaseServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface SpecialtyPageProps {
  params: {
    slug: string;
  };
}

export default async function SpecialtyPage({ params }: SpecialtyPageProps) {
  const supabase = createSupabaseServerClient();

  // Fetch the specialty by slug. If not found, return 404.
  const { data: specialty, error: specialtyError } = await supabase
    .from('specialties')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (specialtyError || !specialty) {
    notFound();
  }

  // Fetch active projects for this specialty.
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('specialty_id', specialty.id)
    .eq('status', 'active');

  // Enrich each project with slot counts (open vs total) and progress percentage.
  let projectsWithStats: any[] = [];
  if (projects && projects.length > 0) {
    for (const proj of projects) {
      // Count total slots on this project.
      const { count: totalSlots } = await supabase
        .from('project_slots')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', proj.id);
      // Count open slots on this project.
      const { count: openSlots } = await supabase
        .from('project_slots')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', proj.id)
        .eq('status', 'open');
      projectsWithStats.push({
        ...proj,
        totalSlots: totalSlots || 0,
        openSlots: openSlots || 0,
      });
    }
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        {specialty.name} Projects
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projectsWithStats && projectsWithStats.length > 0 ? (
          projectsWithStats.map((project) => (
            <div
              key={project.id}
              className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-1">
                {project.title}
              </h2>
              {project.description ? (
                <p className="mb-2 text-sm text-gray-700">
                  {project.description.slice(0, 120)}
                  {project.description.length > 120 ? '...' : ''}
                </p>
              ) : null}
              {/* Deliverables */}
              {project.deliverables && project.deliverables.length > 0 ? (
                <p className="text-xs text-gray-500 mb-1">
                  Deliverables: {project.deliverables.join(', ')}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-1">
                  No deliverables listed
                </p>
              )}
              {/* Slot stats */}
              <p className="text-xs text-gray-500 mb-1">
                {project.openSlots} open slot{project.openSlots === 1 ? '' : 's'} / {project.totalSlots}
              </p>
              {/* Progress (if progressPct present) */}
              {project.progress_pct !== undefined ? (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${Number(project.progress_pct) || 0}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-3">
                <Link
                  href={`/project/${project.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View project
                </Link>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600">No active projects found.</p>
        )}
      </div>
    </main>
  );
}