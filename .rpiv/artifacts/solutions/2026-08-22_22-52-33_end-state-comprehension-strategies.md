---
date: 2026-08-22T22:52:33+0100
author: Pedro Mesquita
commit: acf9c8b
branch: main
repository: slopstop
topic: "End-state comprehension strategies"
confidence: high
complexity: medium
status: ready
tags: [solutions, conversation, frame, comprehension, planning]
last_updated: 2026-08-22T23:04:46+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Adaptive comprehension proof accepted after exercising all four strategies."
---

# Solution Analysis: End-state Comprehension Strategies

**Date**: 2026-08-22T22:52:33+0100
**Author**: Pedro Mesquita
**Commit**: acf9c8b
**Branch**: main
**Repository**: slopstop

## Research Question

Which creative interaction strategies should SlopStop use during Frame to prove that the model understood the intended completed product before the user reviews or approves the technical plan?

## Summary

**Problem**: A model can repeat the user's words while still imagining the wrong completed product. A readable plan can therefore create false confidence rather than shared understanding.

**Recommended**: Expectation Cards as the stable review surface, combined with a small adaptive comprehension loop: optional Future Walkthroughs for ambiguous journeys, a bounded Prediction Game for consequential or disputed behavior, and a passive Traceable Mirror that exposes coverage gaps without interrupting Conversation.

**Effort**: Medium. This requires a Frame interaction model, versioned projections, correction flows, and behavioral tests, but no new external framework.

**Confidence**: High. Each strategy maps to an existing domain seam and covers a different failure mode.

## Problem Statement

**Requirements:**

- Conversation remains the primary Frame surface.
- The model exposes its end-state understanding in plain language before technical implementation detail.
- Review starts with an overall summary and then focuses on user stories where understanding may diverge.
- Corrections revise provisional Decision Canvas content and never mutate Canonical state without explicit acceptance.
- An optional provisional planning preview may be opened without being confused with the accepted Project map.

**Constraints:**

- Model conversation is not canonical authority.
- The workflow must not force a separate approval for every correct story.
- Technical detail remains inspectable but visually and conceptually separate from end-state review.
- Unknown, disputed, uncovered, and broken states must remain distinct from accepted coverage.
- Every interaction requires keyboard and plain-text equivalents.

**Success criteria:**

- The user can point to the exact part of the model's end-state understanding that is wrong.
- Consequential misunderstandings are tested through concrete predictions, not only summaries.
- Accepted expectations remain traceable into decisions, technical planning, and later test contracts.
- Routine planning stays short; deeper proof appears only when ambiguity or risk justifies it.

## Current State

**Existing product contract:**

- `PRODUCT.md:49-51` makes Conversation the Frame surface, separates end-state review from technical detail, and keeps the planning preview provisional.
- `CONTEXT.md:62-69` defines Frame, Decision Canvas, Behavior Contract, Test Contract, and Comprehension checkpoint.
- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:84-89` requires plain-language teach-back, user stories, corrections, layered review, and an optional provisional preview.
- `docs/adr/0002-project-canonical-state.md:13-14` requires explicit accepted revisions before provisional content becomes canonical.

**Current prototype gap:**

- `apps/desktop/src/renderer/prototype/prototype-app.tsx:953-1069` currently presents a generic feed, target selector, Prompt packet, and composer rather than a Frame comprehension journey.
- `apps/desktop/src/renderer/prototype/prototype-app.test.tsx:7-77` does not yet test teach-back, story correction, comprehension checks, or plan acceptance.

## Solution Options

### Option 1: Future Walkthrough

**How it works:**

The model narrates a realistic use of the finished product step by step. Each step states the user's situation or action, the visible result, and the decision or expectation that supports it.

**Pros:**

- Strongly exposes a wrong mental model because the model must apply its understanding.
- Uses natural, non-technical language.
- Lets the user identify the exact step where expected behavior diverges.

**Cons:**

- Can become long and repetitive for small or clear changes.
- A happy-path-only walkthrough can hide failure behavior.
- Needs explicit links back to the Canvas and Behavior Contract to avoid becoming disposable prose.

**Complexity:** Medium

- Best as an optional block for multi-step or materially ambiguous journeys.
- Requires step identity, correction, and provenance into provisional Frame content.

### Option 2: Expectation Cards

**How it works:**

Each user story becomes a compact card containing the expected observable outcome, one concrete example, a relevant non-goal, and declared uncertainty. The user marks or rewrites only the part that is wrong.

**Pros:**

- Strongest plain-language baseline.
- Makes corrections precise without requiring a complete rewrite.
- Maps directly to Decision Canvas and Behavior Contract fields.
- Supports batch review after the overall summary.

**Cons:**

- Does not itself prove that the model can apply the expectation to a new scenario.
- Can become a wall of cards unless grouped and progressively disclosed.
- Only exposes assumptions the model remembered to declare.

**Complexity:** Medium

- Requires stable item identity and a correction state, but fits the accepted layered review directly.

### Option 3: Prediction Game

**How it works:**

For a small set of consequential, uncertain, or disputed expectations, the model answers concrete questions such as "What happens if...?" The set covers a normal path, one meaningful edge, and one relevant failure when applicable.

**Pros:**

- Strongest direct proof of comprehension.
- Best coverage of edge and failure behavior.
- Accepted answers can become Behavior Contract examples and Test Contract scenarios.

**Cons:**

- Becomes tiring if applied to every story.
- Interrupts flow if presented as a large quiz.
- Needs a clear trigger so routine work can use the quick path.

**Complexity:** Low to medium

- The interaction is small, but selection, recording, and contract traceability must be explicit.

### Option 4: Traceable Mirror

**How it works:**

An optional coverage view links each user expectation to the decisions that support it and, in a separate technical layer, to the plan items that implement it. It highlights missing, disputed, uncovered, and broken links.

**Pros:**

- Strongest traceability and omission detection.
- Preserves the separation between behavior and implementation.
- Can remain passive and only draw attention to gaps.

**Cons:**

- Complete links can create false confidence without a behavioral prediction check.
- Requires stable identities and versioned relationships.
- Has little value before enough structured content exists.

**Complexity:** Medium to high

- The UI can be simple, but correct versioned linkage spans Canvas, contracts, and plans.

## Comparison

| Criterion | Future Walkthrough | Expectation Cards | Prediction Game | Traceable Mirror |
| --- | --- | --- | --- | --- |
| Detects misunderstanding | 5/5 | 4/5 | 5/5 | 4/5 |
| Plain-language clarity | 4/5 | 5/5 | 4/5 | 4/5 |
| Low user effort | 4/5 | 4/5 | 3/5 | 3/5 |
| Low conversation interruption | 3/5 | 4/5 | 3/5 | 4/5 |
| Edge and failure coverage | 3/5 | 3/5 | 5/5 | 3/5 |
| Traceability | 3/5 | 4/5 | 4/5 | 5/5 |

## Recommendation

**Selected:** Expectation Cards as the baseline, with an adaptive comprehension loop.

**Rationale:**

- Expectation Cards fit the already accepted summary-first, stories-second review without making every story a separate approval.
- Future Walkthroughs and Prediction Games catch errors that static cards cannot, but should activate only for ambiguity, consequence, dispute, or surprising behavior.
- Traceable Mirror should be a passive optional view. It proves transport of intent across layers, not comprehension by itself.
- Together, the four strategies cover wording errors, applied-behavior errors, edge-case errors, and lost-requirement errors.

**Why not the alternatives alone:**

- Future Walkthrough alone is too verbose and can overfit to a happy path.
- Prediction Game alone feels like an interrogation and lacks a stable review surface.
- Traceable Mirror alone proves document coverage, not correct behavioral understanding.
- Expectation Cards alone do not force the model to apply its claimed understanding.

**Trade-offs:**

- Accept a small structured review layer in exchange for precise correction and durable traceability.
- Keep deeper proof adaptive rather than exhaustive, accepting that low-risk stories may receive only summary and card review.

**Recommended interaction sequence:**

1. **Mirror the destination**: model presents one short plain-language end-state summary.
2. **Review expectations**: user inspects grouped Expectation Cards and corrects only divergences.
3. **Rehearse where needed**: ambiguous multi-step stories can open a Future Walkthrough.
4. **Test understanding**: consequential, disputed, or surprising behavior receives a bounded Prediction Game.
5. **Inspect coverage**: optional Traceable Mirror highlights expectations without decisions, disputed links, and later plan gaps.
6. **Review technical plan**: implementation mechanics appear in a separate layer linked back to accepted expectations.
7. **Accept revision**: only explicit acceptance creates canonical Feature, Waypoint, relationship, and contract content for the Project map.

## Scope Boundaries

- Build one coherent Frame comprehension journey, not four independent modes.
- Keep Conversation primary and all structured views optional or progressively disclosed.
- Do not treat model confidence, prose quality, or complete-looking links as proof of correctness.
- Do not make every story require its own approval action.
- Do not merge the provisional Decision Canvas preview with the accepted Project map.
- Do not define implementation architecture or persistence ownership in this solution analysis.

## Testing Strategy

**Behavior tests:**

- The user can correct one field of an Expectation Card without rewriting unrelated accepted content.
- A disputed or consequential story can enter a Prediction Game and persist its corrected observable outcome.
- A Future Walkthrough correction revises provisional Frame content rather than Canonical state.
- Traceable Mirror distinguishes covered, disputed, missing-decision, missing-plan, and broken-link states.
- Technical details remain hidden or separate until end-state review completes.
- No canonical Project map content is created before explicit acceptance.

**Accessibility tests:**

- Every card, prediction, walkthrough step, coverage state, correction, and acceptance works by keyboard.
- A plain-text projection exposes the same relationships and states as the visual review.
- Status never depends on color alone.

## Open Questions

**Resolved during exploration:**

- One strategy does not cover every comprehension failure. The coherent solution is a baseline plus adaptive checks.
- The optional provisional planning preview remains distinct from the accepted Project map.

**Requires user input:**

- Which conditions should automatically suggest a Future Walkthrough or Prediction Game, and may the user always invoke them manually?
- Should Expectation Cards use classic "As a / I want / so that" wording, scenario wording, or choose the clearest form per story?
- How should the user enter and leave the Traceable Mirror without losing Conversation context?

**Blockers:**

- None for continued requirements discovery.

## References

- `PRODUCT.md:39-53` - accepted workspace and Frame interaction contract.
- `CONTEXT.md:62-69` - Frame, Decision Canvas, contracts, and comprehension vocabulary.
- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:23-37` - false-alignment problem and workspace goals.
- `.rpiv/artifacts/discover/2026-08-22_19-18-10_workspace-supervision-experience.md:84-89` - current comprehension requirements.
- `docs/adr/0002-project-canonical-state.md:9-24` - explicit accepted revision boundary.
- `.rpiv/decisions/degrade-distinguishes-broken.md:18-24` - broken, absent, and clean states remain distinct.

## Follow-up Analysis 2026-08-22T23:01:03+0100

The developer exercised Expectation Cards against five current SlopStop expectations: Conversation-led planning, end-state comprehension, model-context transparency, memory control, and explicit plan-to-map acceptance. The content represented the intended experience, but the developer did not like the technique itself.

This weakens the original recommendation of Expectation Cards as the default review surface. They remain a viable optional compact projection, but the primary interaction should stay more conversational unless later exercises reverse this preference.

## Follow-up Analysis 2026-08-22T23:02:35+0100

The developer exercised the Prediction Game against normal Frame work, a clear quick-path change, a semantic recovery misunderstanding, and stale memory exclusion. The developer reported that this technique helps substantially more than the card-based review.

Prediction Game is now the strongest tested candidate for proving comprehension. This does not yet settle whether it should be mandatory, adaptively suggested, or manually invoked. The remaining Traceable Mirror exercise should determine whether prediction needs a separate coverage view or whether traceability can stay implicit.

## Follow-up Analysis 2026-08-22T23:03:51+0100

The developer exercised a Traceable Mirror using current SlopStop expectations and their distinct comprehension, decision, and technical-coverage states. The view was useful, but the developer selected final plan approval as its correct placement rather than an always-available or continuously visible Conversation element.

The tested shape is now: conversational comprehension, Prediction Game as the strongest active proof candidate, Expectation Cards retained only as an optional alternative, and Traceable Mirror reserved for the final approval boundary. The Future Walkthrough remains validated as an accurate end-to-end explanation and possible ambiguity aid.

## Follow-up Analysis 2026-08-22T23:04:46+0100

After exercising all four strategies, the developer accepted adaptive comprehension proof. Prediction questions are the primary active proof for consequential, ambiguous, corrected, disputed, surprising, limit, or failure behavior. The user can invoke them directly, and clear low-risk work keeps a quick path.

Future Walkthrough remains optional for ambiguous multi-step journeys. Expectation Cards remain an alternate compact projection rather than the primary interaction. Traceable Mirror is required at final plan approval to expose accepted support, disputes, missing decisions, missing plan coverage, and broken links before canonical Project map generation.
