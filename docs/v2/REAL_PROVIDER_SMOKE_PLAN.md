# FZM AI Studio 2.0 - Real Provider Smoke Plan

Generated: 2026-09-18

Scope: Phase 4.1 readiness audit only. No real paid provider request was executed.

## Audit Result

- Enabled real V2 providers found: 0
- Fake/dev providers excluded: yes
- Masked keys only: yes
- Raw API keys printed: no
- Paid smoke executed: no
- Paid smoke ready: no

## Current Enabled Real Providers

No enabled real V2 provider configuration was found in the default V2 data root (`data/v2`).

## Smoke Tests To Run After Manual Configuration

Run these only after a human explicitly approves paid smoke testing and confirms enabled V2 provider configs exist.

| Test | Provider | Model exact ID | Action | Expected API path class | Expected output | Expected job behavior | Max duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GPTsAPI, if configured | From V2 provider config | `image.generate` | OpenAI-compatible image generation | 1 image, 1:1, lowest supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 2 | Moyu OpenAI Image, if configured | From V2 provider config | `image.generate` | OpenAI-compatible image generation | 1 image, 1:1, lowest supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 3 | Moyu OpenAI Image, if configured | From V2 provider config | `image.edit` | OpenAI-compatible image edit with reference | 1 edited image from a small reference | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 4 | Gemini image, if configured | From V2 provider config | `image.generate` | Gemini image generation | 1 image, minimum supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |

## Preconditions

- Use only enabled real providers listed by V2 Provider Settings.
- Verify `Provider`, `Model`, and capabilities in the UI before submitting.
- Use 1 output, 1:1 aspect ratio, and the minimum quality the provider supports.
- Do not enable automatic provider failover.
- Stop after the first paid smoke failure and inspect Job / Generation history.

## Safety Notes

- Re-submit after ambiguous transport failure must reuse the same client `requestId`.
- Re-run restores settings into PromptBar only; it must not auto-submit.
- Failed provider A must not auto-submit to provider B.
