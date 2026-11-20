/**
 * Robust Boolean Search Evaluator for Job Queries.
 *
 * Supports:
 * - AND, OR, NOT operators (case-insensitive)
 * - Parentheses grouping: (Frontend OR Backend) AND React
 * - Quoted exact phrases: "Software Engineer" NOT Senior
 * - Graceful fallback to fuzzy multi-keyword match
 */

export function parseAndEvaluateBooleanQuery(query, job) {
  if (!query || !query.trim()) return true;

  const q = query.trim();
  // Build searchable corpus for this job
  const textCorpus = [
    job.title || '',
    job.company || '',
    job.role || '',
    job.city || '',
    job.raw_location || '',
    job.experience || '',
    job.job_type || '',
    job.source || '',
  ].join(' ').toLowerCase();

  // Check if query contains any boolean syntax
  const hasBooleanOps = /\b(AND|OR|NOT)\b|[()"]/.test(q);

  if (!hasBooleanOps) {
    // Standard multi-keyword match (all words must appear)
    const keywords = q.toLowerCase().split(/\s+/).filter(Boolean);
    return keywords.every((kw) => textCorpus.includes(kw));
  }

  // Tokenize boolean expressions
  // Extracts: '(', ')', 'AND', 'OR', 'NOT', quoted phrases, or individual words
  const tokenRegex = /\(|\)|\bAND\b|\bOR\b|\bNOT\b|"[^"]+"|[^\s()]+/gi;
  const rawTokens = q.match(tokenRegex) || [];

  if (rawTokens.length === 0) return true;

  const jsTokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const tok = rawTokens[i];
    const upper = tok.toUpperCase();

    if (upper === 'AND') {
      jsTokens.push('&&');
    } else if (upper === 'OR') {
      jsTokens.push('||');
    } else if (upper === 'NOT') {
      jsTokens.push('!');
    } else if (tok === '(') {
      jsTokens.push('(');
    } else if (tok === ')') {
      jsTokens.push(')');
    } else {
      // If two terms are adjacent without an operator, insert implicit AND
      if (
        i > 0 &&
        !['&&', '||', '!', '('].includes(jsTokens[jsTokens.length - 1])
      ) {
        jsTokens.push('&&');
      }

      // Check phrase or term
      const cleanTerm = tok.replace(/^"|"$/g, '').toLowerCase().trim();
      if (!cleanTerm) {
        jsTokens.push('true');
      } else {
        const matches = textCorpus.includes(cleanTerm);
        jsTokens.push(matches ? 'true' : 'false');
      }
    }
  }

  try {
    const exprString = jsTokens.join(' ');
    // Whitelist check: only allow boolean literals and logic operators
    if (/^[&|!()truefals\s]+$/.test(exprString)) {
      // Safe execution
      const result = Function(`"use strict"; return Boolean(${exprString});`)();
      return Boolean(result);
    }
  } catch (err) {
    // Fallback if user is currently typing an incomplete expression e.g. "React AND ("
  }

  // Fallback if parsing expression fails: match any term
  const fallbackTerms = q
    .replace(/\b(AND|OR|NOT)\b|[()"]/gi, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (fallbackTerms.length === 0) return true;
  return fallbackTerms.some((t) => textCorpus.includes(t));
}
