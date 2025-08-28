import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// HomePage lists all active specialties and links to their boards. Data is
// fetched from Supabase on the server. If Supabase is not configured, an
// empty list will render.
export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  // Fetch all active specialties ordered by display_order.
  const { data: specialties } = await supabase
    .from('specialties')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  // For each specialty, compute the number of active projects and the number of
  // open slots within those projects. Because PostgREST does not support
  // complex joins via this client, we perform these computations
  // sequentially. This only runs on the server during SSR, so the
  // performance impact is minimal for the small number of specialties.
  let specialtiesWithCounts: any[] = [];
  if (specialties) {
    for (const spec of specialties) {
      // Count active projects in this specialty.
      const { count: projectCount } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('specialty_id', spec.id)
        .eq('status', 'active');
      // Fetch IDs of active projects to query slots.
      const { data: projectIds } = await supabase
        .from('projects')
        .select('id')
        .eq('specialty_id', spec.id)
        .eq('status', 'active');
      let openSlotCount = 0;
      if (projectIds && projectIds.length > 0) {
        const ids = projectIds.map((p: any) => p.id);
        const { count } = await supabase
          .from('project_slots')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open')
          .in('project_id', ids as string[]);
        openSlotCount = count || 0;
      }
      specialtiesWithCounts.push({
        ...spec,
        projectCount: projectCount || 0,
        openSlotCount,
      });
    }
  }

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Sarcoma Investigative Research Network
      </h1>
      {specialtiesWithCounts && specialtiesWithCounts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialtiesWithCounts.map((spec) => (
            <Link
              key={spec.id}
              href={`/specialty/${spec.slug}`}
              className="block border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-1">{spec.name}</h2>
              <p className="text-sm text-gray-600 mb-1">
                {spec.projectCount} active project{spec.projectCount === 1 ? '' : 's'}
              </p>
              <p className="text-sm text-gray-600">
                {spec.openSlotCount} open slot{spec.openSlotCount === 1 ? '' : 's'}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No specialties available.</p>
      )}
    </main>
  );
}