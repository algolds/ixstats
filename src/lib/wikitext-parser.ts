/**
 * MediaWiki Text Parser
 * Converts MediaWiki/wiki-text syntax to HTML for the collaborative document system
 * Supports: headings, formatting, lists, links, templates, images, tables, and more
 */

interface WikiImage {
  filename: string;
  width?: string;
  height?: string;
  align?: 'left' | 'right' | 'center' | 'none';
  caption?: string;
  link?: string;
  thumb?: boolean;
  frame?: boolean;
  frameless?: boolean;
  border?: boolean;
}

interface ParseOptions {
  imageBaseUrl?: string;
  wikiBaseUrl?: string;
  allowHtml?: boolean;
}

/**
 * Main parser class for converting wiki-text to HTML
 */
export class WikiTextParser {
  private imageBaseUrl: string;
  private wikiBaseUrl: string;
  private allowHtml: boolean;

  constructor(options: ParseOptions = {}) {
    this.imageBaseUrl = options.imageBaseUrl || 'https://ixwiki.com/wiki/Special:Redirect/file';
    this.wikiBaseUrl = options.wikiBaseUrl || 'https://ixwiki.com/wiki';
    this.allowHtml = options.allowHtml ?? true;
  }

  /**
   * Main parse method - converts wiki-text to HTML
   */
  parse(wikitext: string): string {
    if (!wikitext) return '';

    let html = wikitext;

    // Order matters! Parse in this sequence:
    // 1. Templates and parser functions (must be first)
    html = this.parseTemplates(html);
    html = this.parseParserFunctions(html);

    // 2. Comments (remove them)
    html = this.parseComments(html);

    // 3. Tables (before other block elements)
    html = this.parseTables(html);

    // 4. Headings
    html = this.parseHeadings(html);

    // 5. Horizontal rules
    html = this.parseHorizontalRules(html);

    // 6. Lists (before paragraphs)
    html = this.parseLists(html);

    // 7. Indentation and block quotes
    html = this.parseIndentation(html);

    // 8. Images (before links)
    html = this.parseImages(html);

    // 9. Links
    html = this.parseLinks(html);

    // 10. Text formatting (bold, italic, etc)
    html = this.parseFormatting(html);

    // 11. Line breaks and paragraphs
    html = this.parseParagraphs(html);

    // 12. HTML entities
    html = this.parseHtmlEntities(html);

    return html.trim();
  }

  /**
   * Parse MediaWiki templates {{template|param1|param2}}
   */
  private parseTemplates(text: string): string {
    // Simple template parser - expands common templates
    const templates: Record<string, (params: string[]) => string> = {
      'citation needed': () => '<sup class="text-muted-foreground text-xs">[<i>citation needed</i>]</sup>',
      'cn': () => '<sup class="text-muted-foreground text-xs">[<i>citation needed</i>]</sup>',
      'stub': () => '<div class="bg-muted p-4 rounded-lg my-4 text-sm"><i>This section is a stub. You can help by expanding it.</i></div>',
      'clear': () => '<div class="clear-both"></div>',
      'main': (params) => `<div class="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg my-4 text-sm">Main article: <a href="${this.wikiBaseUrl}/${params[0]}" class="text-blue-600 hover:underline">${params[0]}</a></div>`,
      'see also': (params) => `<div class="bg-muted p-3 rounded-lg my-4 text-sm">See also: <a href="${this.wikiBaseUrl}/${params[0]}" class="text-blue-600 hover:underline">${params[0]}</a></div>`,
    };

    // Match {{template|params}}
    return text.replace(/\{\{([^}|]+)(\|[^}]*)?\}\}/g, (match, templateName, params) => {
      const name = templateName.trim().toLowerCase();
      const paramList = params ? params.substring(1).split('|').map((p: string) => p.trim()) : [];

      if (templates[name]) {
        return templates[name](paramList);
      }

      // Unknown template - return as span
      return `<span class="text-orange-600 text-sm" title="Template: ${templateName}">[${templateName}]</span>`;
    });
  }

  /**
   * Parse parser functions {{#if:condition|then|else}}
   */
  private parseParserFunctions(text: string): string {
    // Remove parser functions for now (they're complex)
    return text.replace(/\{\{#[^}]+\}\}/g, '');
  }

  /**
   * Remove HTML comments <!-- comment -->
   */
  private parseComments(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/g, '');
  }

  /**
   * Parse headings = Heading =
   */
  private parseHeadings(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      // Match = Heading = format (up to 6 levels)
      const headingMatch = line.match(/^(={1,6})\s*(.+?)\s*\1\s*$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const content = headingMatch[2].trim();
        const id = this.escapeHtml(content.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''));
        const escapedContent = this.escapeHtml(content);
        result.push(`<h${level} id="${id}" class="font-bold my-4">${escapedContent}</h${level}>`);
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Parse horizontal rules ----
   */
  private parseHorizontalRules(text: string): string {
    return text.replace(/^----+$/gm, '<hr class="my-4 border-border" />');
  }

  /**
   * Parse lists (* unordered, # ordered, ; definition, : indented)
   */
  private parseLists(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let inList = false;
    let listStack: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const listMatch = line.match(/^([*#;:]+)\s*(.*)$/);

      if (listMatch) {
        const markers = listMatch[1];
        const content = listMatch[2];
        const depth = markers.length;
        const lastMarker = markers[markers.length - 1];

        // Determine list type
        const listType = lastMarker === '#' ? 'ol' : lastMarker === ';' ? 'dl-dt' : lastMarker === ':' ? 'dl-dd' : 'ul';

        if (!inList) {
          // Start first list
          if (listType === 'dl-dt' || listType === 'dl-dd') {
            result.push('<dl class="my-2">');
            listStack.push('dl');
          } else {
            result.push(`<${listType} class="list-${listType === 'ol' ? 'decimal' : 'disc'} ml-6 my-2">`);
            listStack.push(listType);
          }
          inList = true;
        }

        // Handle nested lists
        while (listStack.length < depth) {
          const newType = markers[listStack.length] === '#' ? 'ol' : 'ul';
          result.push(`<${newType} class="list-${newType === 'ol' ? 'decimal' : 'disc'} ml-6 my-1">`);
          listStack.push(newType);
        }

        while (listStack.length > depth) {
          const closeType = listStack.pop();
          result.push(`</${closeType}>`);
        }

        // Add list item
        if (listType === 'dl-dt') {
          result.push(`<dt class="font-semibold">${content}</dt>`);
        } else if (listType === 'dl-dd') {
          result.push(`<dd class="ml-4">${content}</dd>`);
        } else {
          result.push(`<li>${content}</li>`);
        }
      } else {
        // Close all open lists
        while (listStack.length > 0) {
          const closeType = listStack.pop();
          result.push(`</${closeType}>`);
        }
        inList = false;
        result.push(line);
      }
    }

    // Close any remaining lists
    while (listStack.length > 0) {
      const closeType = listStack.pop();
      result.push(`</${closeType}>`);
    }

    return result.join('\n');
  }

  /**
   * Parse indentation (: at start of line)
   */
  private parseIndentation(text: string): string {
    return text.replace(/^:+(.*)$/gm, (match, content) => {
      const level = match.indexOf(content);
      return `<blockquote class="border-l-4 border-muted pl-4 my-2" style="margin-left: ${level * 20}px">${content}</blockquote>`;
    });
  }

  /**
   * Parse images [[File:image.jpg|options]]
   */
  private parseImages(text: string): string {
    // Match [[File:...]] or [[Image:...]]
    return text.replace(/\[\[(File|Image):([^\]]+)\]\]/gi, (match, type, params) => {
      const parts = params.split('|').map((p: string) => p.trim());
      const filename = parts[0];

      const imageData: WikiImage = {
        filename,
        width: undefined,
        height: undefined,
        align: 'none',
        caption: undefined,
        thumb: false,
        frame: false,
        frameless: false,
        border: false
      };

      // Parse image options
      for (let i = 1; i < parts.length; i++) {
        const option = parts[i].toLowerCase();

        if (option === 'thumb' || option === 'thumbnail') {
          imageData.thumb = true;
        } else if (option === 'frame' || option === 'framed') {
          imageData.frame = true;
        } else if (option === 'frameless') {
          imageData.frameless = true;
        } else if (option === 'border') {
          imageData.border = true;
        } else if (['left', 'right', 'center', 'none'].includes(option)) {
          imageData.align = option as any;
        } else if (option.endsWith('px')) {
          const size = option.replace('px', '');
          if (size.includes('x')) {
            const [w, h] = size.split('x');
            imageData.width = w;
            imageData.height = h;
          } else {
            imageData.width = size;
          }
        } else if (option.startsWith('link=')) {
          imageData.link = option.substring(5);
        } else if (i === parts.length - 1) {
          // Last param is usually caption
          imageData.caption = parts[i];
        }
      }

      return this.renderImage(imageData);
    });
  }

  /**
   * Render an image as HTML
   */
  private renderImage(img: WikiImage): string {
    const imageUrl = `${this.imageBaseUrl}/${encodeURIComponent(img.filename)}`;
    const width = img.width ? `width="${this.escapeHtml(img.width)}"` : '';
    const height = img.height ? `height="${this.escapeHtml(img.height)}"` : '';
    const border = img.border ? 'border border-border' : '';
    const altText = this.escapeHtml(img.caption || img.filename);

    let alignClass = '';
    if (img.align === 'left') alignClass = 'float-left mr-4 mb-4';
    else if (img.align === 'right') alignClass = 'float-right ml-4 mb-4';
    else if (img.align === 'center') alignClass = 'mx-auto block';

    if (img.thumb || img.frame) {
      // Thumbnail or framed image
      const escapedCaption = img.caption ? this.escapeHtml(img.caption) : '';
      return `
        <figure class="${alignClass} bg-muted p-2 rounded-lg max-w-sm">
          <img src="${this.escapeHtml(imageUrl)}" alt="${altText}" ${width} ${height} class="rounded ${border}" />
          ${img.caption ? `<figcaption class="text-sm text-muted-foreground mt-2 text-center">${escapedCaption}</figcaption>` : ''}
        </figure>
      `;
    } else {
      // Regular image
      const imgTag = `<img src="${this.escapeHtml(imageUrl)}" alt="${altText}" ${width} ${height} class="${alignClass} ${border} rounded" />`;

      if (img.link) {
        return `<a href="${this.escapeHtml(img.link)}" class="inline-block">${imgTag}</a>`;
      }

      return imgTag;
    }
  }

  /**
   * Parse links [[Link]] and [http://url External]
   */
  private parseLinks(text: string): string {
    // Internal wiki links [[Page]] or [[Page|Display]]
    text = text.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, page, pipe, display) => {
      const linkText = this.escapeHtml(display || page).trim();
      const linkUrl = `${this.wikiBaseUrl}/${encodeURIComponent(page.trim())}`;
      return `<a href="${this.escapeHtml(linkUrl)}" class="text-blue-600 dark:text-blue-400 hover:underline">${linkText}</a>`;
    });

    // External links [http://url Display] or http://url
    text = text.replace(/\[(\S+)\s+([^\]]+)\]/g, (match, url, display) => {
      return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${this.escapeHtml(display)}</a>`;
    });

    // Bare URLs (but not if already in an href attribute)
    text = text.replace(/(?<!href=["'])(?<!href=")\b(https?:\/\/[^\s<>"]+)(?!")/g, (match, url) => {
      return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${this.escapeHtml(url)}</a>`;
    });

    return text;
  }

  /**
   * Escape HTML special characters to prevent XSS and parsing issues
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  }

  /**
   * Parse text formatting (bold, italic, etc)
   */
  private parseFormatting(text: string): string {
    // Bold and italic combined '''''text'''''
    text = text.replace(/'''''(.+?)'''''/g, '<strong><em>$1</em></strong>');

    // Bold '''text'''
    text = text.replace(/'''(.+?)'''/g, '<strong>$1</strong>');

    // Italic ''text''
    text = text.replace(/''(.+?)''/g, '<em>$1</em>');

    // Strikethrough <s>text</s> or <strike>
    text = text.replace(/<s>(.+?)<\/s>/gi, '<del>$1</del>');
    text = text.replace(/<strike>(.+?)<\/strike>/gi, '<del>$1</del>');

    // Underline <u>text</u>
    text = text.replace(/<u>(.+?)<\/u>/gi, '<u>$1</u>');

    // Code <code>text</code>
    text = text.replace(/<code>(.+?)<\/code>/gi, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');

    // Preformatted <pre>text</pre>
    text = text.replace(/<pre>([\s\S]+?)<\/pre>/gi, '<pre class="bg-muted p-4 rounded-lg overflow-x-auto my-4"><code>$1</code></pre>');

    // Superscript <sup>text</sup>
    text = text.replace(/<sup>(.+?)<\/sup>/gi, '<sup>$1</sup>');

    // Subscript <sub>text</sub>
    text = text.replace(/<sub>(.+?)<\/sub>/gi, '<sub>$1</sub>');

    return text;
  }

  /**
   * Parse tables {| ... |}
   */
  private parseTables(text: string): string {
    // Match wiki tables {| ... |}
    return text.replace(/\{\|([^\}]*)\n([\s\S]*?)\n\|\}/g, (match, tableAttrs, tableContent) => {
      const rows = tableContent.split(/\n\|-/).filter((r: string) => r.trim());

      let html = '<table class="border-collapse border border-border my-4 w-full">';

      for (const row of rows) {
        const cells = row.split(/\n[\|\!]/).filter((c: string) => c.trim());
        html += '<tr>';

        for (const cell of cells) {
          const isHeader = row.trim().startsWith('!');
          const cellContent = cell.replace(/^[\|\!]\s*/, '').trim();

          if (isHeader) {
            html += `<th class="border border-border px-4 py-2 bg-muted font-semibold">${cellContent}</th>`;
          } else {
            html += `<td class="border border-border px-4 py-2">${cellContent}</td>`;
          }
        }

        html += '</tr>';
      }

      html += '</table>';
      return html;
    });
  }

  /**
   * Convert paragraphs and line breaks
   */
  private parseParagraphs(text: string): string {
    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/);

    return paragraphs.map(para => {
      para = para.trim();
      if (!para) return '';

      // Don't wrap if already in a block element
      if (para.match(/^<(h\d|div|p|ul|ol|table|blockquote|pre|hr)/i)) {
        return para;
      }

      // Convert single newlines to <br>
      para = para.replace(/\n/g, '<br />');

      return `<p class="my-2">${para}</p>`;
    }).join('\n');
  }

  /**
   * Parse HTML entities
   */
  private parseHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&apos;': "'",
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '…',
    };

    for (const [entity, char] of Object.entries(entities)) {
      text = text.replace(new RegExp(entity, 'g'), char);
    }

    return text;
  }
}

/**
 * Utility function to parse wiki-text
 */
export function parseWikiText(wikitext: string, options?: ParseOptions): string {
  const parser = new WikiTextParser(options);
  return parser.parse(wikitext);
}

/**
 * Extract images from wiki-text
 */
export function extractWikiImages(wikitext: string): string[] {
  const imageRegex = /\[\[(File|Image):([^\]|]+)/gi;
  const images: string[] = [];
  let match;

  while ((match = imageRegex.exec(wikitext)) !== null) {
    images.push(match[2].trim());
  }

  return images;
}

/**
 * Extract links from wiki-text
 */
export function extractWikiLinks(wikitext: string): Array<{ page: string; display?: string }> {
  const linkRegex = /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g;
  const links: Array<{ page: string; display?: string }> = [];
  let match;

  while ((match = linkRegex.exec(wikitext)) !== null) {
    links.push({
      page: match[1].trim(),
      display: match[3]?.trim()
    });
  }

  return links;
}
