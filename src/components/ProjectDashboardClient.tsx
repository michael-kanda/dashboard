'use client';

import dynamic from 'next/dynamic';
import type { ProjectDashboardProps } from '@/components/ProjectDashboard';

function DashboardClientLoading() {
  return (
    <div className="min-h-screen dashboard-gradient px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <div className="dashboard-widget-surface rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-7 w-56 rounded bg-surface-tertiary" />
            <div className="h-4 w-80 max-w-full rounded bg-surface-tertiary" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dashboard-widget-surface h-40 rounded-lg p-5">
              <div className="h-full animate-pulse rounded bg-surface-tertiary" />
            </div>
          ))}
        </div>
        <div className="dashboard-widget-surface h-[360px] rounded-lg p-6">
          <div className="h-full animate-pulse rounded bg-surface-tertiary" />
        </div>
      </div>
    </div>
  );
}

const ProjectDashboard = dynamic<ProjectDashboardProps>(
  () => import('@/components/ProjectDashboard').then((mod) => mod.default),
  {
    ssr: false,
    loading: DashboardClientLoading,
  }
);

export default function ProjectDashboardClient(props: ProjectDashboardProps) {
  return <ProjectDashboard {...props} />;
}
