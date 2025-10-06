
import type { NextApiRequest, NextApiResponse } from 'next';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  target: 'https://iiwiki.com',
  changeOrigin: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  req.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';
  
  req.url = `/mediawiki/api.php`;

  proxy.web(req, res, (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error');
  });
}
