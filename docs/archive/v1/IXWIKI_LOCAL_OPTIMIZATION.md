# IxWiki Local Server Optimization

## Overview

When IxStats and IxWiki are hosted on the same server, API calls can be optimized to use local connections instead of external HTTPS requests. This reduces latency, eliminates SSL overhead, and improves performance.

## Environment Variable

### `IXWIKI_LOCAL_PATH`

**Purpose**: Specifies the local path to IxWiki when both services are hosted on the same server.

**Type**: Optional string

**Example Values**:
```bash
# For local development
IXWIKI_LOCAL_PATH="http://localhost"

# For production (if IxWiki is on different port)
IXWIKI_LOCAL_PATH="http://localhost:8080"

# For production (if IxWiki is in subdirectory)
IXWIKI_LOCAL_PATH="http://localhost/ixwiki"
```

## Implementation Details

### API Proxy Optimization

The IxWiki API proxy (`/src/app/api/ixwiki-proxy/api.php/route.ts`) automatically detects the `IXWIKI_LOCAL_PATH` environment variable:

- **If set**: Uses local connection for API calls
- **If not set**: Falls back to external HTTPS (`https://ixwiki.com/w/api.php`)

### Performance Benefits

1. **Reduced Latency**: Local connections are significantly faster than external HTTPS
2. **No SSL Overhead**: Eliminates SSL/TLS handshake time
3. **No DNS Lookups**: Direct server-to-server communication
4. **Better Reliability**: No external network dependencies

## Production Setup

### Same-Server Deployment

If IxWiki and IxStats are on the same server:

```bash
# Set the local IxWiki path
IXWIKI_LOCAL_PATH="http://localhost"
```

### Different Ports

If IxWiki runs on a different port:

```bash
# Example: IxWiki on port 8080
IXWIKI_LOCAL_PATH="http://localhost:8080"
```

### Subdirectory Setup

If IxWiki is in a subdirectory:

```bash
# Example: IxWiki at /ixwiki
IXWIKI_LOCAL_PATH="http://localhost/ixwiki"
```

## Fallback Behavior

If `IXWIKI_LOCAL_PATH` is not set, the system automatically falls back to external HTTPS requests to `https://ixwiki.com/w/api.php`, ensuring compatibility with development environments and different deployment configurations.

## Testing

To verify the optimization is working:

1. Set `IXWIKI_LOCAL_PATH` in your environment
2. Check browser network tab for API calls to `/api/ixwiki-proxy/api.php`
3. Verify requests are going to the local path instead of external HTTPS

## Security Considerations

- Local connections are only used when `IXWIKI_LOCAL_PATH` is explicitly set
- No authentication changes are required
- Same security model as external requests
- Local connections are server-to-server only
