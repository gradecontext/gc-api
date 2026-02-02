/**
 * Decision Proposal Agent
 * 
 * Generates AI-powered recommendations based on context signals and decision type.
 * 
 * Critical principles:
 * - Outputs STRICT JSON only (no markdown, no prose)
 * - Explicitly states uncertainty when confidence is low
 * - Never hallucinates facts
 * - Recommendations are advisory only (humans make final decisions)
 */

import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ContextSignals, extractDecisionFacts } from '../context/context.service';
import { DecisionType } from '../decisions/decisions.types';

export interface DecisionRecommendation {
  recommendation: 'approve' | 'approve_with_conditions' | 'reject' | 'review_manually';
  confidence: 'low' | 'medium' | 'high';
  rationale: string[];
  suggested_conditions?: string[];
}

/**
 * Generate decision recommendation using AI
 * 
 * If AI service is unavailable, returns a safe fallback recommendation
 */
export async function generateDecisionRecommendation(
  companyInfo: {
    name: string;
    domain?: string;
    industry?: string;
    country?: string;
  },
  signals: ContextSignals,
  decisionType: DecisionType,
  dealAmount?: number
): Promise<DecisionRecommendation> {
  logger.info('Generating AI decision recommendation', {
    company: companyInfo.name,
    decisionType,
  });

  // Extract structured facts from signals
  const facts = extractDecisionFacts(signals);

  // If no AI key configured, return fallback
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
    logger.warn('No AI API key configured, using fallback recommendation');
    return {
      recommendation: 'review_manually',
      confidence: 'low',
      rationale: ['AI service not configured. Manual review required.'],
    };
  }

  try {
    // Use OpenAI by default, Anthropic as fallback
    if (env.OPENAI_API_KEY) {
      return await generateWithOpenAI(companyInfo, facts, decisionType, dealAmount);
    } else if (env.ANTHROPIC_API_KEY) {
      // TODO: Implement Anthropic integration
      logger.warn('Anthropic API not yet implemented, using fallback');
      return getFallbackRecommendation(facts);
    }
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('AI recommendation generation failed', {
      message: errorObj.message,
      stack: errorObj.stack,
      company: companyInfo.name,
    });
    // Never fail completely - return safe fallback
    return getFallbackRecommendation(facts);
  }

  return getFallbackRecommendation(facts);
}

/**
 * Generate recommendation using OpenAI
 */
async function generateWithOpenAI(
  companyInfo: { name: string; domain?: string; industry?: string; country?: string },
  facts: string[],
  decisionType: DecisionType,
  dealAmount?: number
): Promise<DecisionRecommendation> {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are a decision intelligence agent for ContextGrade, a B2B SaaS tool that helps companies make onboarding, pricing, and trust decisions.

Your role:
- Analyze company context and provide recommendations
- Output ONLY valid JSON (no markdown, no prose, no explanations outside JSON)
- Be conservative when information is incomplete
- Explicitly state uncertainty in rationale

Decision Types:
- DISCOUNT: Should a discount be granted?
- ONBOARDING: Should this company be onboarded?
- PAYMENT_TERMS: What payment terms should be offered?

Recommendation values:
- "approve": Clear positive signals
- "approve_with_conditions": Positive but with safeguards
- "reject": Clear negative signals
- "review_manually": Insufficient information or conflicting signals

Output format (STRICT JSON only):
{
  "recommendation": "approve|approve_with_conditions|reject|review_manually",
  "confidence": "low|medium|high",
  "rationale": ["Reason 1", "Reason 2"],
  "suggested_conditions": ["Condition 1"] // only if recommendation is approve_with_conditions
}`;

  const userPrompt = `Company: ${companyInfo.name}
Domain: ${companyInfo.domain || 'Not provided'}
Industry: ${companyInfo.industry || 'Not provided'}
Country: ${companyInfo.country || 'Not provided'}
Decision Type: ${decisionType}
Deal Amount: ${dealAmount ? `$${dealAmount}` : 'Not provided'}

Context Signals:
${facts.length > 0 ? facts.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'No signals available'}

Provide your recommendation as JSON only (no markdown, no code blocks, just the JSON object).`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Cost-effective model, upgrade to gpt-4 if needed
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3, // Lower temperature for more consistent, factual output
    response_format: { type: 'json_object' }, // Force JSON output
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  // Parse JSON response
  let parsed: DecisionRecommendation;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    const parseErrorObj = parseError instanceof Error ? parseError : new Error(String(parseError));
    logger.error('Failed to parse AI response as JSON', {
      message: parseErrorObj.message,
      stack: parseErrorObj.stack,
      content,
    });
    throw new Error('Invalid JSON response from AI');
  }

  // Validate response structure
  if (
    !parsed.recommendation ||
    !parsed.confidence ||
    !Array.isArray(parsed.rationale)
  ) {
    throw new Error('Invalid recommendation structure');
  }

  // Normalize recommendation value
  const validRecommendations = ['approve', 'approve_with_conditions', 'reject', 'review_manually'];
  if (!validRecommendations.includes(parsed.recommendation)) {
    logger.warn('Invalid recommendation value, defaulting to review_manually', {
      received: parsed.recommendation,
    });
    parsed.recommendation = 'review_manually';
  }

  // Normalize confidence value
  const validConfidence = ['low', 'medium', 'high'];
  if (!validConfidence.includes(parsed.confidence)) {
    parsed.confidence = 'low';
  }

  logger.info('AI recommendation generated', {
    recommendation: parsed.recommendation,
    confidence: parsed.confidence,
  });

  return parsed;
}

/**
 * Fallback recommendation when AI is unavailable
 * Always defaults to manual review for safety
 */
function getFallbackRecommendation(facts: string[]): DecisionRecommendation {
  return {
    recommendation: 'review_manually',
    confidence: 'low',
    rationale: facts.length > 0
      ? ['Insufficient AI service availability. Manual review required.', ...facts]
      : ['Insufficient information available. Manual review required.'],
  };
}
