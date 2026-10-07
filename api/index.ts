// Ensure serverless mode flag is set before any module evaluation
process.env.IS_SERVERLESS = 'true';

import type { Request, Response } from 'express';

let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    process.env.IS_SERVERLESS = 'true';
    const serverModule = await import('../server');
    cachedApp = serverModule.app;
  }
  return cachedApp;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();

    // Vercel rewrites might pass rewritten req.url (e.g. /api).
    // If x-matched-path contains the original route (e.g. /api/v1/health), restore it.
    const matchedPath = (req.headers['x-matched-path'] as string) || '';
    if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
      req.url = matchedPath;
    }

    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Function Invocation Error]:', err);
    return res.status(500).json({
      error: {
        code: 'FUNCTION_INVOCATION_ERROR',
        message: err?.message || 'Server error occurred in Vercel Function.'
      }
    });
  }
}
