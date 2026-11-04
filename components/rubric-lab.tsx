'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  analyzeRubric,
  createCriterion,
  getWeightSummary,
  NEGATIVE_CRITERION_SHARE_THRESHOLD,
  RUBRIC_DISCLAIMER,
  SAMPLE_CRITERIA,
  SAMPLE_TASK_PROMPT,
  type Criterion,
  type FindingCategory,
  type RubricFinding,
} from '@/lib/rubric-analysis'
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  Info,
  LockKeyhole,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'

const STORAGE_KEY = 'rubriclab:workspace:v1'
const CATEGORY_LABELS: Record<FindingCategory, string> = {
  completeness: 'Completeness',
  wording: 'Wording',
  measurability: 'Measurability',
  references: 'References',
  structure: 'Structure',
  weights: 'Weights',
}
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'wording', label: 'Wording' },
  { id: 'references', label: 'References' },
  { id: 'structure', label: 'Structure' },
  { id: 'weights', label: 'Weights' },
  { id: 'completeness', label: 'Completeness' },
] as const

type FilterId = (typeof FILTERS)[number]['id']
type StoredWorkspace = { taskPrompt: string; criteria: Criterion[] }

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== 'object') return false
  const workspace = value as Record<string, unknown>
  if (typeof workspace.taskPrompt !== 'string' || !Array.isArray(workspace.criteria)) return false
  if (workspace.criteria.length > 200) return false

  return workspace.criteria.every((item) => {
    if (!item || typeof item !== 'object') return false
    const row = item as Record<string, unknown>
    return (
      typeof row.id === 'string' &&
      typeof row.statement === 'string' &&
      row.statement.length <= 1200 &&
      typeof row.weight === 'number' &&
      Number.isInteger(row.weight) &&
      row.weight >= -100 &&
      row.weight <= 100 &&
      (row.kind === 'explicit' || row.kind === 'implicit')
    )
  })
}

export default function RubricLab() {
  const [taskPrompt, setTaskPrompt] = useState(SAMPLE_TASK_PROMPT)
  const [criteria, setCriteria] = useState<Criterion[]>(() => SAMPLE_CRITERIA.map((row) => ({ ...row })))
  const [analysisCurrent, setAnalysisCurrent] = useState(true)
  const [storageReady, setStorageReady] = useState(false)
  const [storageMessage, setStorageMessage] = useState('Saved in this browser only. Nothing is uploaded.')
  const [analysisMessage, setAnalysisMessage] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterId>('all')
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed: unknown = JSON.parse(saved)
        if (isStoredWorkspace(parsed)) {
          setTaskPrompt(parsed.taskPrompt)
          setCriteria(parsed.criteria)
        }
      }
    } catch {
      setStorageMessage('Local saving is unavailable in this browser session.')
    } finally {
      setStorageReady(true)
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ taskPrompt, criteria }))
      setStorageMessage('Saved in this browser only. Nothing is uploaded.')
    } catch {
      setStorageMessage('Local saving is unavailable; changes remain in this tab.')
    }
  }, [criteria, storageReady, taskPrompt])

  const findings = useMemo(
    () => (analysisCurrent ? analyzeRubric(criteria) : []),
    [analysisCurrent, criteria],
  )
  const weights = useMemo(() => getWeightSummary(criteria), [criteria])
  const findingsByCriterion = useMemo(() => {
    const grouped: Record<string, RubricFinding[]> = {}
    for (const finding of findings) {
      for (const id of finding.criterionIds) grouped[id] = [...(grouped[id] ?? []), finding]
    }
    return grouped
  }, [findings])
  const matchingFilters = useMemo(() => {
    return findings.filter((finding) => activeFilter === 'all' || finding.category === activeFilter ||
      (activeFilter === 'wording' && finding.category === 'measurability'))
  }, [activeFilter, findings])

  const noRows = criteria.length === 0 || findings.some((finding) => finding.rule === 'empty')
  const checklist = [
    { label: 'Atomic', detail: 'One independently scorable outcome.', signal: findings.some((finding) => finding.rule === 'bundled') },
    { label: 'Self-contained', detail: 'Each row names the context it needs.', signal: findings.some((finding) => finding.rule === 'outside-reference') },
    { label: 'Objective', detail: 'Wording leaves less room for interpretation.', signal: findings.some((finding) => finding.rule === 'subjective') },
    { label: 'Verifiable', detail: 'Reviewers can point to observable evidence.', signal: findings.some((finding) => finding.rule === 'mental-process') },
  ]

  const report = {
    schemaVersion: 2,
    tool: 'RubricLab',
    disclaimer: RUBRIC_DISCLAIMER,
    taskPrompt,
    criteria,
    analysis: {
      status: analysisCurrent ? 'current' : 'pending',
      criteriaCount: criteria.length,
      warningCount: analysisCurrent ? findings.length : null,
      weightSummary: {
        ...weights,
        criterionCount: criteria.length,
        negativeCriterionShareThreshold: NEGATIVE_CRITERION_SHARE_THRESHOLD,
        negativeCriterionShareExceedsThreshold: weights.negativeCriterionShare > NEGATIVE_CRITERION_SHARE_THRESHOLD,
        negativeCriterionShareBasis: 'negative-weight rows / all criterion rows',
        negativeCriterionShareConvention: 'configurable, project-specific review convention; not a universal rubric standard',
        negativePointShareRole: 'informational only; not the alert basis',
      },
      findings: analysisCurrent ? findings : [],
    },
  }

  function markPending() {
    setAnalysisCurrent(false)
    setAnalysisMessage('')
    setActionMessage('')
  }

  function changeCriterion(id: string, patch: Partial<Criterion>) {
    setCriteria((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
    markPending()
  }

  function loadSample() {
    setTaskPrompt(SAMPLE_TASK_PROMPT)
    setCriteria(SAMPLE_CRITERIA.map((row) => ({ ...row })))
    setAnalysisCurrent(true)
    setAnalysisMessage('Fictional 5K sample loaded and analyzed.')
    setActionMessage('')
    setActiveFilter('all')
  }

  function clearRubric() {
    setTaskPrompt('')
    setCriteria([])
    setAnalysisCurrent(false)
    setAnalysisMessage('Rubric cleared. Add a criterion or analyze the empty rubric.')
    setActionMessage('')
  }

  function runAnalysis() {
    setAnalysisCurrent(true)
    setAnalysisMessage('Heuristic review refreshed for the current rubric.')
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rubriclab-report-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setActionMessage('JSON report downloaded.')
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
      setActionMessage('Report JSON copied to the clipboard.')
    } catch {
      setActionMessage('Clipboard access is unavailable in this browser.')
    }
  }

  return (
    <div id="top" className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-canvas/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-7 lg:px-8">
          <a href="#top" aria-label="RubricLab home" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/15">
            <span className="flex size-9 items-center justify-center rounded-xl bg-moss text-white"><ClipboardCheck aria-hidden="true" /></span>
            <span className="font-semibold tracking-[-0.035em]">Rubric<span className="font-editorial font-normal">Lab</span></span>
          </a>
          <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-5">
            <a href="#how-it-works" className="hidden rounded-md px-2 py-2 text-sm text-muted-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 sm:inline-flex">How it works</a>
<a href="#workspace" className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-moss hover:bg-moss-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30">
  Try the demo <ArrowRight className="size-4" aria-hidden="true" />
  </a>
          </nav>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-heading" className="mx-auto grid max-w-7xl gap-9 px-5 py-11 sm:px-7 md:grid-cols-[minmax(0,1.25fr)_minmax(270px,0.75fr)] md:items-end md:py-16 lg:gap-16 lg:px-8 lg:py-[4.5rem]">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-moss"><span className="size-1.5 rounded-full bg-moss" aria-hidden="true" />A practical rubric reviewer</p>
            <h1 id="hero-heading" className="max-w-3xl font-editorial text-[clamp(3.25rem,7.3vw,6.3rem)] leading-[0.99] tracking-[-0.055em]">Better criteria.<br /><em className="font-normal text-moss">Fairer evaluations.</em></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-ink sm:text-lg sm:leading-8">Inspect a rubric for wording and weighting patterns that can make expectations harder to apply consistently. Keep the judgment human; make the criteria easier to understand.</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a href="#workspace" className="inline-flex h-11 items-center gap-2 rounded-full bg-moss px-5 text-sm font-semibold text-white transition-colors hover:bg-moss-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/20">Open the checker <ArrowDown className="size-4" aria-hidden="true" /></a>
              <span className="text-sm text-muted-ink">A fictional 5K rubric is ready to explore.</span>
            </div>
          </div>
          <aside className="rounded-[1.6rem] border border-line bg-surface p-5 shadow-[0_18px_48px_rgba(38,54,43,0.04)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-ink">The reviewer&apos;s note</p>
                <p className="mt-3 max-w-sm font-editorial text-[1.65rem] leading-tight tracking-[-0.035em]">Clarity belongs in the criteria, not in a reviewer&apos;s guess.</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss-soft text-moss"><Check aria-hidden="true" /></span>
            </div>
            <div className="mt-6 rounded-2xl bg-canvas p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole aria-hidden="true" className="text-moss" />Runs locally, by design</div>
              <p className="mt-2 text-sm leading-6 text-muted-ink">No AI service, account, or upload. Your prompt and rubric stay in this browser.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-ink"><span>01 / wording</span><span>02 / structure</span><span>03 / weights</span></div>
          </aside>
        </section>

        <section id="workspace" aria-labelledby="workspace-title" className="mx-auto max-w-7xl scroll-mt-6 px-5 pb-16 sm:px-7 lg:px-8 lg:pb-20">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">The workspace</p><h2 id="workspace-title" className="font-editorial text-3xl tracking-[-0.035em] sm:text-4xl">Make the rubric easier to trust.</h2></div>
            <p className="flex items-center gap-2 text-xs text-muted-ink"><span className="size-2 rounded-full bg-moss" aria-hidden="true" />Fictional 5K reflection sample loaded</p>
          </div>

          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-6">
            <section aria-labelledby="editor-title" className="min-w-0 rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_18px_48px_rgba(38,54,43,0.04)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-moss">01 / Edit</p><h3 id="editor-title" className="mt-1 font-editorial text-2xl tracking-[-0.03em]">Your rubric</h3></div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-full border-line px-3" onClick={loadSample}><RotateCcw data-icon="inline-start" aria-hidden="true" />Load sample</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-muted-ink hover:text-clay" onClick={clearRubric}>Clear</Button>
                </div>
              </div>

              <label htmlFor="task-prompt" className="mt-6 block text-sm font-semibold">Task prompt <span className="ml-1 font-normal text-muted-ink">(context for the reviewer)</span></label>
              <textarea id="task-prompt" value={taskPrompt} rows={4} maxLength={4000} onChange={(event) => { setTaskPrompt(event.target.value); markPending() }} placeholder="Paste the task students are responding to…" className="mt-2 w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-muted-ink/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/10" />

              <div className="mb-3 mt-7 flex items-center justify-between gap-3">
                <div><h4 className="text-sm font-semibold">Criteria</h4><p className="mt-1 text-xs text-muted-ink">One criterion should describe one assessable expectation.</p></div>
                <Badge variant="outline" className="border-line bg-canvas text-muted-ink">{criteria.length} rows</Badge>
              </div>

              <div className="flex flex-col gap-3">
                {criteria.map((row, index) => {
                  const rowFindings = findingsByCriterion[row.id] ?? []
                  return (
                    <article key={row.id} className="rounded-xl border border-line bg-canvas/55 p-3.5 sm:p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-muted-ink">Criterion {String(index + 1).padStart(2, '0')}</span>
                          <Badge variant={row.kind === 'explicit' ? 'secondary' : 'outline'} className="text-[0.62rem] uppercase tracking-[0.06em]">{row.kind}</Badge>
                          {analysisCurrent ? rowFindings.slice(0, 3).map((finding) => <Badge key={finding.id} variant="outline" className="border-clay/30 bg-clay-soft text-clay">{finding.badge}</Badge>) : <Badge variant="outline" className="border-line text-muted-ink">Review pending</Badge>}
                          {analysisCurrent && rowFindings.length > 3 && <Badge variant="outline" className="border-line text-muted-ink">+{rowFindings.length - 3}</Badge>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Delete criterion ${index + 1}`} onClick={() => { setCriteria((current) => current.filter((item) => item.id !== row.id)); markPending() }} className="size-8 shrink-0 rounded-full text-muted-ink hover:bg-clay-soft hover:text-clay"><Trash2 aria-hidden="true" /></Button>
                      </div>

                      <label htmlFor={`statement-${row.id}`} className="sr-only">Criterion {index + 1} statement</label>
                      <textarea id={`statement-${row.id}`} value={row.statement} rows={3} maxLength={1200} onChange={(event) => changeCriterion(row.id, { statement: event.target.value })} placeholder="Describe one observable criterion…" className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm leading-6 placeholder:text-muted-ink/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/10" />

                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <label htmlFor={`weight-${row.id}`} className="text-xs font-medium text-muted-ink">Weight <span className="font-normal">(−100 to 100)</span>
                          <div className="mt-1.5 flex h-10 items-center rounded-lg border border-line bg-surface focus-within:border-moss focus-within:ring-4 focus-within:ring-moss/10">
                            <input id={`weight-${row.id}`} type="number" min={-100} max={100} step={1} value={row.weight} aria-label={`Weight for criterion ${index + 1}`} onChange={(event) => { const value = Number(event.target.value); changeCriterion(row.id, { weight: Number.isFinite(value) ? Math.max(-100, Math.min(100, Math.trunc(value))) : 0 }) }} className="h-full min-w-0 flex-1 rounded-lg bg-transparent px-3 text-sm font-semibold text-ink outline-none" />
                            <span className="pr-3 text-xs text-muted-ink">pts</span>
                          </div>
                        </label>
                        <label htmlFor={`kind-${row.id}`} className="text-xs font-medium text-muted-ink">Criterion type
                          <select id={`kind-${row.id}`} value={row.kind} onChange={(event) => changeCriterion(row.id, { kind: event.target.value as Criterion['kind'] })} className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:border-moss focus-visible:ring-4 focus-visible:ring-moss/10">
                            <option value="explicit">Explicit</option><option value="implicit">Implicit</option>
                          </select>
                        </label>
                      </div>
                    </article>
                  )
                })}
              </div>

              {criteria.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-line bg-canvas/55 px-4 py-8 text-center"><p className="font-medium">No criteria yet</p><p className="mt-1 text-sm text-muted-ink">Add a row to start building your rubric.</p></div>}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" className="h-10 rounded-full border-dashed border-moss/50 px-4 text-moss hover:bg-moss-soft" onClick={() => { setCriteria((current) => [...current, createCriterion()]); markPending() }}><Plus data-icon="inline-start" aria-hidden="true" />Add criterion</Button>
                <span role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-ink"><LockKeyhole aria-hidden="true" className="text-moss" />{storageMessage}</span>
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
              <section aria-labelledby="analysis-title" className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_18px_48px_rgba(38,54,43,0.04)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-moss">02 / Review</p><h3 id="analysis-title" className="mt-1 font-editorial text-2xl tracking-[-0.03em]">A closer look</h3></div>
                  <Button type="button" variant="default" size="sm" className="h-9 shrink-0 rounded-full px-3.5" onClick={runAnalysis}>Analyze rubric <ArrowRight data-icon="inline-end" aria-hidden="true" /></Button>
                </div>
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-moss-soft/70 p-3 text-xs leading-5 text-ink"><Info aria-hidden="true" className="mt-0.5 shrink-0 text-moss" /><span>These are <strong>heuristic suggestions, not a grading verdict</strong>. A word match is only a prompt for human review.</span></p>
                {analysisMessage && <p role="status" aria-live="polite" className="mt-2 text-xs text-moss">{analysisMessage}</p>}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line bg-canvas p-3"><p className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">Criteria</p><p className="mt-1 text-2xl font-semibold tracking-tight">{criteria.length.toString().padStart(2, '0')}</p></div>
                  <div className="rounded-xl border border-line bg-canvas p-3"><p className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">Findings</p><p className="mt-1 text-2xl font-semibold tracking-tight">{analysisCurrent ? findings.length.toString().padStart(2, '0') : '—'}</p></div>
                  <div className="rounded-xl border border-line bg-canvas p-3"><p className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">Positive points</p><p className="mt-1 text-xl font-semibold text-moss">+{weights.positive}</p></div>
                  <div className="rounded-xl border border-line bg-canvas p-3"><p className="text-[0.63rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">Negative points</p><p className="mt-1 text-xl font-semibold text-clay">{weights.negative}</p></div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Weight points <span className="font-normal text-muted-ink">(informational)</span></h4><span className="text-xs text-muted-ink">{Math.round(weights.negativePointShare * 100)}% of absolute points</span></div>
                  <div role="img" aria-label={`Negative weight-point share ${Math.round(weights.negativePointShare * 100)} percent; informational only`} className="mt-2 flex h-2 overflow-hidden rounded-full bg-line">
                    <span className="bg-moss" style={{ width: `${weights.absoluteTotal ? (weights.positive / weights.absoluteTotal) * 100 : 0}%` }} />
                    <span className="bg-clay" style={{ width: `${weights.absoluteTotal ? (Math.abs(weights.negative) / weights.absoluteTotal) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-3 rounded-xl bg-canvas p-3">
                    <p className="text-xs font-semibold">Negative criteria: {weights.negativeCriterionCount} / {criteria.length} ({Math.round(weights.negativeCriterionShare * 100)}%)</p>
                    <p className="mt-1 text-[0.68rem] leading-5 text-muted-ink">Review convention: alert above {Math.round(NEGATIVE_CRITERION_SHARE_THRESHOLD * 100)}% of criterion rows. It is configurable per project, not a universal standard.</p>
                  </div>
                  <p className="mt-2 text-[0.68rem] leading-5 text-muted-ink">The points chart compares absolute point totals; it is informational only and does not drive the criterion-count alert.</p>
                </div>

                <div className="mt-5 rounded-xl border border-line p-3.5">
                  <h4 className="text-sm font-semibold">Quality checklist</h4>
                  <ul className="mt-2 flex flex-col gap-2">
                    {checklist.map((item) => {
                      const flagged = noRows || item.signal
                      const status = !analysisCurrent ? 'Pending' : flagged ? 'Review' : 'No signal'
                      return <li key={item.label} className="flex items-start justify-between gap-2 text-xs"><span><span className="font-semibold">{item.label}</span><span className="mt-0.5 block leading-5 text-muted-ink">{item.detail}</span></span><Badge variant="outline" className={!analysisCurrent ? 'shrink-0 border-line text-muted-ink' : flagged ? 'shrink-0 border-clay/30 bg-clay-soft text-clay' : 'shrink-0 border-moss/20 bg-moss-soft text-moss'}>{status}</Badge></li>
                    })}
                  </ul>
                  <p className="mt-3 text-[0.68rem] leading-5 text-muted-ink">This checklist checks wording signals only; it does not assess whether the rubric covers every task goal.</p>
                </div>
              </section>

              <section aria-labelledby="findings-title" className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_18px_48px_rgba(38,54,43,0.04)] sm:p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-moss">03 / Findings</p><h3 id="findings-title" className="mt-1 font-editorial text-2xl tracking-[-0.03em]">Signals to review</h3></div><Badge variant="secondary" className="shrink-0">{analysisCurrent ? findings.length : '—'} total</Badge></div>

                {analysisCurrent && findings.length > 0 && <div role="group" aria-label="Filter findings" className="mt-4 flex flex-wrap gap-1.5">{FILTERS.map((filter) => {
                  const count = filter.id === 'all' ? findings.length : findings.filter((finding) => filter.id === 'wording' ? ['wording', 'measurability'].includes(finding.category) : finding.category === filter.id).length
                  return <Button key={filter.id} type="button" variant={activeFilter === filter.id ? 'secondary' : 'outline'} size="sm" aria-pressed={activeFilter === filter.id} className="h-8 rounded-full border-line px-2.5 text-[0.68rem]" onClick={() => setActiveFilter(filter.id)}>{filter.label}<span className="ml-1 opacity-60">{count}</span></Button>
                })}</div>}

                {!analysisCurrent ? <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas/60 p-5 text-center"><Info aria-hidden="true" className="mx-auto text-moss" /><p className="mt-2 text-sm font-semibold">Analysis needs a refresh</p><p className="mt-1 text-xs leading-5 text-muted-ink">You edited the rubric. Run the checker to update its findings.</p></div> : findings.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line bg-canvas/60 p-5 text-center"><Check aria-hidden="true" className="mx-auto text-moss" /><p className="mt-2 text-sm font-semibold">No findings surfaced</p><p className="mt-1 text-xs leading-5 text-muted-ink">This is not proof of quality; the checker only looks for a small set of wording and weight patterns.</p></div> : matchingFilters.length === 0 ? <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted-ink">No findings in this category.</p> : <div className="mt-4 flex flex-col gap-2.5">{matchingFilters.map((finding) => {
                  const positions = finding.criterionIds.map((id) => criteria.findIndex((row) => row.id === id) + 1).filter((position) => position > 0)
                  const location = positions.length ? positions.map((position) => `#${String(position).padStart(2, '0')}`).join(', ') : 'Rubric-level'
                  return <article key={finding.id} className="rounded-xl border border-line bg-canvas/55 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className="border-line bg-surface text-muted-ink">{CATEGORY_LABELS[finding.category]}</Badge><span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-ink">{location}</span></div>
                    <h4 className="mt-2.5 text-sm font-semibold">{finding.title}</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-ink">{finding.message}</p>
                    {finding.excerpt && <blockquote className="mt-2 rounded-lg border-l-2 border-moss/40 bg-surface px-3 py-2 text-xs italic leading-5 text-muted-ink">{finding.excerpt}</blockquote>}
                    <p className="mt-2 rounded-lg bg-moss-soft/60 px-3 py-2 text-xs leading-5 text-ink"><strong>Consider:</strong> {finding.suggestion}</p>
                  </article>
                })}</div>}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-full border-line px-3" onClick={copyReport}><Copy data-icon="inline-start" aria-hidden="true" />Copy JSON</Button>
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-full border-line px-3" onClick={exportJson}><Download data-icon="inline-start" aria-hidden="true" />Download JSON</Button>
                </div>
                {actionMessage && <p role="status" aria-live="polite" className="mt-2 text-xs text-moss">{actionMessage}</p>}
              </section>
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="border-y border-line bg-surface/70">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-7 md:py-16 lg:px-8">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">A transparent process</p><h2 id="how-heading" className="font-editorial text-3xl tracking-[-0.035em] sm:text-4xl">How it works</h2></div><p className="max-w-xl text-sm leading-6 text-muted-ink">RubricLab checks text patterns and arithmetic. It never evaluates student work or decides whether a rubric is fair.</p></div>
            <div className="grid gap-3 md:grid-cols-3">{[
              { number: '01', title: 'Scan the wording', description: 'Look for subjective language, mental-process phrasing, context references, possible bundles, and repeated statements.' },
              { number: '02', title: 'Check the balance', description: 'See positive and negative weight totals, zero-weight rows, and whether negative points exceed the review threshold.' },
              { number: '03', title: 'Decide in context', description: 'Treat each signal as a question to investigate. Keep useful wording, clarify what needs evidence, and judge coverage yourself.' },
            ].map((step) => <article key={step.number} className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><p className="font-editorial text-3xl tracking-[-0.04em] text-moss">{step.number}</p><h3 className="mt-4 text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-muted-ink">{step.description}</p></article>)}</div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-ink"><LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-moss" />Data is saved in this browser&apos;s local storage only. Nothing is sent to a server.</p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:px-7 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="font-medium">Built by Mohd Arbaz Ali <span className="font-normal text-muted-ink">· A practical exploration of rubric design, clarity, and fair evaluation.</span></p>
        <a href="#top" className="inline-flex items-center gap-1 self-start rounded-md text-xs font-medium text-moss hover:text-moss-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 md:self-auto">Back to top <ArrowRight aria-hidden="true" /></a>
      </footer>
    </div>
  )
}
