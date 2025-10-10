// STUB: Proxy disabled - requires http-proxy dependency
// To enable: npm install http-proxy && npm install -D @types/http-proxy
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(503).json({ error: 'IIWiki proxy service disabled - http-proxy dependency not installed' });
}
