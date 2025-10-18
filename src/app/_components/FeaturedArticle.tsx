"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { BookOpen, ExternalLink, RefreshCw } from "lucide-react";
import { IxnayWikiService } from "~/lib/mediawiki-service";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import { sanitizeWikiContent } from "~/lib/sanitize-html";

interface FeaturedArticleProps {
  className?: string;
}

interface FeaturedArticleData {
  title: string;
  description: string;
  imageUrl?: string;
  articleUrl: string;
  category?: string;
  lastUpdated?: string;
}

export function FeaturedArticle({ className }: FeaturedArticleProps) {
  const [articleData, setArticleData] = useState<FeaturedArticleData | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const wikiService = new IxnayWikiService();

  const fetchFeaturedArticle = async () => {
    try {
      setIsLoading(true);

      // Fetch the template content
      console.log("Fetching template: Template:Home/Featured article");
      const templateResult = await wikiService.getTemplate("Template:Home/Featured article");
      console.log("Template result type:", typeof templateResult);
      if (typeof templateResult === 'string') {
        console.log("Template content length:", templateResult.length);
        console.log("Template content preview:", templateResult.substring(0, 200));
      } else {
        console.log("Template error:", templateResult.error);
      }
      
      if (typeof templateResult === 'object' && 'error' in templateResult) {
        console.warn("Template fetch error:", templateResult.error);
        // Try alternative template names
        const alternativeTemplates = [
          "Template:Featured_article",
          "Template:Home/Featured",
          "Template:Main/Featured_article"
        ];
        
        let foundTemplate = false;
        for (const altTemplate of alternativeTemplates) {
          try {
            const altResult = await wikiService.getTemplate(altTemplate);
            if (typeof altResult === 'string') {
              console.log(`Found alternative template: ${altTemplate}`);
              foundTemplate = true;
              // Parse the alternative template
              const htmlResult = await wikiService.parseWikitextToHtml(altResult, altTemplate);
              if (htmlResult) {
                setHtmlContent(htmlResult);
                setLastFetch(new Date());
                try {
                  const extractedData = extractArticleData(altResult);
                  setArticleData(extractedData);
                } catch (extractError) {
                  console.warn("Could not extract structured data from alternative template:", extractError);
                }
                return;
              }
            }
          } catch (altError) {
            console.warn(`Alternative template ${altTemplate} failed:`, altError);
          }
        }
        
        if (!foundTemplate) {
          throw new Error(`Template not found. Tried: Template:Home/Featured article and alternatives`);
        }
      }

      // At this point, templateResult should be a string
      if (typeof templateResult !== 'string') {
        throw new Error("Unexpected template result type");
      }

      console.log("Template content length:", templateResult.length);
      console.log("Template content preview:", templateResult.substring(0, 200));
      
      // Test if the template content is valid wikitext
      if (templateResult.trim().length === 0) {
        console.warn("Template content is empty");
        // Don't create fallback - return empty instead
        setArticleData(null);
        setHtmlContent(`
          <style>
            .featured-article-fallback {
              padding: 2rem;
              text-align: center;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 100%;
              width: 100%;
              box-sizing: border-box;
            }
            .featured-article-fallback * {
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              hyphens: auto !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .featured-article-fallback h3 {
              color: #212529;
              margin-bottom: 1rem;
              font-size: 1.5rem;
              font-weight: 600;
            }
            .featured-article-fallback p {
              color: #495057;
              line-height: 1.6;
              margin-bottom: 1rem;
              word-wrap: break-word;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            .featured-links {
              display: flex;
              gap: 1rem;
              justify-content: center;
              margin-top: 1.5rem;
            }
            .featured-links a {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.5rem;
              background: #0d6efd;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .featured-links a:hover {
              background: #0b5ed7;
              text-decoration: none;
            }
            .dark .featured-article-fallback {
              background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
              color: #e2e8f0;
            }
            .dark .featured-article-fallback h3 {
              color: #e2e8f0;
            }
            .dark .featured-article-fallback p {
              color: #cbd5e0;
            }
          </style>
          <div class="featured-article-fallback">
            <h3>Welcome to IxWiki</h3>
            <p>Discover the rich world of IxWiki, where nations come to life through detailed articles, comprehensive statistics, and engaging content.</p>
            <p>Explore countries, learn about their histories, and dive into the fascinating world of international relations and economics.</p>
            <div class="featured-links">
              <a href="https://ixwiki.com/wiki/Main_Page" target="_blank" rel="noopener noreferrer">Visit IxWiki</a>
              <a href={createUrl("/countries")} target="_blank" rel="noopener noreferrer">Browse Countries</a>
            </div>
          </div>
        `);
        setLastFetch(new Date());
        return;
      }

      // Check if the template contains MediaWiki extension functions that can't be parsed
      if (templateResult.includes('{{#get_web_data:') || templateResult.includes('{{#external_value:')) {
        console.log("Template contains MediaWiki extension functions - extracting structured data manually");
        // Extract the featured article information from the template (now async)
        const extractedData = await extractFeaturedArticleFromTemplate(templateResult);
        if (extractedData) {
          // Fetch the CSS styles for the featured article
          let cssStyles = '';
          try {
            const cssResult = await wikiService.getTemplate("Template:Home/Featured article/styles.css");
            if (typeof cssResult === 'string' && cssResult.trim().length > 0) {
              cssStyles = cssResult;
              console.log("Retrieved CSS styles for featured article");
            }
          } catch (cssError) {
            console.warn("Could not retrieve CSS styles:", cssError);
          }
          setArticleData(extractedData);
          setHtmlContent(`
            <style>
              ${cssStyles}
              /* Fallback styles if CSS template is not available */
              .featured-article-card {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                padding: 1rem;
                border-radius: 8px;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin-bottom: 1rem;
                max-width: 100%;
                width: 100%;
                box-sizing: border-box;
              }
              .featured-article-card * {
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                hyphens: auto !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
              }
              .featured-article-image {
                width: 100%;
                max-width: 100%;
              }
              .featured-article-image img {
                width: 100%;
                height: auto;
                max-height: 200px;
                border-radius: 4px;
                object-fit: cover;
              }
              .featured-article-content {
                flex: 1;
                min-width: 0;
              }
              .featured-article-content .byline {
                font-size: 0.875rem;
                color: #6c757d;
                margin: 0 0 0.5rem 0;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .featured-article-content h3 {
                margin: 0 0 0.75rem 0;
                font-size: 1.25rem;
                font-weight: 600;
              }
              .featured-article-content h3 a {
                color: #212529;
                text-decoration: none;
              }
              .featured-article-content h3 a:hover {
                color: #0d6efd;
                text-decoration: underline;
              }
              .featured-article-content p {
                margin: 0 0 1rem 0;
                line-height: 1.6;
                color: #495057;
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
              }
              .featured-article-meta {
                display: flex;
                gap: 1rem;
                font-size: 0.875rem;
                color: #6c757d;
              }
              .featured-article-meta .category {
                background: #e9ecef;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-weight: 500;
              }
              .dark .featured-article-card {
                background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
                color: #e2e8f0;
              }
              .dark .featured-article-content h3 a {
                color: #e2e8f0;
              }
              .dark .featured-article-content h3 a:hover {
                color: #63b3ed;
              }
              .dark .featured-article-content p {
                color: #cbd5e0;
              }
              .dark .featured-article-meta .category {
                background: #4a5568;
                color: #e2e8f0;
              }
            </style>
            <div class="featured-article-card">
              <div class="featured-article-image">
                <img src="${extractedData.imageUrl || ''}" 
                     alt="${extractedData.title}" 
                     onerror="this.style.display='none'"
                     style="max-width: 100%; height: auto;" />
              </div>
              <div class="featured-article-content">
                <p class="byline">Featured article</p>
                <h3><a href="${extractedData.articleUrl}" target="_blank" rel="noopener noreferrer">${extractedData.title}</a></h3>
                <p>${extractedData.description}</p>
                
              </div>
            </div>
          `);
          setLastFetch(new Date());
          return;
        } else {
          console.warn("Failed to extract featured article data from template with extension functions");
        }
      }

      // Parse the template to HTML
      console.log("Attempting to parse wikitext to HTML...");
      const htmlResult = await wikiService.parseWikitextToHtml(templateResult, "Template:Home/Featured article");
      console.log("parseWikitextToHtml result:", htmlResult ? "success" : "null/undefined");
      
      if (!htmlResult) {
        console.error("parseWikitextToHtml returned null/undefined");
        console.error("Template content:", templateResult);
        
        // Try to create a fallback featured article instead of showing an error
        const fallbackData: FeaturedArticleData = {
          title: "Welcome to IxWiki",
          description: "Discover the rich world of IxWiki, where nations come to life through detailed articles, comprehensive statistics, and engaging content.",
          articleUrl: "https://ixwiki.com/wiki/Main_Page",
          category: "Featured",
          lastUpdated: new Date().toLocaleDateString(),
        };
        
        setArticleData(fallbackData);
        setHtmlContent(`
          <style>
            .featured-article-fallback {
              padding: 2rem;
              text-align: center;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 100%;
              width: 100%;
              box-sizing: border-box;
            }
            .featured-article-fallback * {
              word-wrap: break-word !important;
              overflow-wrap: break-word !important;
              hyphens: auto !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            .featured-article-fallback h3 {
              color: #212529;
              margin-bottom: 1rem;
              font-size: 1.5rem;
              font-weight: 600;
            }
            .featured-article-fallback p {
              color: #495057;
              line-height: 1.6;
              margin-bottom: 1rem;
              word-wrap: break-word;
              overflow-wrap: break-word;
              hyphens: auto;
            }
            .featured-links {
              display: flex;
              gap: 1rem;
              justify-content: center;
              margin-top: 1.5rem;
            }
            .featured-links a {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0.75rem 1.5rem;
              background: #0d6efd;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .featured-links a:hover {
              background: #0b5ed7;
              text-decoration: none;
            }
            .dark .featured-article-fallback {
              background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
              color: #e2e8f0;
            }
            .dark .featured-article-fallback h3 {
              color: #e2e8f0;
            }
            .dark .featured-article-fallback p {
              color: #cbd5e0;
            }
          </style>
          <div class="featured-article-fallback">
            <h3>Welcome to IxWiki</h3>
            <p>Discover the rich world of IxWiki, where nations come to life through detailed articles, comprehensive statistics, and engaging content.</p>
            <p>Explore countries, learn about their histories, and dive into the fascinating world of international relations and economics.</p>
            <div class="featured-links">
              <a href="https://ixwiki.com/wiki/Main_Page" target="_blank" rel="noopener noreferrer">Visit IxWiki</a>
              <a href={createUrl("/countries")} target="_blank" rel="noopener noreferrer">Browse Countries</a>
            </div>
          </div>
        `);
        setLastFetch(new Date());
        return;
      }

      setHtmlContent(htmlResult);
      setLastFetch(new Date());

      // Try to extract structured data from the template
      try {
        const extractedData = extractArticleData(templateResult);
        setArticleData(extractedData);
      } catch (extractError) {
        console.warn("Could not extract structured data from template:", extractError);
        // Continue with just the HTML content
      }

    } catch (err) {
      console.error("Error fetching featured article:", err);
      
      // Instead of showing an error, create a fallback featured article
      const fallbackData: FeaturedArticleData = {
        title: "Welcome to IxWiki",
        description: "Discover the rich world of IxWiki, where nations come to life through detailed articles, comprehensive statistics, and engaging content.",
        articleUrl: "https://ixwiki.com/wiki/Main_Page",
        category: "Featured",
        lastUpdated: new Date().toLocaleDateString(),
      };
      
      setArticleData(fallbackData);
      setHtmlContent(`
        <style>
          .featured-article-fallback {
            padding: 2rem;
            text-align: center;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .featured-article-fallback h3 {
            color: #212529;
            margin-bottom: 1rem;
            font-size: 1.5rem;
            font-weight: 600;
          }
          .featured-article-fallback p {
            color: #495057;
            line-height: 1.6;
            margin-bottom: 1rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }
          .featured-links {
            display: flex;
            gap: 1rem;
            justify-content: center;
            margin-top: 1.5rem;
          }
          .featured-links a {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: #0d6efd;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .featured-links a:hover {
            background: #0b5ed7;
            text-decoration: none;
          }
          .dark .featured-article-fallback {
            background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
            color: #e2e8f0;
          }
          .dark .featured-article-fallback h3 {
            color: #e2e8f0;
          }
          .dark .featured-article-fallback p {
            color: #cbd5e0;
          }
        </style>
        <div class="featured-article-fallback">
          <h3>Welcome to IxWiki</h3>
          <p>Discover the rich world of IxWiki, where nations come to life through detailed articles, comprehensive statistics, and engaging content.</p>
          <p>Explore countries, learn about their histories, and dive into the fascinating world of international relations and economics.</p>
          <div class="featured-links">
            <a href="https://ixwiki.com/wiki/Main_Page" target="_blank" rel="noopener noreferrer">Visit IxWiki</a>
            <a href={createUrl("/countries")} target="_blank" rel="noopener noreferrer">Browse Countries</a>
          </div>
        </div>
      `);
      setLastFetch(new Date());
    } finally {
      setIsLoading(false);
    }
  };

  const extractArticleData = (templateContent: string): FeaturedArticleData => {
    // Try to extract basic information from the template
    const titleMatch = /\|\s*title\s*=\s*([^|\n]+)/i.exec(templateContent);
    const descriptionMatch = /\|\s*description\s*=\s*([^|\n]+)/i.exec(templateContent);
    const imageMatch = /\|\s*image\s*=\s*([^|\n]+)/i.exec(templateContent);
    const categoryMatch = /\|\s*category\s*=\s*([^|\n]+)/i.exec(templateContent);

    const title = titleMatch?.[1]?.trim() || "Featured Article";
    const description = descriptionMatch?.[1]?.trim() || "Discover today's featured article from the wiki.";
    const image = imageMatch?.[1]?.trim();
    const category = categoryMatch?.[1]?.trim();

    // Construct the article URL (you might need to adjust this based on your wiki structure)
    const articleUrl = title ? `https://ixwiki.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : "#";

    return {
      title,
      description,
      imageUrl: image ? `https://ixwiki.com/wiki/Special:Filepath/${encodeURIComponent(image)}` : undefined,
      articleUrl,
      category,
      lastUpdated: new Date().toLocaleDateString(),
    };
  };

  // Improved: More robust extraction and logging for debugging, with multiline get_web_data URL support
  const extractFeaturedArticleFromTemplate = async (templateContent: string): Promise<FeaturedArticleData | null> => {
    try {
      console.log("Extracting featured article data from template with extension functions");
      console.log("Template content preview:", templateContent.substring(0, 500));
      
      // Extract the title from the arrow format: -->Title<!--
      let title = "Featured Article";
      
      // Look for the specific pattern in the template
      // The template has: -->Citizenship law in Castadilla<!--
      const titleMatches = templateContent.match(/-->([^<]+?)<!--/g);
      if (titleMatches && titleMatches.length > 0) {
        // Find the one that looks like a real title (not template code)
        for (const match of titleMatches) {
          const extractedTitle = match.replace(/^-->/, '').replace(/<!--$/, '').trim();
          console.log("Checking potential title:", extractedTitle);
          
          // Check if it looks like a reasonable title
          if (extractedTitle.length > 0 && 
              extractedTitle.length < 100 && 
              !extractedTitle.includes('{{') && 
              !extractedTitle.includes('}}') &&
              !extractedTitle.includes('get_web_data') &&
              !extractedTitle.includes('SERVER') &&
              !extractedTitle.includes('api.php')) {
            title = extractedTitle;
            console.log("Found valid title:", title);
            break;
          }
        }
      }
      
      if (title === "Featured Article") {
        console.warn("Could not extract a valid title from the template");
      }
      
      const imageMatch = /\[\[File:([^|\]]+)/.exec(templateContent);
      const imageFileName = imageMatch?.[1]?.trim();
      let summary = '';
      
      // Since we have the title from the arrow format, make a direct API call to get the page content
      if (title && title !== "Featured Article") {
        console.log('Making direct API call for title:', title);
        const apiUrl = `https://ixwiki.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=${encodeURIComponent(title)}`;
        console.log('API URL:', apiUrl);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const resp = await fetch(apiUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'IxStats-Builder',
              'Accept': 'application/json, text/plain, */*'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!resp.ok) {
            console.warn(`API request failed with status ${resp.status}: ${resp.statusText}`);
            // Don't throw error, just use fallback summary
            summary = `Discover the fascinating world of ${title}. This featured article showcases the rich history, culture, and achievements that make this topic noteworthy. Explore the detailed information and insights available on IxWiki.`;
          } else {
            const contentType = resp.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await resp.json();
              console.log('API response received:', data);
              
              if (data?.query?.pages) {
                const pages = data.query.pages;
                const pageIds = Object.keys(pages);
                if (pageIds.length > 0) {
                  const pageId = pageIds[0];
                  const page = pages[pageId as keyof typeof pages];
                
                  if (page && !page.missing && page.extract) {
                    summary = page.extract;
                    console.log('Successfully extracted summary:', summary.substring(0, 100) + '...');
                  } else if (page?.missing) {
                    console.warn('Page not found:', title);
                    summary = `The article "${title}" could not be found. This featured article showcases the rich history, culture, and achievements that make this topic noteworthy.`;
                  }
                }
              }
            } else {
              // Handle non-JSON responses
              const text = await resp.text();
              if (text.length > 0) {
                summary = text.substring(0, 500) + (text.length > 500 ? '...' : '');
              }
            }
          }
        } catch (err) {
          console.warn('Error fetching summary from API:', err);
          // Use fallback summary instead of throwing
          summary = `Discover the fascinating world of ${title}. This featured article showcases the rich history, culture, and achievements that make this topic noteworthy. Explore the detailed information and insights available on IxWiki.`;
        }
      } else {
        console.warn('No valid title found for API call.');
      }
      
      // If we still don't have a summary, create a fallback based on available information
      if (!summary || summary.trim().length === 0) {
        console.log('Creating fallback summary for:', title);
        summary = `Discover the fascinating world of ${title}. This featured article showcases the rich history, culture, and achievements that make this topic noteworthy. Explore the detailed information and insights available on IxWiki.`;
      }
      
              // Ensure we have a valid summary
        if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
          // Try to extract a better title from the template content
          let betterTitle = title;
          const titleInTemplate = /titles\s*=\s*([^|\n\r&]+)/i.exec(templateContent);
          if (titleInTemplate?.[1]) {
            const extractedTitle = titleInTemplate[1].trim();
            if (extractedTitle && extractedTitle !== '<!--') {
              betterTitle = extractedTitle;
              console.log("Extracted better title from template:", betterTitle);
            }
          }
          
          summary = `Discover the fascinating world of ${betterTitle}. This featured article showcases the rich history, culture, and achievements that make this topic noteworthy. Explore the detailed information and insights available on IxWiki.`;
        }
      
      // Clean up the summary text
      summary = summary.replace(/\s+/g, ' ').trim();
      if (summary.length > 300) {
        summary = summary.substring(0, 300) + '...';
      }
      
      const articleUrl = `https://ixwiki.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      const imageUrl = imageFileName ? `https://ixwiki.com/wiki/Special:Filepath/${encodeURIComponent(imageFileName)}` : undefined;
      
      console.log("Extracted data:", { title, imageFileName, articleUrl, summaryLength: summary.length });
      
      return {
        title,
        description: summary,
        imageUrl,
        articleUrl,
        category: "Featured",
        lastUpdated: new Date().toLocaleDateString(),
      };
    } catch (error) {
      console.error("Error extracting featured article data:", error);
      // Return a fallback instead of null
      return {
        title: "Featured Article",
        description: "Discover today's featured article from the wiki.",
        articleUrl: "https://ixwiki.com/wiki/Main_Page",
        category: "Featured",
        lastUpdated: new Date().toLocaleDateString(),
      };
    }
  };

  useEffect(() => {
    fetchFeaturedArticle();
  }, []);

  const handleRefresh = () => {
    fetchFeaturedArticle();
  };

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Featured Article
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no data, show a simple static featured article
  if (!articleData || !htmlContent) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Featured Article
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm">
              <h3 className="font-semibold text-lg mb-2">
                <a
                  href="https://ixwiki.com/wiki/Anglasweorċ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Anglasweorċ
                </a>
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                The Anglasweorċ (literally "English Work") is a series of fortifications that were built across the historical western borders of medieval Avonia as protection against various Gothic peoples. While its primary function was as a military defense, the Anglasweorċ more commonly served as a form of border control and customs regulation.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Badge variant="outline" className="text-xs">Featured</Badge>
              <a
                href="https://ixwiki.com/wiki/Anglasweorċ"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View Article
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }



  return (
    <Card
      className={cn("w-full min-w-0 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl group/card", className)}
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: `
          0 4px 16px rgba(0, 0, 0, 0.1),
          0 1px 4px rgba(0, 0, 0, 0.05),
          0 0 0 1px rgba(59, 130, 246, 0.1)
        `,
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500 group-hover/card:text-blue-400 transition-colors" />
          Featured Article
      
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 max-w-full">
        {htmlContent ? (
          <div className="space-y-4 min-w-0 max-w-full">
            {/* Display the rendered HTML content */}
            <div
              className="text-sm leading-relaxed [&_*]:break-words [&_*]:overflow-wrap-break-word [&_*]:hyphens-auto [&_*]:max-w-full"
              style={{
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                hyphens: 'auto',
                maxWidth: '100%',
                width: '100%'
              }}
              // SECURITY: Sanitize wiki content to prevent XSS from external data
              dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(htmlContent) }}
            />
            
            {/* Additional controls */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                {articleData?.category && (
                  <Badge variant="outline" className="text-xs">
                    {articleData.category}
                  </Badge>
                )}
                {lastFetch && (
                  <span className="text-xs text-muted-foreground">
                    Updated {lastFetch.toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="p-1 text-muted-foreground hover:text-foreground transition-all duration-300 hover:scale-110 hover:rotate-180"
                  title="Refresh featured article"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {articleData?.articleUrl && (
                  <a
                    href={articleData.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline transition-all duration-300 hover:scale-105"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Article
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No featured article content available</p>
            <p className="text-xs mb-4">The template was found but contains no content.</p>
            <div className="space-y-2 text-xs text-left bg-muted p-4 rounded-lg">
              <p><strong>Template found:</strong> Template:Home/Featured article</p>
              <p><strong>Status:</strong> Empty or invalid content</p>
              <p><strong>Next steps:</strong> Create or update the template on the wiki</p>
            </div>
            <button
              onClick={handleRefresh}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 