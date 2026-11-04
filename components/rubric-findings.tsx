'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import type {
  ChecklistStatus,
  ExportReport,
  FindingCategory,
  RubricFinding,
} from '@/lib/rubric-analysis'
import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clipboard,
  Download,
  Info,
  Scale,
} from 'lucide-react'

type FilterKey = 'all' | 'wording' | 'references' | 'structure' | 'weights' | 'completeness'

const FILTERS: { id: FilterKey; label: string; categories?: FindingCategory[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'wording', label: 'Wording', categories: ['objectivity', 'measurability'] },
  { id: 'references', label: 'References', categories: ['references'] },
  { id: 'structure', label: 'Structure', categories: ['structure'] },
  { id: 'weights', label: 'Weights', categories: ['weighting'] },
  { id: 'completeness', label: 'Completeness', categories: ['completeness'] },
]

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  completeness: 'Completeness',
  objectivity: 'Objectivity',
  measurability: 'Measurability',
  references: 'Self-contained',
  structure: 'Structure',
  weighting: 'Weighting',
}

const CATEGORY_STYLES: Record<FindingCategory, string> = {
  completeness: 'border-clay/25 bg-clay-soft text-clay',
  objectivity: 'border-clay/25 bg-clay-soft text-clay',
  measurability: 'border-moss/20 bg-moss-soft text-moss',
  references: 'border-clay/25 bg-clay-soft text-clay',
  structure: 'border-moss/20 bg-moss-soft text-moss',
  weighting: 'border-line bg-canvas text-ink',
}

interface RubricFindingsProps {
  report: ExportReport
  analysisMessage: string
  onAnalyze: () => void
}

function filterMatches(filter: FilterKey, finding: RubricFinding) {
  if (filter === 'all') return true
  const categories = FILTERS.find((option) => option.id === filter)?.categories ?? []
  return categories.includes(finding.category)
}

function ChecklistIcon({ status }: { status: ChecklistStatus }) {
  if (status === 'clear') return <CircleCheck aria-hidden="true" className="text-moss" />
  if (status === 'review') return <CircleAlert aria-hidden="true" className="text-clay" />
  return <CircleHelp aria-hidden="true" className="text-muted-ink" />
}

function FindingCard({
  finding,
  criteria,
}: {
  finding: RubricFinding
  criteria: ExportReport['criteria']
}) {
  const locations = finding.criterionIds
    .map((id) => criteria.findIndex((criterion) => criterion.id === id) + 1)
    .filter((index) => index > 0)
    .map((index) => `Criterion ${String(index).padStart(2, '0')}`)

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`border ${CATEGORY_STYLES[finding.category]}`}
        >
          {CATEGORY_LABELS[finding.category]}
        </Badge>
        <span className="text-xs text-muted-ink">
          {locations.length > 0 ? locations.join(' · ') : 'Rubric-level check'}
        </span>
      </div>
      <h4 className="text-sm font-semibold leading-6 text-ink">{finding.title}</h4>
      <p className="mt-1 text-sm leading-6 text-muted-ink">{finding.message}</p>
      {finding.excerpt && (
        <blockquote className="mt-3 rounded-xl border-l-2 border-moss/35 bg-canvas/70 px-3.5 py-2.5 text-sm leading-6 text-ink">
          {finding.excerpt}
        </blockquote>
      )}
      <div className="mt-4 rounded-xl bg-moss-soft/70 px-3.5 py-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-moss">
          Suggested direction
        </p>
        <p className="mt-1 text-sm leading-6 text-ink">{finding.suggestion}</p>
      </div>
    </article>
  )
}

function formatTextReport(report: ExportReport) {
  const { analysis } = report
  const criteriaLines = report.criteria.map((criterion, index) => {
    const sign = criterion.weight > 0 ? '+' : ''
    return `${String(index + 1).padStart(2, '0')}. [${criterion.kind}; ${sign}${criterion.weight}] ${criterion.statement || '(empty statement)'}`
  })
  const findingLines = analysis.findings.map((finding) => {
    const locations = finding.criterionIds
      .map((id) => report.criteria.findIndex((criterion) => criterion.id === id) + 1)
      .filter((index) => index > 0)
      .map((index) => `criterion ${index}`)
      .join(', ')
    return `- ${finding.title}${locations ? ` (${locations})` : ''}: ${finding.message}\n  Suggested direction: ${finding.suggestion}`
  })

  return [
    `RubricLab — ${report.disclaimer}`,
    `Analysis status: ${analysis.status}`,
    '',
    'Task prompt',
    report.taskPrompt || '(empty)',
    '',
    'Criteria',
    ...(criteriaLines.length > 0 ? criteriaLines : ['(no criteria)']),
    '',
    'Weight summary',
    `Criteria: ${analysis.criteriaCount}`,
    `Warnings: ${analysis.warningCount ?? 'pending analysis'}`,
    `Positive weight sum: +${analysis.positiveWeightSum}`,
    `Negative weight sum: ${analysis.negativeWeightSum}`,
    `Negative share of absolute weights: ${Math.round(analysis.negativeWeightShare * 100)}% (review threshold: 35%)`,
    '',
    'Findings',
    ...(findingLines.length > 0 ? findingLines : ['No findings surfaced.']),
    '',
    'Individual wording checks do not assess whole-rubric coverage.',
  ].join('\n')
}

function copyFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

export function RubricFindings({ report, analysisMessage, onAnalyze }: RubricFindingsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [actionMessage, setActionMessage] = useState('')
  const { analysis } = report
  const analysisIsCurrent = analysis.status === 'current'
  const filteredFindings = analysis.findings.filter((finding) =>
    filterMatches(activeFilter, finding),
  )
  const positiveWidth =
    analysis.absoluteWeightTotal > 0
      ? (analysis.positiveWeightSum / analysis.absoluteWeightTotal) * 100
      : 0
  const negativeWidth =
    analysis.absoluteWeightTotal > 0
      ? (Math.abs(analysis.negativeWeightSum) / analysis.absoluteWeightTotal) * 100
      : 0

  async function copyReport() {
    const text = formatTextReport(report)

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else if (!copyFallback(text)) {
        throw new Error('Clipboard unavailable')
      }
      setActionMessage('Text report copied to the clipboard.')
    } catch {
      try {
        setActionMessage(
          copyFallback(text)
            ? 'Text report copied to the clipboard.'
            : 'Clipboard access was unavailable in this browser.',
        )
      } catch {
        setActionMessage('Clipboard access was unavailable in this browser.')
      }
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rubriclab-report-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setActionMessage('JSON report downloaded.')
  }

  return (
    <section
      aria-labelledby="analysis-heading"
      className="min-w-0 rounded-[1.6rem] border border-line bg-surface p-5 shadow-[0_18px_48px_rgba(38,54,43,0.045)] sm:p-6 lg:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">
            02 / Heuristic review
          </p>
          <h2 id="analysis-heading" className="font-editorial text-3xl tracking-[-0.035em] text-ink">
            Findings &amp; balance
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-ink">
            Pattern-based suggestions for a human to consider.
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            analysisIsCurrent
              ? 'border-moss/20 bg-moss-soft text-moss'
              : 'border-line bg-canvas text-muted-ink'
          }
        >
          {analysisIsCurrent ? 'Current review' : 'Review pending'}
        </Badge>
      </div>

      <div className="mt-5 flex gap-3 rounded-2xl border border-moss/15 bg-moss-soft/60 p-4">
        <Info aria-hidden="true" className="mt-0.5 shrink-0 text-moss" />
        <p className="text-sm leading-6 text-ink">
          These are <strong>heuristic suggestions, not a grading verdict</strong>. Every check runs in this browser; review each signal in context.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <MetricCard label="Total criteria" value={String(analysis.criteriaCount)} />
        <MetricCard
          label="Warning count"
          value={analysis.warningCount === null ? '—' : String(analysis.warningCount)}
          tone={analysis.warningCount ? 'clay' : 'default'}
        />
        <MetricCard
          label="Positive weight sum"
          value={`+${analysis.positiveWeightSum}`}
          tone="moss"
        />
        <MetricCard
          label="Negative weight sum"
          value={String(analysis.negativeWeightSum)}
          tone={analysis.negativeWeightSum < 0 ? 'clay' : 'default'}
        />
      </div>

      <section aria-labelledby="weight-heading" className="mt-6 rounded-2xl border border-line bg-canvas/45 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Scale aria-hidden="true" className="text-moss" />
              <h3 id="weight-heading" className="text-sm font-semibold text-ink">
                Weight distribution
              </h3>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-ink">
              Negative share is measured against all absolute weight points.
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              analysis.negativeWeightShare > 0.35
                ? 'border-clay/25 bg-clay-soft text-clay'
                : 'border-line bg-surface text-muted-ink'
            }
          >
            {Math.round(analysis.negativeWeightShare * 100)}% negative
          </Badge>
        </div>
        <div
          role="img"
          aria-label={`Weight distribution: ${analysis.positiveWeightSum} positive points and ${Math.abs(analysis.negativeWeightSum)} negative points`}
          className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-line"
        >
          {positiveWidth > 0 && (
            <span className="h-full bg-moss" style={{ width: `${positiveWidth}%` }} />
          )}
          {negativeWidth > 0 && (
            <span className="h-full bg-clay" style={{ width: `${negativeWidth}%` }} />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-moss" aria-hidden="true" />
            Positive +{analysis.positiveWeightSum}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-clay" aria-hidden="true" />
            Negative {analysis.negativeWeightSum}
          </span>
          <span>{analysis.zeroWeightCount} zero-weight {analysis.zeroWeightCount === 1 ? 'row' : 'rows'}</span>
        </div>
      </section>

      <section aria-labelledby="checklist-heading" className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
              Quality signals
            </p>
            <h3 id="checklist-heading" className="font-editorial text-2xl tracking-[-0.025em] text-ink">
              A quick checklist
            </h3>
          </div>
          <span className="text-xs text-muted-ink">Wording-level only</span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {analysis.qualityChecklist.map((check) => (
            <li key={check.id} className="flex min-w-0 gap-2.5 rounded-xl border border-line/80 bg-surface p-3">
              <ChecklistIcon status={check.status} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-ink">{check.label}</p>
                  <Badge
                    variant="outline"
                    className={
                      check.status === 'review'
                        ? 'h-5 border-clay/20 bg-clay-soft px-1.5 text-[0.65rem] text-clay'
                        : check.status === 'clear'
                          ? 'h-5 border-moss/15 bg-moss-soft px-1.5 text-[0.65rem] text-moss'
                          : 'h-5 border-line bg-canvas px-1.5 text-[0.65rem] text-muted-ink'
                    }
                  >
                    {check.status === 'review'
                      ? 'Review signal'
                      : check.status === 'clear'
                        ? 'No signal found'
                        : 'Run analysis'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-ink">{check.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-xl bg-canvas/70 px-3.5 py-3 text-xs leading-5 text-muted-ink">
          These checks inspect individual criteria. Whole-rubric coverage—whether the set represents every task objective without gaps or overlap—needs a separate human review.
        </p>
      </section>

      <section aria-labelledby="findings-heading" className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
              Actionable observations
            </p>
            <h3 id="findings-heading" className="font-editorial text-2xl tracking-[-0.025em] text-ink">
              Findings
            </h3>
          </div>
          <Badge
            variant="outline"
            className={
              analysis.warningCount
                ? 'border-clay/20 bg-clay-soft text-clay'
                : 'border-line bg-canvas text-muted-ink'
            }
          >
            {analysis.warningCount === null
              ? 'Not analyzed'
              : `${analysis.warningCount} ${analysis.warningCount === 1 ? 'finding' : 'findings'}`}
          </Badge>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Button
            type="button"
            variant="default"
            size="lg"
            className="h-11 w-full rounded-full px-5 sm:w-auto"
            onClick={onAnalyze}
          >
            <AlertTriangle data-icon="inline-start" aria-hidden="true" />
            {analysisIsCurrent ? 'Analyze again' : 'Analyze rubric'}
          </Button>
          <div className="flex flex-wrap gap-2" aria-label="Export report actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-line bg-surface px-3 text-ink hover:bg-moss-soft"
              onClick={downloadJson}
            >
              <Download data-icon="inline-start" aria-hidden="true" />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-line bg-surface px-3 text-ink hover:bg-moss-soft"
              onClick={copyReport}
            >
              <Clipboard data-icon="inline-start" aria-hidden="true" />
              Copy report
            </Button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {[analysisMessage, actionMessage].filter(Boolean).join(' ')}
          </p>
        </div>

        {analysisIsCurrent && analysis.findings.length > 0 && (
          <div className="mt-5">
            <ToggleGroup
              value={[activeFilter]}
              onValueChange={(value) => setActiveFilter((value[0] as FilterKey) ?? 'all')}
              aria-label="Filter findings by category"
              className="flex w-full flex-wrap items-center gap-2"
            >
              {FILTERS.map((filter) => {
                const count =
                  filter.id === 'all'
                    ? analysis.findings.length
                    : analysis.findings.filter((finding) => filterMatches(filter.id, finding)).length

                return (
                  <ToggleGroupItem
                    key={filter.id}
                    value={filter.id}
                    className="h-8 rounded-full border border-line bg-surface px-3 text-xs text-muted-ink transition-colors hover:bg-moss-soft data-[pressed]:border-moss data-[pressed]:bg-moss data-[pressed]:text-white data-[pressed]:hover:bg-moss-strong focus-visible:ring-2 focus-visible:ring-moss/30"
                  >
                    {filter.label} <span className="ml-1 tabular-nums opacity-70">{count}</span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {!analysisIsCurrent ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/45 px-5 py-7 text-center">
              <CircleHelp aria-hidden="true" className="mx-auto text-muted-ink" />
              <h4 className="mt-3 font-editorial text-xl text-ink">Ready for a fresh check</h4>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-ink">
                The rubric changed. Analyze it again to refresh row badges, findings, and checklist signals.
              </p>
            </div>
          ) : analysis.findings.length === 0 ? (
            <div className="rounded-2xl border border-moss/15 bg-moss-soft/45 px-5 py-7 text-center">
              <CircleCheck aria-hidden="true" className="mx-auto text-moss" />
              <h4 className="mt-3 font-editorial text-xl text-ink">No findings surfaced</h4>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-ink">
                The enabled wording checks did not find a signal. This is not a guarantee of clarity or full task coverage.
              </p>
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas/45 px-5 py-7 text-center">
              <p className="font-editorial text-xl text-ink">No findings in this category</p>
              <p className="mt-1.5 text-sm leading-6 text-muted-ink">
                Choose another filter to review the rest of the observations.
              </p>
            </div>
          ) : (
            filteredFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} criteria={report.criteria} />
            ))
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-canvas/50 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="flex gap-3">
            <Scale aria-hidden="true" className="mt-0.5 shrink-0 text-moss" />
            <div>
              <h4 className="text-sm font-semibold text-ink">Scoring is still your call.</h4>
              <p className="mt-1 max-w-md text-xs leading-5 text-muted-ink">
                These deterministic checks are transparent and editable. Nothing is sent to an AI service, and no grade is generated.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant="outline" className="border-line bg-surface text-muted-ink">
              {report.analysis.zeroWeightCount} zero-weight
            </Badge>
            <Badge variant="outline" className="border-line bg-surface text-muted-ink">
              Local only
            </Badge>
          </div>
        </div>
      </section>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'moss' | 'clay'
}) {
  return (
    <div className="rounded-xl border border-line bg-canvas/45 p-3.5 sm:p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.11em] text-muted-ink">{label}</p>
      <p
        className={`mt-2 font-editorial text-[1.7rem] leading-none tabular-nums tracking-[-0.035em] ${
          tone === 'moss' ? 'text-moss' : tone === 'clay' ? 'text-clay' : 'text-ink'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
