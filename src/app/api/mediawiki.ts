import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req;
  const baseUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com';

  const url = new URL(`${baseUrl}/api.php`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('origin', '*');

  // Append all query params from the client request
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: response.statusText });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch from MediaWiki API' });
  }
}
