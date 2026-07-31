import type { NextRequest } from 'next/server';
import { handleGenerateContent } from '@/lib/ai/generate-content-handler';

export const runtime = 'nodejs';
export const maxDuration = 120;

export function POST(request: NextRequest) {
  return handleGenerateContent(request);
}
