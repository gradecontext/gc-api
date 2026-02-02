/**
 * Context Gathering Service
 * Collects signals from external sources to inform decisions
 * 
 * V1 Scope: Basic signals only (website, search snippets, placeholders)
 * Future: Reddit, X/Twitter, G2, Trustpilot, financial APIs
 */

import { logger } from '../../utils/logger';
import { gatherWebsiteSignals } from './context.sources';

export interface CompanyInfo {
  name: string;
  domain?: string;
  industry?: string;
  country?: string;
}

export interface ContextSignals {
  website: {
    exists: boolean;
    description?: string;
    contentLength?: number;
  };
  search: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    snippets?: string[];
  };
  reddit?: {
    mentions: number;
    complaints: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
  twitter?: {
    mentions: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
  g2?: {
    rating?: number;
    reviews?: number;
  };
  trustpilot?: {
    rating?: number;
    reviews?: number;
  };
}

/**
 * Gather all available context signals for a company
 * 
 * This is the main entry point for context gathering.
 * It orchestrates multiple signal sources and aggregates results.
 */
export async function gatherContext(companyInfo: CompanyInfo): Promise<ContextSignals> {
  logger.info('Gathering context signals', { company: companyInfo.name });

  const signals: ContextSignals = {
    website: {
      exists: false,
    },
    search: {},
  };

  try {
    // Gather website signals (most reliable)
    if (companyInfo.domain) {
      const websiteSignals = await gatherWebsiteSignals(companyInfo.domain);
      signals.website = websiteSignals;
    } else {
      logger.warn('No domain provided, skipping website signals', {
        company: companyInfo.name,
      });
    }

    // TODO: Gather search snippet signals (stub for now)
    signals.search = {
      sentiment: 'neutral',
      snippets: [],
    };

    // TODO: Gather Reddit signals (placeholder)
    signals.reddit = {
      mentions: 0,
      complaints: 0,
      sentiment: 'neutral',
    };

    // TODO: Gather Twitter/X signals (placeholder)
    signals.twitter = {
      mentions: 0,
      sentiment: 'neutral',
    };

    // TODO: Gather G2 signals (for SaaS companies)
    // signals.g2 = await gatherG2Signals(companyInfo);

    // TODO: Gather Trustpilot signals
    // signals.trustpilot = await gatherTrustpilotSignals(companyInfo);

    logger.info('Context gathering complete', {
      company: companyInfo.name,
      signalsCollected: Object.keys(signals).length,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Error gathering context signals', {
      message: errorObj.message,
      stack: errorObj.stack,
      company: companyInfo.name,
    });
    // Never fail completely - return what we have
  }

  return signals;
}

/**
 * Extract key decision-relevant facts from signals
 * Transforms raw signals into structured reasoning points
 */
export function extractDecisionFacts(signals: ContextSignals): string[] {
  const facts: string[] = [];

  // Website signals
  if (!signals.website.exists) {
    facts.push('No website found or website inaccessible');
  } else if (signals.website.description) {
    facts.push(`Company description: ${signals.website.description.substring(0, 200)}`);
  }

  // Search sentiment
  if (signals.search.sentiment === 'negative') {
    facts.push('Negative sentiment detected in search results');
  }

  // Reddit complaints
  if (signals.reddit?.complaints && signals.reddit.complaints > 0) {
    facts.push(`${signals.reddit.complaints} complaint(s) found on Reddit`);
  }

  // Twitter sentiment
  if (signals.twitter?.sentiment === 'negative') {
    facts.push('Negative sentiment detected on Twitter/X');
  }

  // G2 rating
  if (signals.g2 && signals.g2.rating && signals.g2.rating < 3.0) {
    facts.push(`Low G2 rating: ${signals.g2.rating}/5`);
  }

  // Trustpilot rating
  if (signals.trustpilot && signals.trustpilot.rating && signals.trustpilot.rating < 3.0) {
    facts.push(`Low Trustpilot rating: ${signals.trustpilot.rating}/5`);
  }

  return facts;
}
