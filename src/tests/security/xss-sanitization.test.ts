/**
 * XSS Sanitization Security Test Suite
 *
 * Tests all sanitization functions and validates XSS protection
 * across user content, wiki content, and general HTML processing.
 */

import {
  sanitizeUserContent,
  sanitizeWikiContent,
  sanitizeHtml,
  escapeHtml,
  stripHtml,
  validateNoXSS
} from '~/lib/sanitize-html';

describe('XSS Sanitization Test Suite', () => {
  describe('sanitizeUserContent() - Strict User Content', () => {
    it('allows safe basic HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const output = sanitizeUserContent(input);

      expect(output).toContain('Hello');
      expect(output).toContain('world');
      expect(output).toContain('<strong>');
    });

    it('removes script tags', () => {
      const input = '<p>Safe content</p><script>alert("XSS")</script>';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
      expect(output).toContain('Safe content');
    });

    it('removes javascript: protocol in links', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click me</a>';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('javascript:');
    });

    it('removes event handlers', () => {
      const input = '<p onclick="alert(\'XSS\')">Click me</p>';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('onclick');
      expect(output).not.toContain('alert');
    });

    it('blocks iframe injection', () => {
      const input = '<iframe src="evil.com"></iframe>';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('<iframe');
      expect(output).not.toContain('evil.com');
    });

    it('blocks object and embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('<object');
      expect(output).not.toContain('<embed');
    });

    it('blocks form elements', () => {
      const input = '<form action="evil.com"><input type="text"></form>';
      const output = sanitizeUserContent(input);

      expect(output).not.toContain('<form');
      expect(output).not.toContain('<input');
    });

    it('allows safe image tags', () => {
      const input = '<img src="https://example.com/image.jpg" alt="Test">';
      const output = sanitizeUserContent(input);

      expect(output).toContain('<img');
      expect(output).toContain('src=');
      expect(output).toContain('alt=');
    });

    it('blocks data: URLs in images', () => {
      const input = '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+">';
      const output = sanitizeUserContent(input);

      // Should either remove the src or the entire tag
      expect(output).not.toContain('data:');
    });

    it('handles empty input', () => {
      expect(sanitizeUserContent('')).toBe('');
      expect(sanitizeUserContent(null as any)).toBe('');
      expect(sanitizeUserContent(undefined as any)).toBe('');
    });

    it('allows safe links with rel attribute', () => {
      const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
      const output = sanitizeUserContent(input);

      expect(output).toContain('href="https://example.com"');
      expect(output).toContain('target="_blank"');
    });
  });

  describe('sanitizeWikiContent() - Moderate Wiki Content', () => {
    it('allows richer HTML for wiki content', () => {
      const input = '<table><tr><td>Cell</td></tr></table>';
      const output = sanitizeWikiContent(input);

      expect(output).toContain('<table');
      expect(output).toContain('<tr');
      expect(output).toContain('<td');
    });

    it('allows style attributes for wiki formatting', () => {
      const input = '<div style="color: red;">Styled content</div>';
      const output = sanitizeWikiContent(input);

      expect(output).toContain('style=');
      expect(output).toContain('Styled content');
    });

    it('still blocks script tags in wiki content', () => {
      const input = '<div>Safe</div><script>alert("XSS")</script>';
      const output = sanitizeWikiContent(input);

      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
      expect(output).toContain('Safe');
    });

    it('still blocks event handlers in wiki content', () => {
      const input = '<div onmouseover="alert(\'XSS\')">Hover</div>';
      const output = sanitizeWikiContent(input);

      expect(output).not.toContain('onmouseover');
      expect(output).not.toContain('alert');
    });

    it('allows semantic HTML elements', () => {
      const input = '<section><article><h2>Title</h2><time datetime="2025-01-01">Date</time></article></section>';
      const output = sanitizeWikiContent(input);

      expect(output).toContain('<section');
      expect(output).toContain('<article');
      expect(output).toContain('<time');
      expect(output).toContain('datetime=');
    });

    it('allows complex table structures', () => {
      const input = `
        <table>
          <thead><tr><th scope="col">Header</th></tr></thead>
          <tbody><tr><td colspan="2">Data</td></tr></tbody>
          <tfoot><tr><td>Footer</td></tr></tfoot>
        </table>
      `;
      const output = sanitizeWikiContent(input);

      expect(output).toContain('<thead');
      expect(output).toContain('<tbody');
      expect(output).toContain('<tfoot');
      expect(output).toContain('colspan=');
      expect(output).toContain('scope=');
    });
  });

  describe('sanitizeHtml() - Balanced General Use', () => {
    it('allows common formatting tags', () => {
      const input = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const output = sanitizeHtml(input);

      expect(output).toContain('<strong>');
      expect(output).toContain('<em>');
    });

    it('blocks scripts', () => {
      const input = 'Normal text<script>evil()</script>';
      const output = sanitizeHtml(input);

      expect(output).not.toContain('<script>');
      expect(output).not.toContain('evil');
    });

    it('blocks dangerous attributes', () => {
      const input = '<div onclick="bad()" onload="worse()">Content</div>';
      const output = sanitizeHtml(input);

      expect(output).not.toContain('onclick');
      expect(output).not.toContain('onload');
    });

    it('allows blockquotes and lists', () => {
      const input = '<blockquote><ul><li>Item 1</li><li>Item 2</li></ul></blockquote>';
      const output = sanitizeHtml(input);

      expect(output).toContain('<blockquote');
      expect(output).toContain('<ul');
      expect(output).toContain('<li');
    });
  });

  describe('escapeHtml() - Plain Text Escaping', () => {
    it('escapes HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const output = escapeHtml(input);

      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');
      expect(output).not.toContain('<script>');
    });

    it('escapes quotes and ampersands', () => {
      const input = 'Tom & Jerry\'s "Adventure"';
      const output = escapeHtml(input);

      expect(output).toContain('&amp;');
      expect(output).toContain('&#039;');
      expect(output).toContain('&quot;');
    });

    it('handles empty input', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as any)).toBe('');
    });
  });

  describe('stripHtml() - Text Extraction', () => {
    it('removes all HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const output = stripHtml(input);

      expect(output).toBe('Hello world');
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('handles nested tags', () => {
      const input = '<div><p><span>Text</span></p></div>';
      const output = stripHtml(input);

      expect(output).toBe('Text');
    });

    it('preserves text content only', () => {
      const input = '<a href="evil.com">Click here</a>';
      const output = stripHtml(input);

      expect(output).toBe('Click here');
      expect(output).not.toContain('href');
    });

    it('handles empty input', () => {
      expect(stripHtml('')).toBe('');
      expect(stripHtml('   ')).toBe('');
    });
  });

  describe('validateNoXSS() - Pre-validation', () => {
    it('detects script tags', () => {
      const result = validateNoXSS('<script>alert(1)</script>');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Script tags');
    });

    it('detects javascript: protocol', () => {
      const result = validateNoXSS('<a href="javascript:alert(1)">Link</a>');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('JavaScript protocols');
    });

    it('detects event handlers', () => {
      const result = validateNoXSS('<div onclick="bad()">Click</div>');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Event handlers');
    });

    it('detects data URLs with HTML', () => {
      const result = validateNoXSS('<img src="data:text/html,<script>alert(1)</script>">');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Data URLs with HTML');
    });

    it('detects iframe tags', () => {
      const result = validateNoXSS('<iframe src="evil.com"></iframe>');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Iframe tags');
    });

    it('allows safe content', () => {
      const result = validateNoXSS('<p>Safe text with <strong>formatting</strong></p>');

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('handles empty input as valid', () => {
      const result = validateNoXSS('');

      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Attack Vectors', () => {
    const attackVectors = [
      // Script variations
      '<SCRIPT>alert("XSS")</SCRIPT>',
      '<script>alert(String.fromCharCode(88,83,83))</script>',
      '<ScRiPt>alert("XSS")</ScRiPt>',

      // Event handler variations
      '<img src=x onerror=alert(1)>',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',

      // JavaScript protocol variations
      '<a href=javascript:alert(1)>Click</a>',
      '<a href=JaVaScRiPt:alert(1)>Click</a>',
      '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">Click</a>',

      // Data URL variations
      '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
      '<object data="data:text/html,<script>alert(1)</script>"></object>',

      // SVG-based XSS
      '<svg onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',

      // Form-based attacks
      '<form action="javascript:alert(1)"><input type="submit"></form>',

      // Meta tag injection
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',

      // Link tag injection
      '<link rel="import" href="evil.html">',

      // Style-based XSS
      '<style>@import "javascript:alert(1)";</style>',

      // HTML5 specific
      '<details open ontoggle=alert(1)>',
      '<audio src=x onerror=alert(1)>',
      '<video src=x onerror=alert(1)>',
    ];

    attackVectors.forEach((vector, index) => {
      it(`blocks attack vector #${index + 1}: ${vector.substring(0, 50)}...`, () => {
        const sanitized = sanitizeUserContent(vector);

        // Should not contain dangerous patterns
        expect(sanitized.toLowerCase()).not.toContain('alert(');
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onload=');
        expect(sanitized).not.toContain('onclick=');
        expect(sanitized).not.toContain('onfocus=');
        expect(sanitized).not.toContain('ontoggle=');
      });
    });
  });

  describe('Integration Tests - Real-World Scenarios', () => {
    it('sanitizes ThinkPages user post', () => {
      const userPost = `
        <p>Check out my <strong>amazing</strong> country!</p>
        <script>stealCookies()</script>
        <a href="https://ixwiki.com/wiki/MyCountry">Visit IxWiki</a>
      `;

      const sanitized = sanitizeUserContent(userPost);

      expect(sanitized).toContain('amazing');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('href="https://ixwiki.com/wiki/MyCountry"');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('stealCookies');
    });

    it('sanitizes wiki content from external API', () => {
      const wikiContent = `
        <div class="infobox" style="width: 300px;">
          <table>
            <tr><th colspan="2">Country Name</th></tr>
            <tr><td>Capital</td><td>City Name</td></tr>
          </table>
        </div>
        <script>malicious()</script>
      `;

      const sanitized = sanitizeWikiContent(wikiContent);

      expect(sanitized).toContain('<table');
      expect(sanitized).toContain('colspan="2"');
      expect(sanitized).toContain('style=');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('malicious');
    });

    it('sanitizes builder import data', () => {
      const importData = {
        capital: '<a href="https://ixwiki.com/wiki/Capital">Capital City</a><script>alert(1)</script>',
        government: 'Democracy<img src=x onerror=alert(1)>',
        snippet: 'A <strong>great</strong> nation.<iframe src="evil"></iframe>'
      };

      const sanitizedCapital = sanitizeWikiContent(importData.capital);
      const sanitizedGovernment = sanitizeWikiContent(importData.government);
      const sanitizedSnippet = sanitizeWikiContent(importData.snippet);

      expect(sanitizedCapital).toContain('Capital City');
      expect(sanitizedCapital).not.toContain('<script>');

      expect(sanitizedGovernment).toContain('Democracy');
      expect(sanitizedGovernment).not.toContain('onerror');

      expect(sanitizedSnippet).toContain('<strong>');
      expect(sanitizedSnippet).toContain('great');
      expect(sanitizedSnippet).not.toContain('<iframe');
    });

    it('sanitizes featured article content', () => {
      const articleHtml = `
        <h2>Article Title</h2>
        <p>This is a <em>featured</em> article about <strong>important</strong> topics.</p>
        <script src="evil.js"></script>
        <div onclick="track()">Click tracking</div>
      `;

      const sanitized = sanitizeWikiContent(articleHtml);

      expect(sanitized).toContain('<h2>');
      expect(sanitized).toContain('<em>featured</em>');
      expect(sanitized).toContain('<strong>important</strong>');
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onclick');
    });

    it('sanitizes intelligence briefing parsed markup', () => {
      const parsedMarkup = `
        <strong class="font-bold">Bold text</strong>
        <em class="italic">Italic text</em>
        <a href="https://ixwiki.com" target="_blank" class="text-blue-400">External link</a>
        <script>evil()</script>
      `;

      const sanitized = sanitizeWikiContent(parsedMarkup);

      expect(sanitized).toContain('<strong');
      expect(sanitized).toContain('<em');
      expect(sanitized).toContain('href="https://ixwiki.com"');
      expect(sanitized).not.toContain('<script>');
    });
  });

  describe('Edge Cases and Performance', () => {
    it('handles very long strings efficiently', () => {
      const longString = '<p>' + 'a'.repeat(10000) + '</p>';
      const start = Date.now();
      const sanitized = sanitizeHtml(longString);
      const duration = Date.now() - start;

      expect(sanitized).toContain('<p>');
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('handles deeply nested HTML', () => {
      let nested = 'Content';
      for (let i = 0; i < 50; i++) {
        nested = `<div>${nested}</div>`;
      }

      const sanitized = sanitizeHtml(nested);

      expect(sanitized).toContain('Content');
      expect(sanitized).toContain('<div>');
    });

    it('handles malformed HTML gracefully', () => {
      const malformed = '<div><p>Unclosed paragraph<div>Wrong nesting</p></div>';
      const sanitized = sanitizeHtml(malformed);

      expect(sanitized).toContain('Unclosed paragraph');
      expect(sanitized).toContain('Wrong nesting');
    });

    it('handles Unicode and special characters', () => {
      const unicode = '<p>Hello 世界 🌍 Привет</p>';
      const sanitized = sanitizeHtml(unicode);

      expect(sanitized).toContain('世界');
      expect(sanitized).toContain('🌍');
      expect(sanitized).toContain('Привет');
    });

    it('preserves whitespace in pre tags', () => {
      const code = '<pre>  function test() {\n    return true;\n  }</pre>';
      const sanitized = sanitizeHtml(code);

      expect(sanitized).toContain('<pre>');
      expect(sanitized).toContain('function test()');
    });
  });

  describe('Server-Side Rendering Safety', () => {
    it('works in server-side environment', () => {
      // Simulate server-side by testing without DOM
      const originalWindow = global.window;
      (global as any).window = undefined;

      const input = '<p>Server-side <strong>sanitization</strong></p>';
      const output = sanitizeHtml(input);

      expect(output).toContain('Server-side');
      expect(output).toContain('<strong>');

      // Restore
      (global as any).window = originalWindow;
    });

    it('escapes HTML in server environment', () => {
      const originalWindow = global.window;
      (global as any).window = undefined;

      const input = '<script>alert(1)</script>';
      const output = escapeHtml(input);

      expect(output).toContain('&lt;');
      expect(output).toContain('&gt;');

      // Restore
      (global as any).window = originalWindow;
    });
  });
});
