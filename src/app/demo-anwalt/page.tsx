import type { Metadata } from 'next';
import DemoAnwaltClient from './DemoAnwaltClient';

export const metadata: Metadata = {
  title: 'DataPeak Demo Dashboard fuer Rechtsanwaltskanzleien',
  description: 'Oeffentliche Live-Demo eines DataPeak Projekt-Dashboards mit fiktiven Kanzlei-Daten.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function DemoAnwaltPage() {
  return <DemoAnwaltClient />;
}
