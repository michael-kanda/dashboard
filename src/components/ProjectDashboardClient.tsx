'use client';

import dynamic from 'next/dynamic';
import type { ProjectDashboardProps } from '@/components/dashboard/types';
import { PageSpinner } from '@/components/ui/Spinner';

function DashboardClientLoading() {
  return <PageSpinner label="Dashboard wird geladen" className="min-h-[70vh]" />;
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
