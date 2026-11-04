'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RubricEditor } from '@/components/rubric-editor'
import { RubricFindings } from '@/components/rubric-findings'
import {
  analyzeRubric,
  buildQualityChecklist,
  createCriterion,
  getWeightSummary,
  RUBRIC_DISCLAIMER,
  SAMPLE_CRITERIA,
  SAMPLE_TASK_PROMPT,
  type Criterion,
  type ExportReport,
  type RubricFinding,
} from '@/lib/rubric-analysis'
import { ArrowDown, ArrowRight, Check, ClipboardCheck, LockKeyhole } from 'lucide-react'

const STORAGE_KEY = 'rubriclab:workspace:v1'

interface StoredWorkspace {
  taskPrompt: string
  criteria: Criterion[]
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (typeof candidate.taskPrompt !== 'string' || candidate.taskPrompt.length > 4000) return false
  if (!Array.isArray(candidate.criteria) || candidate.criteria.length > 200) return false

  return candidate.criteria.every((item) => {
    if (!item || typeof item !== 'object') return false
    const criterion = item as Record<string, unknown>
    return (
      typeof criterion.id === 'string' &&
      criterion.id.length > 0 &&
      typeof criterion.statement === 'string' &&
      criterion.statement.length <= 1200 &&
      typeof criterion.weight === 'number' &&
      Number.isInteger(criterion.weight) &&
      criterion.weight >= -100 &&
      criterion.weight <= 100 &&
      (criterion.kind === 'explicit' || criterion.kind === 'implicit')
    )
  })
}

function cloneSampleCriteria() {
  return SAMPLE_CRITERIA.map((criterion) => ({ ...criterion }))
}

export default function RubricLab() {
  const [taskPrompt, setTaskPrompt] = useState(SAMPLE_TASK_PROMPT)
  const [criteria, setCriteria] = useState<Criterion[]>(cloneSampleCriteria)
  const [analysisIsCurrent, setAnalysisIsCurrent] = useState(true)
  const [storageReady, setStorageReady] = useState(false)
  const [storageMessage, setStorageMessage] = useState(
    'Saved in this browser only. Nothing is uploaded.',
  )
  const [analysisMessage, setAnalysisMessage] = useState('')

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
    () => (analysisIsCurrent ? analyzeRubric(criteria) : []),
    [analysisIsCurrent, criteria],
  )
  const weightSummary = useMemo(() => getWeightSummary(criteria), [criteria])
  const qualityChecklist = useMemo(
    () => buildQualityChecklist(findings, analysisIsCurrent),
    [analysisIsCurrent, findings],
  )
  const findingsByCriterion = useMemo(() => {
    return findings.reduce<Record<string, RubricFinding[]>>((groups, finding) => {
      for (const criterionId of finding.criterionIds) {
        groups[criterionId] = [...(groups[criterionId] ?? []), finding]
      }
      return groups
    }, {})
  }, [findings])
  const report = useMemo<ExportReport>(
    () => ({
      tool: 'RubricLab',
      disclaimer: RUBRIC_DISCLAIMER,
      taskPrompt,
      criteria,
      analysis: {
        status: analysisIsCurrent ? 'current' : 'pending',
        criteriaCount: criteria.length,
        warningCount: analysisIsCurrent ? findings.length : null,
        positiveWeightSum: weightSummary.positiveWeightSum,
        negativeWeightSum: weightSummary.negativeWeightSum,
        absoluteWeightTotal: weightSummary.absoluteWeightTotal,
        negativeWeightShare: weightSummary.negativeWeightShare,
        negativeWeightShareLimit: 0.35,
        zeroWeightCount: weightSummary.zeroWeightCount,
        findings,
        qualityChecklist,
      },
    }),
    [analysisIsCurrent, criteria, findings, qualityChecklist, taskPrompt, weightSummary],
  )

  function markAnalysisStale() {
    setAnalysisIsCurrent(false)
    setAnalysisMessage('')
  }

  function handleCriterionChange(id: string, patch: Partial<Criterion>) {
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id ? { ...criterion, ...patch } : criterion,
      ),
    )
    markAnalysisStale()
  }

  function handleAddCriterion() {
    setCriteria((current) => [...current, createCriterion()])
    markAnalysisStale()
  }

  function handleDeleteCriterion(id: string) {
    setCriteria((current) => current.filter((criterion) => criterion.id !== id))
    markAnalysisStale()
  }

  function handleLoadSample() {
    setTaskPrompt(SAMPLE_TASK_PROMPT)
    setCriteria(cloneSampleCriteria())
    setAnalysisIsCurrent(true)
    setAnalysisMessage('Fictional 5K sample loaded and analyzed.')
  }

  function handleClearRubric() {
    setTaskPrompt('')
    setCriteria([])
    setAnalysisIsCurrent(false)
    setAnalysisMessage('Rubric cleared. Add criteria or analyze the empty rubric.')
  }

  function handleAnalyze() {
    setAnalysisIsCurrent(true)
    setAnalysisMessage('Heuristic review refreshed for the current rubric.')
  }

  return (
    <div id="top" className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line/90 bg-canvas/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-5 sm:px-7 lg:px-8">
          <a href="#top" aria-label="RubricLab home" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/15">
            <span className="flex size-9 items-center justify-center rounded-xl bg-moss text-white">
              <ClipboardCheck aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-[-0.035em] text-ink">
              Rubric<span className="font-editorial font-normal">Lab</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
            <a
              href="#how-it-works"
              className="hidden rounded-md px-2 py-2 text-sm text-muted-ink transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 sm:inline-flex"
            >
              How it works
            </a>
            <Button
              render={<a href="#workspace" />}
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-line bg-surface px-4 text-ink hover:border-moss hover:bg-moss-soft"
            >
              Try the demo
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-heading" className="mx-auto grid max-w-7xl gap-9 px-5 py-11 sm:px-7 md:grid-cols-[minmax(0,1.25fr)_minmax(270px,0.75fr)] md:items-end md:py-16 lg:gap-16 lg:px-8 lg:py-[4.5rem]">
          <div>
            <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-moss">
              <span className="size-1.5 rounded-full bg-moss" aria-hidden="true" />
              A practical rubric reviewer
            </p>
            <h1 id="hero-heading" className="max-w-3xl font-editorial text-[clamp(3.25rem,7.3vw,6.3rem)] leading-[0.99] tracking-[-0.055em] text-ink">
              Better criteria.<br />
              <em className="font-normal text-moss">Fairer evaluations.</em>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-ink sm:text-lg sm:leading-8">
              Inspect a rubric for wording and weighting patterns that can make expectations harder to apply consistently. Keep the judgment human; make the criteria easier to understand.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button
                render={<a href="#workspace" />}
                variant="default"
                size="lg"
                className="h-11 rounded-full px-5"
              >
                Open the checker
                <ArrowDown data-icon="inline-end" aria-hidden="true" />
              </Button>
              <span className="text-sm text-muted-ink">A fictional 5K rubric is ready to explore.</span>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[1.6rem] border border-line bg-surface p-5 shadow-[0_18px_48px_rgba(38,54,43,0.04)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-muted-ink">
                  The reviewer&apos;s note
                </p>
                <p className="mt-3 max-w-sm font-editorial text-[1.65rem] leading-tight tracking-[-0.035em] text-ink">
                  Clarity belongs in the criteria, not in a reviewer&apos;s guess.
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-moss-soft text-moss">
                <Check aria-hidden="true" />
              </span>
            </div>
            <div className="mt-6 rounded-2xl bg-canvas/65 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LockKeyhole aria-hidden="true" className="text-moss" />
                Runs locally, by design
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-ink">
                No AI service, account, or upload. Your prompt and rubric stay in this browser.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-ink">
              <span>01 / wording</span>
              <span>02 / structure</span>
              <span>03 / weights</span>
            </div>
          </aside>
        </section>

        <section aria-labelledby="workspace-title" className="mx-auto max-w-7xl px-5 pb-16 sm:px-7 lg:px-8 lg:pb-20">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">
                The workspace
              </p>
              <h2 id="workspace-title" className="font-editorial text-3xl tracking-[-0.035em] text-ink sm:text-4xl">
                Make the rubric easier to trust.
              </h2>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-ink">
              <span className="size-2 rounded-full bg-moss" aria-hidden="true" />
              Fictional 5K reflection sample loaded
            </p>
          </div>

          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-6">
            <RubricEditor
              taskPrompt={taskPrompt}
              criteria={criteria}
              findingsByCriterion={findingsByCriterion}
              analysisIsCurrent={analysisIsCurrent}
              storageMessage={storageMessage}
              onTaskPromptChange={(value) => {
                setTaskPrompt(value)
                markAnalysisStale()
              }}
              onCriterionChange={handleCriterionChange}
              onAddCriterion={handleAddCriterion}
              onDeleteCriterion={handleDeleteCriterion}
              onLoadSample={handleLoadSample}
              onClearRubric={handleClearRubric}
            />
            <RubricFindings
              report={report}
              analysisMessage={analysisMessage}
              onAnalyze={handleAnalyze}
            />
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="border-y border-line bg-surface/70">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-7 md:py-16 lg:px-8">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">
                  A transparent process
                </p>
                <h2 id="how-heading" className="font-editorial text-3xl tracking-[-0.035em] text-ink sm:text-4xl">
                  How it works
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-ink">
                RubricLab checks text patterns and arithmetic. It never evaluates student work or decides whether a rubric is fair.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <HowStep
                number="01"
                title="Scan the wording"
                description="Look for subjective language, mental-process phrasing, context references, possible bundles, and repeated statements."
              />
              <HowStep
                number="02"
                title="Check the balance"
                description="See positive and negative weight totals, zero-weight rows, and whether negative points exceed the review threshold."
              />
              <HowStep
                number="03"
                title="Decide in context"
                description="Treat each signal as a question to investigate. Keep useful wording, clarify what needs evidence, and judge coverage yourself."
              />
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-muted-ink">
              <LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-moss" />
              Data persistence uses this browser&apos;s local storage only. Rubrics are not transmitted to a server.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm sm:px-7 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="font-medium text-ink">
          Built by Mohd Arbaz Ali <span className="font-normal text-muted-ink">· A practical exploration of rubric design, clarity, and fair evaluation.</span>
        </p>
        <a href="#top" className="inline-flex items-center gap-1 self-start rounded-md text-xs font-medium text-moss hover:text-moss-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 md:self-auto">
          Back to top <ArrowRight aria-hidden="true" />
        </a>
      </footer>
    </div>
  )
}

function HowStep({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <p className="font-editorial text-3xl tracking-[-0.04em] text-moss">{number}</p>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-ink">{description}</p>
    </article>
  )
}
