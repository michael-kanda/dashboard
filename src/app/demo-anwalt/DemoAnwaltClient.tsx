'use client';

import dynamic from 'next/dynamic';

const DemoAnwaltDashboard = dynamic(() => import('./DemoAnwaltDashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen dashboard-gradient p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="dashboard-widget-surface h-28 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="dashboard-widget-surface h-32 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="dashboard-widget-surface h-96 rounded-lg animate-pulse" />
      </div>
    </div>
  ),
});

export default function DemoAnwaltClient() {
  return <DemoAnwaltDashboard />;
}
