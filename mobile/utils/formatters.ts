/**
 * Utility functions for cleaning and formatting study content.
 */

export function isMeaningfulSection(section?: string): boolean {
  if (!section) return false;
  const s = section.trim().toLowerCase();
  if (!s || s === 'general' || s === 'untitled' || s === 'core concepts') return false;
  // Filters out "Page 9", "Page 9 Core Concepts", "Page 9 - Section", "Core Concepts", "Entire Document"
  if (/^page\s*\d+/i.test(s)) return false;
  if (/^source\s*#?\d+/i.test(s)) return false;
  if (s.includes('core concept')) return false;
  if (s.includes('entire document')) return false;
  return true;
}

export function sanitizeQuestionText(question: string): string {
  if (!question) return '';
  let cleaned = question
    // Remove leading "In Entire Document (...)," / "In Entire Document:" / "In the entire document,"
    .replace(/^in\s+(the\s+)?entire\s+document(\s*\([^)]*\))?[,:]?\s*/gi, '')
    .replace(/^according\s+to\s+(the\s+)?(entire\s+)?document(\s*\([^)]*\))?[,:]?\s*/gi, '')
    .replace(/^based\s+on\s+(the\s+)?(entire\s+)?document(\s*\([^)]*\))?[,:]?\s*/gi, '')
    .replace(/^throughout\s+(the\s+)?(entire\s+)?document(\s*\([^)]*\))?[,:]?\s*/gi, '')
    // Remove "in Entire Document (...)" or "in entire document" anywhere inside the question
    .replace(/\s+in\s+(the\s+)?entire\s+document(\s*\([^)]*\))?/gi, '')
    .replace(/\s+throughout\s+(the\s+)?entire\s+document(\s*\([^)]*\))?/gi, '')
    .replace(/\s+according\s+to\s+(the\s+)?entire\s+document(\s*\([^)]*\))?/gi, '')
    .replace(/\s+based\s+on\s+(the\s+)?entire\s+document(\s*\([^)]*\))?/gi, '')
    .replace(/\s+in\s+this\s+document(\s*\([^)]*\))?/gi, '')
    // Remove leaked "in Page X core concepts" / "in Page X" / "in core concepts"
    .replace(/\s+in\s+Page\s*\d+(\s+core\s+concepts?)?/gi, '')
    .replace(/\s+in\s+core\s+concepts?/gi, '')
    .replace(/\s+on\s+page\s*\d+/gi, '')
    .replace(/\s*\((see\s+)?page\s*\d+\)/gi, '')
    .replace(/\s+according\s+to\s+page\s*\d+/gi, '')
    .replace(/\s+in\s+General\s*([?:.])/gi, '$1')
    // Clean trailing "and", "or", "of", "in" before punctuation
    .replace(/(\b\w+)\s+(and|or|of|in|to|with)\s*([?:.])/gi, '$1$3')
    // Clean "tools and is/are" artifacts
    .replace(/(\b\w+)\s+and\s+is\b/gi, '$1 is')
    .replace(/(\b\w+)\s+and\s+are\b/gi, '$1 are')
    .trim();

  // Ensure first character is capitalized
  if (cleaned.length > 0) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  // Ensure sentence ends with question mark if interrogative
  if (
    /^(what|which|how|why|where|who|when)\b/i.test(cleaned) &&
    !cleaned.endsWith('?') &&
    !cleaned.endsWith(':') &&
    !cleaned.endsWith('.')
  ) {
    cleaned += '?';
  }

  return cleaned;
}
