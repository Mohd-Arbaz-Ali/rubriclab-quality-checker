import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Criterion, RubricFinding } from '@/lib/rubric-analysis'
import { Eraser, Plus, RotateCcw, Trash2 } from 'lucide-react'

interface RubricEditorProps {
  taskPrompt: string
  criteria: Criterion[]
  findingsByCriterion: Record<string, RubricFinding[]>
  analysisIsCurrent: boolean
  storageMessage: string
  onTaskPromptChange: (value: string) => void
  onCriterionChange: (id: string, patch: Partial<Criterion>) => void
  onAddCriterion: () => void
  onDeleteCriterion: (id: string) => void
  onLoadSample: () => void
  onClearRubric: () => void
}

interface CriterionRowProps {
  criterion: Criterion
  index: number
  rowFindings: RubricFinding[]
  analysisIsCurrent: boolean
  onChange: (id: string, patch: Partial<Criterion>) => void
  onDelete: (id: string) => void
}

function CriterionRow({
  criterion,
  index,
  rowFindings,
  analysisIsCurrent,
  onChange,
  onDelete,
}: CriterionRowProps) {
  const statementId = `criterion-statement-${criterion.id}`
  const weightId = `criterion-weight-${criterion.id}`
  const kindId = `criterion-kind-${criterion.id}`

  return (
    <fieldset className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <legend className="sr-only">Criterion {index + 1}</legend>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            Criterion {String(index + 1).padStart(2, '0')}
          </span>
          <Badge
            variant={criterion.kind === 'explicit' ? 'secondary' : 'outline'}
            className={
              criterion.kind === 'explicit'
                ? 'border-transparent bg-moss-soft text-moss'
                : 'border-line bg-canvas text-muted-ink'
            }
          >
            {criterion.kind === 'explicit' ? 'Explicit' : 'Implicit'}
          </Badge>
          {!analysisIsCurrent && (
            <Badge variant="outline" className="border-line bg-canvas text-muted-ink">
              Review pending
            </Badge>
          )}
          {analysisIsCurrent &&
            rowFindings.slice(0, 4).map((finding) => (
              <Badge
                key={finding.id}
                variant="outline"
                className="border-clay/25 bg-clay-soft text-clay"
              >
                {finding.badge}
              </Badge>
            ))}
          {analysisIsCurrent && rowFindings.length > 4 && (
            <Badge variant="outline" className="border-line bg-canvas text-muted-ink">
              +{rowFindings.length - 4} more
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete criterion ${index + 1}`}
          title="Delete criterion"
          className="-mr-1 -mt-1 shrink-0 text-muted-ink hover:text-clay"
          onClick={() => onDelete(criterion.id)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_168px] md:items-start">
        <div className="min-w-0">
          <label
            htmlFor={statementId}
            className="mb-2 block text-xs font-semibold text-ink"
          >
            Criterion statement
          </label>
          <textarea
            id={statementId}
            rows={3}
            maxLength={1200}
            value={criterion.statement}
            onChange={(event) => onChange(criterion.id, { statement: event.target.value })}
            aria-describedby={`${statementId}-hint`}
            placeholder="Describe one outcome a reviewer can observe…"
            className="min-h-28 w-full resize-y rounded-xl border border-line bg-canvas/55 px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-muted-ink/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/10"
          />
          <p id={`${statementId}-hint`} className="mt-1.5 text-xs leading-5 text-muted-ink">
            One criterion should describe one scorable expectation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <div>
            <label htmlFor={weightId} className="mb-2 block text-xs font-semibold text-ink">
              Weight <span className="font-normal text-muted-ink">(−100 to 100)</span>
            </label>
            <div className="flex h-10 items-center rounded-xl border border-line bg-canvas/55 focus-within:border-moss focus-within:ring-4 focus-within:ring-moss/10">
              <input
                id={weightId}
                type="number"
                min={-100}
                max={100}
                step={1}
                value={criterion.weight}
                aria-label={`Weight for criterion ${index + 1}, from negative 100 to 100`}
                onChange={(event) => {
                  const parsed = Number(event.target.value)
                  const value = Number.isFinite(parsed)
                    ? Math.max(-100, Math.min(100, Math.trunc(parsed)))
                    : 0
                  onChange(criterion.id, { weight: value })
                }}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pr-3 text-xs text-muted-ink">pts</span>
            </div>
          </div>

          <div>
            <label htmlFor={kindId} className="mb-2 block text-xs font-semibold text-ink">
              Criterion type
            </label>
            <select
              id={kindId}
              value={criterion.kind}
              onChange={(event) =>
                onChange(criterion.id, { kind: event.target.value as Criterion['kind'] })
              }
              className="h-10 w-full rounded-xl border border-line bg-canvas/55 px-3 text-sm text-ink outline-none focus-visible:border-moss focus-visible:ring-4 focus-visible:ring-moss/10"
            >
              <option value="explicit">Explicit</option>
              <option value="implicit">Implicit</option>
            </select>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

export function RubricEditor({
  taskPrompt,
  criteria,
  findingsByCriterion,
  analysisIsCurrent,
  storageMessage,
  onTaskPromptChange,
  onCriterionChange,
  onAddCriterion,
  onDeleteCriterion,
  onLoadSample,
  onClearRubric,
}: RubricEditorProps) {
  return (
    <section
      id="workspace"
      aria-labelledby="editor-heading"
      className="min-w-0 rounded-[1.6rem] border border-line bg-surface p-5 shadow-[0_18px_48px_rgba(38,54,43,0.045)] sm:p-6 lg:p-7"
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-moss">
            01 / Rubric editor
          </p>
          <h2 id="editor-heading" className="font-editorial text-3xl tracking-[-0.035em] text-ink">
            Your rubric
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-ink">
            Start with the fictional 5K sample or shape a rubric of your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-line bg-surface px-3 text-ink hover:bg-moss-soft"
            onClick={onLoadSample}
          >
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Load sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-3 text-muted-ink hover:bg-clay-soft hover:text-clay"
            onClick={onClearRubric}
          >
            <Eraser data-icon="inline-start" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </div>

      <div className="mb-7 rounded-2xl border border-line/80 bg-canvas/55 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="task-prompt" className="text-sm font-semibold text-ink">
            Assignment prompt
          </label>
          <Badge variant="outline" className="border-line bg-surface text-muted-ink">
            Fictional 5K task
          </Badge>
        </div>
        <textarea
          id="task-prompt"
          rows={4}
          maxLength={4000}
          value={taskPrompt}
          onChange={(event) => onTaskPromptChange(event.target.value)}
          placeholder="Add the task students are being evaluated on…"
          className="min-h-28 w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-muted-ink/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-moss/10"
        />
        <p className="mt-2 text-xs leading-5 text-muted-ink">
          Task context is kept for your report; checks focus on criterion wording and weights.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-ink">Criteria</h3>
          <p className="mt-1 text-xs text-muted-ink">
            {criteria.length} {criteria.length === 1 ? 'criterion' : 'criteria'} · weights range from −100 to 100
          </p>
        </div>
        {!analysisIsCurrent && (
          <Badge variant="outline" className="border-line bg-canvas text-muted-ink">
            Changes need a fresh review
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3" aria-label="Rubric criteria">
        {criteria.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-canvas/45 px-5 py-8 text-center">
            <p className="font-editorial text-xl text-ink">A clear rubric starts with a criterion.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-ink">
              Add a row to define a scorable expectation. You can run the checker even while a row is empty.
            </p>
          </div>
        ) : (
          criteria.map((criterion, index) => (
            <CriterionRow
              key={criterion.id}
              criterion={criterion}
              index={index}
              rowFindings={findingsByCriterion[criterion.id] ?? []}
              analysisIsCurrent={analysisIsCurrent}
              onChange={onCriterionChange}
              onDelete={onDeleteCriterion}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-dashed border-line bg-transparent px-4 text-ink hover:border-moss hover:bg-moss-soft"
          onClick={onAddCriterion}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Add criterion
        </Button>
        <p className="max-w-xs text-xs leading-5 text-muted-ink sm:text-right" role="status" aria-live="polite">
          {storageMessage}
        </p>
      </div>
    </section>
  )
}
