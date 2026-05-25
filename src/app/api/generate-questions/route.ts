import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { AI_CONFIG } from '@/lib/ai-config';

// Google AI Konfiguration
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. Authentifizierung prüfen
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ message: 'Nicht autorisiert' }, { status: 401 });
    }

    // Zugriffsschutz: Nur Admin oder Superadmin
    const userRole = session.user.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPERADMIN') {
      return NextResponse.json({ message: 'Zugriff verweigert: Nur für Administratoren.' }, { status: 403 });
    }

    // 2. Request Body parsen
    const body = await req.json();
    const { keywords, domain } = body;

    // Validierung
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0 || !domain) {
      return NextResponse.json(
        { message: 'Fehlende Parameter: "keywords" (Array) und "domain" (String) sind erforderlich.' }, 
        { status: 400 }
      );
    }

    // 3. API Key prüfen
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('[AI Generate Questions] Gemini API-Key ist nicht gesetzt!');
      return NextResponse.json(
        { message: 'API-Schlüssel nicht konfiguriert' }, 
        { status: 500 }
      );
    }

    // 4. KI-Generierung mit Streaming
    const keywordList = keywords.join(', ');
    
    console.log('[AI Generate Questions] Starte Generierung für:', { domain, keywords: keywordList });

    const result = await streamText({
      model: google(AI_CONFIG.primaryModel),
      system: "Du bist ein erfahrener SEO-Redakteur. Deine Aufgabe ist es, basierend auf Keywords relevante 'W-Fragen' (Wer, Wie, Was, Wo, Warum) zu generieren, die Nutzer suchen könnten. Formatiere die Antwort als saubere Liste.",
      prompt: `Analysiere die Domain "${domain}" und die folgenden Keywords: ${keywordList}.\n\nGeneriere eine Liste von 10-15 relevanten W-Fragen, die potentielle Besucher dieser Domain in Bezug auf die Keywords haben könnten.`,
      temperature: 0.7,
    });

    // 5. Stream als Response zurückgeben
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[AI Generate Questions] Fehler:', error);
    
    // Detailliertere Fehlermeldung
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { message: 'Interner Serverfehler', error: errorMessage }, 
      { status: 500 }
    );
  }
}
