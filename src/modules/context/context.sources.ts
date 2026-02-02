/**
 * Context Source Collectors
 * Individual functions for gathering signals from specific sources
 * 
 * V1: Basic implementations with stubs for future expansion
 */

import { logger } from '../../utils/logger';

export interface WebsiteSignals {
  exists: boolean;
  description?: string;
  contentLength?: number;
}

/**
 * Gather signals from company website
 * 
 * V1: Basic existence check and content fetch
 * Future: Parse structured data, check SSL, analyze content quality
 */
export async function gatherWebsiteSignals(domain: string): Promise<WebsiteSignals> {
  // Normalize domain (remove protocol if present)
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${normalizedDomain}`;

  logger.debug('Gathering website signals', { domain, url });

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ContextGrade/1.0 (Decision Intelligence Bot)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Website not accessible', {
        domain,
        status: response.status,
      });
      return { exists: false };
    }

    const html = await response.text();
    const contentLength = html.length;

    // Extract description from meta tags or first paragraph
    let description: string | undefined;

    // Try meta description
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDescMatch) {
      description = metaDescMatch[1].trim();
    }

    // Try Open Graph description
    if (!description) {
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (ogDescMatch) {
        description = ogDescMatch[1].trim();
      }
    }

    // Try to extract from first <p> tag
    if (!description) {
      const firstPMatch = html.match(/<p[^>]*>([^<]+)</i);
      if (firstPMatch) {
        description = firstPMatch[1].trim().substring(0, 300);
      }
    }

    return {
      exists: true,
      description,
      contentLength,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Website fetch timeout', { domain });
    } else {
      logger.warn('Error fetching website', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { exists: false };
  }
}

/**
 * Gather signals from Google search (stub)
 * 
 * V1: Returns placeholder
 * Future: Use Google Custom Search API or scraping (with legal compliance)
 */
export async function gatherSearchSignals(companyName: string): Promise<{
  sentiment?: 'positive' | 'neutral' | 'negative';
  snippets?: string[];
}> {
  logger.debug('Gathering search signals (stub)', { companyName });
  
  // TODO: Implement Google Custom Search API integration
  return {
    sentiment: 'neutral',
    snippets: [],
  };
}

/**
 * Gather signals from Reddit (stub)
 * 
 * V1: Returns placeholder
 * Future: Use Reddit API to search for company mentions
 */
export async function gatherRedditSignals(companyName: string): Promise<{
  mentions: number;
  complaints: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}> {
  logger.debug('Gathering Reddit signals (stub)', { companyName });
  
  // TODO: Implement Reddit API integration
  return {
    mentions: 0,
    complaints: 0,
    sentiment: 'neutral',
  };
}

/**
 * Gather signals from Twitter/X (stub)
 * 
 * V1: Returns placeholder
 * Future: Use Twitter API v2 to search for company mentions
 */
export async function gatherTwitterSignals(companyName: string): Promise<{
  mentions: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}> {
  logger.debug('Gathering Twitter signals (stub)', { companyName });
  
  // TODO: Implement Twitter API integration
  return {
    mentions: 0,
    sentiment: 'neutral',
  };
}
