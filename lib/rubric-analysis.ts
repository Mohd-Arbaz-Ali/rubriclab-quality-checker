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

export type FindingCategory =
  | 'completeness'
  | 'objectivity'
  | 'measurability'
  | 'references'
  | 'structure'
  | 'weighting'

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
  positiveWeightSum: number
  negativeWeightSum: number
  absoluteWeightTotal: number
  negativeWeightShare: number
  zeroWeightCount: number
}

export type ChecklistStatus = 'pending' | 'review' | 'clear'

export interface QualityCheck {
  id: 'atomic' | 'self-contained' | 'objective' | 'verifiable'
  label: string
  description: string
  status: ChecklistStatus
}

export interface ExportReport {
  tool: 'RubricLab'
  disclaimer: typeof RUBRIC_DISCLAIMER
  taskPrompt: string
  criteria: Criterion[]
  analysis: {
    status: 'current' | 'pending'
    criteriaCount: number
    warningCount: number | null
    positiveWeightSum: number
    negativeWeightSum: number
    absoluteWeightTotal: number
    negativeWeightShare: number
    negativeWeightShareLimit: 0.35
    zeroWeightCount: number
    findings: RubricFinding[]
    qualityChecklist: QualityCheck[]
  }
}

export const RUBRIC_DISCLAIMER = 'heuristic suggestions, not a grading verdict'

export const SAMPLE_TASK_PROMPT =
  'Run a 5K and review the pace data below. Write a short reflection on your pacing strategy and what you might change next time. Use the split table to compare your start and finish, and include one visualization of your pace.'

export const SAMPLE_CRITERIA: Criterion[] = [
  {
    id: 'sample-criterion-1',
    statement:
      'Names the fastest kilometer split and cites the matching value from the supplied run data.',
    weight: 25,
    kind: 'explicit',
  },
  {
    id: 'sample-criterion-2',
    statement:
      'Calculates the mean pace from five kilometer splits, rounded to the nearest second per kilometer.',
    weight: 20,
    kind: 'explicit',
  },
  {
    id: 'sample-criterion-3',
    statement:
      'Uses an appropriate chart to compare the starting and finishing pace.',
    weight: 15,
    kind: 'implicit',
  },
  {
    id: 'sample-criterion-4',
    statement:
      'The reflection is good and clearly demonstrates that the runner understands why their pace changed.',
    weight: 0,
    kind: 'implicit',
  },
  {
    id: 'sample-criterion-5',
    statement: 'Considers how weather affected the result, as above.',
    weight: -20,
    kind: 'implicit',
  },
  {
    id: 'sample-criterion-6',
    statement:
      'Names the fastest kilometer split and cites the matching value from the supplied run data.',
    weight: -20,
    kind: 'explicit',
  },
]

const SUBJECTIVE_TERMS = ['good', 'appropriate', 'reasonable', 'thorough', 'clearly']
const MENTAL_PROCESS_PATTERNS = [
  { label: 'consider', pattern: /\bconsider(?:ed|s|ing)?\b/i },
  { label: 'understand', pattern: /\bunderstand(?:s|ed|ing)?\b/i },
  { label: 'thought about', pattern: /\bthought\s+about\b/i },
]
const OUTSIDE_REFERENCE_PATTERN =
  /\b(?:as\s+above|mentioned\s+in\s+(?:the\s+)?prompt)\b/i
const BUNDLED_LANGUAGE_PATTERN = /\b(?:and|also)\b/i

export function createCriterion(): Criterion {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `criterion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return { id, statement: '', weight: 0, kind: 'explicit' }
}

export function analyzeRubric(criteria: Criterion[]): RubricFinding[] {
  const findings: RubricFinding[] = []

  if (criteria.length === 0) {
    findings.push({
      id: 'no-criteria',
      rule: 'no-criteria',
      category: 'completeness',
      criterionIds: [],
      title: 'No criteria to review',
      message: 'This rubric has no criterion rows yet, so there is nothing to inspect.',
      suggestion: 'Add at least one criterion, then run the review again.',
      badge: 'No criteria',
    })
  }

  for (const criterion of criteria) {
    const statement = criterion.statement.trim()

    if (!statement) {
      findings.push({
        id: `empty-${criterion.id}`,
        rule: 'empty',
        category: 'completeness',
        criterionIds: [criterion.id],
        title: 'Empty criterion',
        message: 'This row has no wording to evaluate or score.',
        suggestion: 'Write one observable expectation, or remove this unused row.',
        badge: 'Empty statement',
      })
    } else {
      const subjectiveHits = SUBJECTIVE_TERMS.filter((term) =>
        new RegExp(`\\b${term}\\b`, 'i').test(statement),
      )

      if (subjectiveHits.length > 0) {
        findings.push({
          id: `subjective-${criterion.id}`,
          rule: 'subjective',
          category: 'objectivity',
          criterionIds: [criterion.id],
          title: 'Subjective wording',
          message: `The word${subjectiveHits.length > 1 ? 's' : ''} ${subjectiveHits.map((term) => `“${term}”`).join(', ')} may leave room for different interpretations.`,
          suggestion:
            'Replace the judgment word with an observable description, example, or threshold that reviewers can apply consistently.',
          excerpt: statement,
          badge: 'Subjective wording',
        })
      }

      const mentalProcessHits = MENTAL_PROCESS_PATTERNS.filter(({ pattern }) =>
        pattern.test(statement),
      ).map(({ label }) => label)

      if (mentalProcessHits.length > 0) {
        findings.push({
          id: `mental-process-${criterion.id}`,
          rule: 'mental-process',
          category: 'measurability',
          criterionIds: [criterion.id],
          title: 'Mental-process language',
          message: `The phrase${mentalProcessHits.length > 1 ? 's' : ''} ${mentalProcessHits.map((term) => `“${term}”`).join(', ')} describe${mentalProcessHits.length > 1 ? '' : 's'} an internal thought that may not be directly observable.`,
          suggestion:
            'Name the evidence a reviewer can see, such as a calculation, cited detail, explanation, or revision.',
          excerpt: statement,
          badge: 'Mental-process wording',
        })
      }

      if (OUTSIDE_REFERENCE_PATTERN.test(statement)) {
        findings.push({
          id: `outside-reference-${criterion.id}`,
          rule: 'outside-reference',
          category: 'references',
          criterionIds: [criterion.id],
          title: 'Context-dependent reference',
          message:
            'This wording points outside the criterion instead of naming the information needed to interpret it.',
          suggestion:
            'Restate the relevant condition or evidence in this row so it can be understood on its own.',
          excerpt: statement,
          badge: 'Outside reference',
        })
      }

      if (BUNDLED_LANGUAGE_PATTERN.test(statement)) {
        findings.push({
          id: `bundled-${criterion.id}`,
          rule: 'bundled',
          category: 'structure',
          criterionIds: [criterion.id],
          title: 'Possible bundled checks',
          message:
            '“And” or “also” can connect separate outcomes. This is a prompt to inspect the sentence; the connector alone does not prove the criterion is bundled.',
          suggestion:
            'Check whether each side can be judged independently. If so, consider giving each outcome its own criterion or clear scoring rule.',
          excerpt: statement,
          badge: 'Possible bundle',
        })
      }
    }

    if (criterion.weight === 0) {
      findings.push({
        id: `zero-weight-${criterion.id}`,
        rule: 'zero-weight',
        category: 'weighting',
        criterionIds: [criterion.id],
        title: 'Zero-weight criterion',
        message:
          'This row currently contributes no points to the rubric total, even though it remains visible as a criterion.',
        suggestion:
          'Assign a non-zero weight if this expectation should affect the score, or remove it if it should not.',
        excerpt: statement || undefined,
        badge: 'Zero weight',
      })
    }
  }

  const duplicateGroups = new Map<string, Criterion[]>()

  for (const criterion of criteria) {
    const normalized = normalizeStatement(criterion.statement)
    if (!normalized) continue

    const group = duplicateGroups.get(normalized) ?? []
    group.push(criterion)
    duplicateGroups.set(normalized, group)
  }

  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue

    const criterionIds = group.map(({ id }) => id)
    findings.push({
      id: `duplicate-${criterionIds.slice().sort().join('-')}`,
      rule: 'duplicate',
      category: 'structure',
      criterionIds,
      title: 'Duplicate criterion wording',
      message:
        'These rows match after case, punctuation, and spacing are normalized, so they may reward the same evidence twice.',
      suggestion:
        'Keep one row or rewrite the rows so each measures a distinct outcome with distinct evidence.',
      excerpt: group[0]?.statement,
      badge: 'Possible duplicate',
    })
  }

  const weightSummary = getWeightSummary(criteria)

  if (weightSummary.absoluteWeightTotal > 0 && weightSummary.negativeWeightShare > 0.35) {
    findings.push({
      id: 'negative-weight-share',
      rule: 'negative-share',
      category: 'weighting',
      criterionIds: [],
      title: 'Negative weights exceed 35% of the total',
      message: `Negative weights make up ${Math.round(weightSummary.negativeWeightShare * 100)}% of all absolute weight points. A high share can make penalties dominate the rubric, depending on its purpose.`,
      suggestion:
        'Review the intent and sign of each negative value, then rebalance if penalties are carrying more influence than intended.',
      badge: 'Weight balance',
    })
  }

  return findings
}

export function getWeightSummary(criteria: Criterion[]): WeightSummary {
  const positiveWeightSum = criteria.reduce(
    (sum, criterion) => sum + (criterion.weight > 0 ? criterion.weight : 0),
    0,
  )
  const negativeWeightSum = criteria.reduce(
    (sum, criterion) => sum + (criterion.weight < 0 ? criterion.weight : 0),
    0,
  )
  const absoluteWeightTotal = positiveWeightSum + Math.abs(negativeWeightSum)

  return {
    positiveWeightSum,
    negativeWeightSum,
    absoluteWeightTotal,
    negativeWeightShare:
      absoluteWeightTotal === 0 ? 0 : Math.abs(negativeWeightSum) / absoluteWeightTotal,
    zeroWeightCount: criteria.filter((criterion) => criterion.weight === 0).length,
  }
}

export function buildQualityChecklist(
  findings: RubricFinding[],
  analysisIsCurrent: boolean,
): QualityCheck[] {
  const hasNoCriteria = findings.some((finding) => finding.rule === 'no-criteria')
  const hasEmptyCriterion = findings.some((finding) => finding.rule === 'empty')
  const isIncomplete = hasNoCriteria || hasEmptyCriterion

  const checks: Omit<QualityCheck, 'status'>[] = [
    {
      id: 'atomic',
      label: 'Atomic',
      description: 'One independently scorable outcome per criterion.',
    },
    {
      id: 'self-contained',
      label: 'Self-contained',
      description: 'Each row carries the context it needs to make sense.',
    },
    {
      id: 'objective',
      label: 'Objective',
      description: 'Wording leaves less room for reviewer interpretation.',
    },
    {
      id: 'verifiable',
      label: 'Verifiable',
      description: 'The expectation points to evidence a reviewer can observe.',
    },
  ]

  return checks.map((check) => {
    if (!analysisIsCurrent) return { ...check, status: 'pending' }

    const hasSignal = (() => {
      if (isIncomplete) return true
      switch (check.id) {
        case 'atomic':
          return findings.some((finding) => finding.rule === 'bundled')
        case 'self-contained':
          return findings.some((finding) => finding.rule === 'outside-reference')
        case 'objective':
          return findings.some((finding) => finding.rule === 'subjective')
        case 'verifiable':
          return findings.some((finding) => finding.rule === 'mental-process')
      }
    })()

    return { ...check, status: hasSignal ? 'review' : 'clear' }
  })
}

function normalizeStatement(statement: string): string {
  return statement
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
