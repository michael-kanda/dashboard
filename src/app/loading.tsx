import { PageSpinner } from '@/components/ui/Spinner';

// Globaler Ladezustand beim Seitenwechsel (App Router).
export default function Loading() {
  return <PageSpinner className="min-h-[70vh]" />;
}
