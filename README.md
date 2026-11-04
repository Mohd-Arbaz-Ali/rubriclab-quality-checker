# RubricLab

A browser-only rubric quality checker by Mohd Arbaz Ali. RubricLab surfaces wording and weight patterns for human review; it does not grade student work.

## Setup

```bash
pnpm install
pnpm dev
```

Open the local app shown by Next.js. To create a production build, run `pnpm build`.

## Features

- Edit an assignment prompt and rubric criteria, including weight values from -100 to 100 and explicit/implicit tags.
- Add or delete rows, load the fictional 5K sample, and analyze the current rubric.
- Review finding cards, per-row badges, category filters, summary counts, and the four-signal quality checklist.
- Copy or download a JSON report.

## Heuristics

RubricLab checks for vague terms (`good`, `appropriate`, `reasonable`, `thorough`, `clearly`), mental-process wording (`consider`, `understand`, `thought about`), context references (`as above`, `mentioned in prompt`), potential bundling via `and` or `also`, normalized duplicate statements, empty rows, and zero-weight rows.

The negative-criterion alert triggers only when the count of rows with weights below zero divided by **all criterion rows** exceeds 35%. Empty and zero-weight rows remain in the denominator. This is a configurable, project-specific review convention—not a universal rubric standard. Adjust `NEGATIVE_CRITERION_SHARE_THRESHOLD` in `lib/rubric-analysis.ts` to change it. The weight-points chart uses the share of absolute points and is informational only; it does not drive the alert.

## Limitations

These are deterministic text and arithmetic checks, not an AI evaluator. Matches can be false positives or miss issues that require context. The tool does not judge student work, assess rubric coverage, validate criteria against the assignment, or establish fairness. Review every suggestion in context.

## Local storage and privacy

The prompt and criterion rows are saved in this browser's `localStorage`; the app does not upload rubric content to a backend or an AI service. Clearing site data removes the saved workspace. Anyone with access to the same browser profile may be able to view it. JSON export and clipboard actions are user-initiated.
