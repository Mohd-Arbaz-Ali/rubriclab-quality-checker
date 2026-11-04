export type CriterionKind = 'explicit' | 'implicit'

export interface Criterion {
  id: string
  statement: string
  weight: number
  kind: CriterionKind
}

export type FindingRule =
  | 'no-criteria'
  | 'empty'
  | 'subjective'
  | 'mental-process'
  | 'outside-reference'
  | 'bundled'
  | 'duplicate'
  | 'zero-weight'
  | 'negative-share'

export type FindingCategory = 'completeness' | 'wording' | 'measurability' | 'references' | 'structure' | 'weights'

export interface RubricFinding {
  id: string
  rule: FindingRule
  category: FindingCategory
  criterionIds: string[]
  title: string
  message: string
  suggestion: string
  excerpt?: string
  badge: string
}

export interface WeightSummary {
  positive: number
  negative: number
  absoluteTotal: number
  negativeShare: number
  zeroCount: number
}

export const RUBRIC_DISCLAIMER = 'heuristic suggestions, not a grading verdict'

export const SAMPLE_TASK_PROMPT =
  'Run a 5K and review the pace data below. Write a short reflection on your pacing strategy and what you might change next time. Use the split table to compare your start and finish, and include one visualization of your pace.'

export const SAMPLE_CRITERIA: Criterion[] = [
  { id: 'sample-1', statement: 'Names the fastest kilometer split and cites the matching value from the supplied run data.', weight: 25, kind: 'explicit' },
  { id: 'sample-2', statement: 'Calculates the mean pace from five kilometer splits, rounded to the nearest second per kilometer.', weight: 20, kind: 'explicit' },
  { id: 'sample-3', statement: 'Uses an appropriate chart to compare the starting and finishing pace.', weight: 15, kind: 'implicit' },
  { id: 'sample-4', statement: 'The reflection is good and clearly demonstrates that the runner understands why their pace changed.', weight: 0, kind: 'implicit' },
  { id: 'sample-5', statement: 'Considers how weather affected the result, as above.', weight: -20, kind: 'implicit' },
  { id: 'sample-6', statement: 'Names the fastest kilometer split and cites the matching value from the supplied run data.', weight: -20, kind: 'explicit' },
]

export function createCriterion(): Criterion {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `criterion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { id, statement: '', weight: 0, kind: 'explicit' }
}

export function getWeightSummary(criteria: Criterion[]): WeightSummary {
  const positive = criteria.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
  const negative = criteria.reduce((sum, row) => sum + Math.min(0, row.weight), 0)
  const absoluteTotal = positive + Math.abs(negative)
  return {
    positive,
    negative,
    absoluteTotal,
    negativeShare: absoluteTotal ? Math.abs(negative) / absoluteTotal : 0,
    zeroCount: criteria.filter((row) => row.weight === 0).length,
  }
}

export function analyzeRubric(criteria: Criterion[]): RubricFinding[] {
  const findings: RubricFinding[] = []
  const add = (finding: RubricFinding) => findings.push(finding)

  if (criteria.length === 0) {
    add({ id: 'no-criteria', rule: 'no-criteria', category: 'completeness', criterionIds: [], title: 'No criteria to review', message: 'This rubric has no criterion rows yet.', suggestion: 'Add a criterion, then run the review again.', badge: 'No criteria' })
  }

  for (const row of criteria) {
    const text = row.statement.trim()
    if (!text) {
      add({ id: `empty-${row.id}`, rule: 'empty', category: 'completeness', criterionIds: [row.id], title: 'Empty criterion', message: 'This row has no wording to evaluate or score.', suggestion: 'Write one observable expectation, or remove the unused row.', badge: 'Empty' })
    } else {
      const vague = [...new Set(text.match(/\b(?:good|appropriate|reasonable|thorough|clearly)\b/gi) ?? [])]
      if (vague.length) {
        add({ id: `subjective-${row.id}`, rule: 'subjective', category: 'wording', criterionIds: [row.id], title: 'Vague or subjective wording', message: `Found ${vague.map((word) => `“${word.toLowerCase()}”`).join(', ')}; reviewers may interpret these differently.`, suggestion: 'Replace the judgment word with an observable description or threshold.', excerpt: text, badge: 'Vague wording' })
      }

      const mental = [
        /\bconsider(?:ed|s|ing)?\b/i.test(text) && 'consider',
        /\bunderstand(?:s|ed|ing)?\b/i.test(text) && 'understand',
        /\bthought\s+about\b/i.test(text) && 'thought about',
      ].filter(Boolean)
      if (mental.length) {
        add({ id: `mental-${row.id}`, rule: 'mental-process', category: 'measurability', criterionIds: [row.id], title: 'Mental-process wording', message: `“${mental.join('” and “')}” describe internal thinking that may not be directly observable.`, suggestion: 'Name the evidence a reviewer can see, such as a calculation, citation, or explanation.', excerpt: text, badge: 'Mental process' })
      }

      if (/\b(?:as\s+above|mentioned\s+in\s+(?:the\s+)?prompt)\b/i.test(text)) {
        add({ id: `reference-${row.id}`, rule: 'outside-reference', category: 'references', criterionIds: [row.id], title: 'Context-dependent reference', message: 'This row points to other text instead of naming the needed context.', suggestion: 'Restate the relevant condition or evidence in this criterion.', excerpt: text, badge: 'Outside reference' })
      }

      if (/\b(?:and|also)\b/i.test(text)) {
        add({ id: `bundle-${row.id}`, rule: 'bundled', category: 'structure', criterionIds: [row.id], title: 'Possible bundled checks', message: '“And” or “also” can connect separate outcomes; the connector alone does not prove a problem.', suggestion: 'Check whether each side can be judged independently. If so, consider splitting it.', excerpt: text, badge: 'Possible bundle' })
      }
    }

    if (row.weight === 0) {
      add({ id: `zero-${row.id}`, rule: 'zero-weight', category: 'weights', criterionIds: [row.id], title: 'Zero-weight criterion', message: 'This row does not contribute points to the rubric total.', suggestion: 'Assign a non-zero weight if it should affect scoring, or remove the row.', excerpt: text || undefined, badge: 'Zero weight' })
    }
  }

  const duplicates = new Map<string, Criterion[]>()
  for (const row of criteria) {
    const normalized = row.statement.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
    if (normalized) duplicates.set(normalized, [...(duplicates.get(normalized) ?? []), row])
  }
  for (const rows of duplicates.values()) {
    if (rows.length < 2) continue
    add({ id: `duplicate-${rows.map((row) => row.id).sort().join('-')}`, rule: 'duplicate', category: 'structure', criterionIds: rows.map((row) => row.id), title: 'Duplicate criterion wording', message: 'These rows match after case, punctuation, and spacing are normalized.', suggestion: 'Keep one row or make the scoring purpose and evidence distinct.', excerpt: rows[0]?.statement, badge: 'Possible duplicate' })
  }

  const weights = getWeightSummary(criteria)
  if (weights.absoluteTotal > 0 && weights.negativeShare > 0.35) {
    add({ id: 'negative-share', rule: 'negative-share', category: 'weights', criterionIds: [], title: 'Negative weights exceed 35%', message: `Negative weights make up ${Math.round(weights.negativeShare * 100)}% of all absolute weight points.`, suggestion: 'Review each negative value and rebalance if penalties dominate the rubric’s intended purpose.', badge: 'Weight balance' })
  }

  return findings
}
