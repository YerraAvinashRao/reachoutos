import type { Request, Response } from 'express';
import { app } from '../server';

export default function handler(req: Request, res: Response) {
  try {
    // If Vercel rewrites /api/v1/... to /api, recover original path from x-matched-path
    const matchedPath = (req.headers['x-matched-path'] as string) || '';
    if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
      req.url = matchedPath;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Error]:', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Server error occurred in Vercel function'
      }
    });
  }
}
