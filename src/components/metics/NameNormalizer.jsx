/**
 * NORMALIZED-REGLER (NAMN-NORMALISERING)
 * Normaliserar ingrediensnamn från Metics för robust matchning
 */

export function normalizeName(inputString) {
  if (!inputString || typeof inputString !== 'string') {
    return '';
  }

  let normalized = inputString;

  // 1) Lowercase
  normalized = normalized.toLowerCase();

  // 2) Trim (leading/trailing spaces)
  normalized = normalized.trim();

  // 3) Remove trademark symbols
  normalized = normalized.replace(/[™®©]/g, '');

  // 4) Remove bracketed content (including brackets)
  normalized = normalized.replace(/\([^)]*\)/g, ''); // (...)
  normalized = normalized.replace(/\[[^\]]*\]/g, ''); // [...]
  normalized = normalized.replace(/\{[^}]*\}/g, ''); // {...}

  // 5) Remove punctuation/symbols
  normalized = normalized.replace(/[.,;:!?'"`´^~•·]/g, '');

  // 6) Replace slashes and pipes with space
  normalized = normalized.replace(/[/\\|]/g, ' ');

  // 7) Normalize separators to space
  normalized = normalized.replace(/[_\-–—]/g, ' ');

  // 8) Normalize decimal format (comma to period)
  normalized = normalized.replace(/(\d),(\d)/g, '$1.$2');

  // 9) Standardize units (optional - normalize common variations)
  normalized = normalized.replace(/\bkilo\b/g, 'kg');
  normalized = normalized.replace(/\bgram\b/g, 'g');
  normalized = normalized.replace(/\bliter\b/g, 'l');

  // 10) Collapse whitespace (multiple spaces/tabs to single space)
  normalized = normalized.replace(/\s+/g, ' ');

  // 11) Remove duplicate tokens
  const tokens = normalized.split(' ');
  const uniqueTokens = [];
  let lastToken = null;
  
  for (const token of tokens) {
    if (token !== lastToken && token.length > 0) {
      uniqueTokens.push(token);
      lastToken = token;
    }
  }
  
  normalized = uniqueTokens.join(' ');

  // 12) Final trim
  normalized = normalized.trim();

  return normalized;
}

/**
 * Match ingredient name against products with confidence scoring
 * @param {string} rawName - Original ingredient name
 * @param {Array} products - Array of Product entities
 * @param {Array} mappingRules - Existing mapping rules
 * @param {Array} aliases - Ingredient aliases
 * @returns {Object} Match result with confidence and type
 */
export function matchIngredient(rawName, products, mappingRules = [], aliases = []) {
  if (!rawName || !products || products.length === 0) {
    return { matched: false, confidence: null, matchType: null };
  }

  const normalized = normalizeName(rawName);

  // 1) EXACT RAW MATCH (case-insensitive)
  const exactRawMatch = products.find(p => 
    p.name?.toLowerCase() === rawName.toLowerCase() ||
    p.sku?.toLowerCase() === rawName.toLowerCase()
  );
  
  if (exactRawMatch) {
    return {
      matched: true,
      product: exactRawMatch,
      confidence: 'high',
      matchType: 'exact_raw',
      requiresReview: false,
      normalizedName: normalized
    };
  }

  // 2) NORMALIZED MATCH
  const normalizedMatch = products.find(p => 
    normalizeName(p.name) === normalized ||
    normalizeName(p.sku) === normalized
  );
  
  if (normalizedMatch) {
    return {
      matched: true,
      product: normalizedMatch,
      confidence: 'high',
      matchType: 'normalized',
      requiresReview: false,
      normalizedName: normalized
    };
  }

  // 3) ALIAS MATCH
  if (aliases && aliases.length > 0) {
    const aliasMatch = aliases.find(a => 
      a.alias_normalized === normalized && a.active
    );
    
    if (aliasMatch) {
      const product = products.find(p => p.id === aliasMatch.mapped_product_id);
      if (product) {
        return {
          matched: true,
          product,
          confidence: 'high',
          matchType: 'alias',
          requiresReview: false,
          normalizedName: normalized,
          aliasUsed: aliasMatch.alias_normalized
        };
      }
    }
  }

  // 4) CONTAINS MATCH (only if unique)
  const containsMatches = products.filter(p => {
    const productNameNorm = normalizeName(p.name);
    const productSkuNorm = normalizeName(p.sku);
    return productNameNorm.includes(normalized) || 
           normalized.includes(productNameNorm) ||
           productSkuNorm.includes(normalized) ||
           normalized.includes(productSkuNorm);
  });

  if (containsMatches.length === 1) {
    return {
      matched: true,
      product: containsMatches[0],
      confidence: 'medium',
      matchType: 'contains',
      requiresReview: true,
      normalizedName: normalized
    };
  }

  if (containsMatches.length > 1) {
    return {
      matched: false,
      confidence: null,
      matchType: 'multiple_contains',
      requiresReview: true,
      normalizedName: normalized,
      multipleMatches: containsMatches.map(p => ({ id: p.id, sku: p.sku, name: p.name }))
    };
  }

  // No match found
  return {
    matched: false,
    confidence: null,
    matchType: null,
    requiresReview: true,
    normalizedName: normalized
  };
}

/**
 * Calculate hash for recipe comparison
 */
export function calculateRecipeHash(ingredients) {
  const sorted = [...ingredients].sort((a, b) => 
    (a.sku || '').localeCompare(b.sku || '')
  );
  const content = sorted.map(i => 
    `${i.sku}:${i.quantity_kg}`
  ).join('|');
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export default {
  normalizeName,
  matchIngredient,
  calculateRecipeHash
};