import { normalizeName, matchIngredient, calculateRecipeHash } from './NameNormalizer';

/**
 * Validation severity levels
 */
export const ValidationSeverity = {
  BLOCKER: 'BLOCKER',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * Validation issue types
 */
export const IssueType = {
  FINISHED_SKU_MISSING: 'FINISHED_SKU_MISSING',
  FINISHED_SKU_NOT_FOUND: 'FINISHED_SKU_NOT_FOUND',
  WEIGHT_NOT_1KG: 'WEIGHT_NOT_1KG',
  EMPTY_RECIPE: 'EMPTY_RECIPE',
  INGREDIENT_QTY_INVALID: 'INGREDIENT_QTY_INVALID',
  INGREDIENT_NOT_MAPPED: 'INGREDIENT_NOT_MAPPED',
  MULTIPLE_CONTAINS_MATCHES: 'MULTIPLE_CONTAINS_MATCHES',
  DUPLICATE_INGREDIENT_LINES: 'DUPLICATE_INGREDIENT_LINES_WITHOUT_PHASE',
  SUM_NOT_CLOSE_TO_1KG: 'SUM_NOT_CLOSE_TO_1KG',
  APPROVED_NOT_YES: 'APPROVED_FOR_PRODUCTION_NOT_YES',
  PHASE_MISSING: 'PHASE_MISSING',
  UNKNOWN_CATEGORY: 'UNKNOWN_CATEGORY_ON_CREATE',
  IDENTICAL_RECIPE_HASH: 'IDENTICAL_RECIPE_HASH',
  AUTO_MAPPED_LINES: 'AUTO_MAPPED_LINES_COUNT'
};

/**
 * Default validation configuration
 */
const DEFAULT_CONFIG = {
  strictMode: true,
  recipeTotalLowerBound: 0.98,
  recipeTotalUpperBound: 1.02,
  smallComponentThresholdKg: 0.0001,
  allowNonProductionApproved: false,
  allowPhaseMissing: true,
  autoCreateMissingIngredients: false
};

/**
 * Validate Metics import data
 */
export function validateMeticsImport(importData, config = DEFAULT_CONFIG) {
  const issues = [];
  const { strictMode } = config;

  // Extract header info
  const finishedSku = importData.finishedSku;
  const finishedName = importData.finishedName;
  const approvedForProduction = importData.approvedForProduction;
  const ingredients = importData.ingredients || [];
  const existingRecipeHash = importData.existingRecipeHash;

  // 1. FINISHED_SKU_MISSING
  if (!finishedSku || finishedSku.trim() === '') {
    issues.push({
      type: IssueType.FINISHED_SKU_MISSING,
      severity: ValidationSeverity.BLOCKER,
      message: 'Artikelnr för färdigvara saknas',
      canProceed: false
    });
    return { valid: false, issues, canProceed: false };
  }

  // 2. EMPTY_RECIPE
  if (!ingredients || ingredients.length === 0) {
    issues.push({
      type: IssueType.EMPTY_RECIPE,
      severity: ValidationSeverity.BLOCKER,
      message: 'Receptet är tomt - inga ingredienser',
      canProceed: false
    });
    return { valid: false, issues, canProceed: false };
  }

  // 3. Validate ingredient quantities
  let totalQuantity = 0;
  const seenIngredients = new Map();
  let autoMappedCount = 0;

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    
    // Quantity validation
    if (ing.quantity_kg == null || isNaN(ing.quantity_kg) || ing.quantity_kg <= 0) {
      issues.push({
        type: IssueType.INGREDIENT_QTY_INVALID,
        severity: ValidationSeverity.BLOCKER,
        message: `Rad ${i + 1}: Ogiltig mängd för "${ing.rawName}"`,
        line: i + 1,
        ingredient: ing.rawName,
        canProceed: false
      });
    } else {
      totalQuantity += ing.quantity_kg;
    }

    // Not mapped check
    if (!ing.matched || !ing.product) {
      if (ing.matchType === 'multiple_contains') {
        issues.push({
          type: IssueType.MULTIPLE_CONTAINS_MATCHES,
          severity: ValidationSeverity.BLOCKER,
          message: `Rad ${i + 1}: Flera möjliga matchningar för "${ing.rawName}"`,
          line: i + 1,
          ingredient: ing.rawName,
          matches: ing.multipleMatches,
          canProceed: false
        });
      } else {
        issues.push({
          type: IssueType.INGREDIENT_NOT_MAPPED,
          severity: ValidationSeverity.BLOCKER,
          message: `Rad ${i + 1}: Ingrediens "${ing.rawName}" kunde inte mappas`,
          line: i + 1,
          ingredient: ing.rawName,
          canProceed: false
        });
      }
    } else if (ing.confidence === 'high' && ing.matchType !== 'manual') {
      autoMappedCount++;
    }

    // Check for duplicates without phase
    if (ing.product) {
      const key = ing.product.sku;
      if (!ing.phase || ing.phase.trim() === '') {
        if (seenIngredients.has(key)) {
          issues.push({
            type: IssueType.DUPLICATE_INGREDIENT_LINES,
            severity: ValidationSeverity.BLOCKER,
            message: `Rad ${i + 1}: Dublettrad för "${ing.product.sku}" utan fasangivelse`,
            line: i + 1,
            ingredient: ing.rawName,
            sku: ing.product.sku,
            canProceed: false
          });
        } else {
          seenIngredients.set(key, i + 1);
        }
      }
    }

    // Phase missing warning
    if ((!ing.phase || ing.phase.trim() === '') && !config.allowPhaseMissing) {
      issues.push({
        type: IssueType.PHASE_MISSING,
        severity: ValidationSeverity.WARNING,
        message: `Rad ${i + 1}: Fas saknas för "${ing.rawName}"`,
        line: i + 1,
        ingredient: ing.rawName,
        canProceed: true
      });
    }
  }

  // 4. Sum not close to 1kg
  if (totalQuantity < config.recipeTotalLowerBound || totalQuantity > config.recipeTotalUpperBound) {
    issues.push({
      type: IssueType.SUM_NOT_CLOSE_TO_1KG,
      severity: strictMode ? ValidationSeverity.BLOCKER : ValidationSeverity.WARNING,
      message: `Receptets totalsumma är ${totalQuantity.toFixed(4)} kg (förväntat: 0.98-1.02 kg)`,
      total: totalQuantity,
      canProceed: !strictMode
    });
  }

  // 5. Approved for production
  if (approvedForProduction !== 'Ja' && !config.allowNonProductionApproved) {
    issues.push({
      type: IssueType.APPROVED_NOT_YES,
      severity: ValidationSeverity.WARNING,
      message: `Receptet är inte godkänt för produktion (värde: "${approvedForProduction}")`,
      canProceed: true
    });
  }

  // 6. Identical recipe hash
  if (existingRecipeHash && importData.newRecipeHash === existingRecipeHash) {
    issues.push({
      type: IssueType.IDENTICAL_RECIPE_HASH,
      severity: ValidationSeverity.INFO,
      message: 'Receptet är identiskt med befintlig version - föreslår avbryt',
      canProceed: true
    });
  }

  // 7. Auto-mapped lines count
  if (autoMappedCount > 0) {
    issues.push({
      type: IssueType.AUTO_MAPPED_LINES,
      severity: ValidationSeverity.INFO,
      message: `${autoMappedCount} ingrediens(er) auto-mappade med hög säkerhet`,
      count: autoMappedCount,
      canProceed: true
    });
  }

  // Determine if import can proceed
  const blockers = issues.filter(i => i.severity === ValidationSeverity.BLOCKER);
  const canProceed = blockers.length === 0;
  const valid = issues.length === 0;

  return {
    valid,
    canProceed,
    issues,
    stats: {
      totalIngredients: ingredients.length,
      autoMapped: autoMappedCount,
      totalQuantity,
      blockers: blockers.length,
      warnings: issues.filter(i => i.severity === ValidationSeverity.WARNING).length,
      infos: issues.filter(i => i.severity === ValidationSeverity.INFO).length
    }
  };
}

export default {
  validateMeticsImport,
  ValidationSeverity,
  IssueType,
  DEFAULT_CONFIG
};