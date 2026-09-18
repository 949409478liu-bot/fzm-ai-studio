# FZM AI Studio 2.0 - Real Provider Smoke Plan

Generated: 2026-09-18

Scope: Phase 4.1 readiness audit only. No real paid provider request was executed.

## Audit Result

- Enabled real V2 providers found: 2
- Enabled real providers: Moyu (`moyu`), GPTsAPI (`replicate`)
- Fake/dev providers excluded: yes
- Masked keys only: yes
- Raw API keys printed: no
- Paid smoke executed: no
- Paid smoke ready: yes, pending explicit human approval

## Current Enabled Real Providers

| Provider ID | Name | Kind | Base URL | Key | Models |
| --- | --- | --- | --- | --- | --- |
| `moyu` | Moyu / magic-yu relay | `moyu` | `https://www.moyu.info/v1` | masked only | `gpt-image-2`, `gemini-3-pro-image-preview` |
| `replicate` | GPTsAPI | `gptsapi` | `https://api.gptsapi.net/v1` | masked only | `gpt-image-2`, `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview` |

## Smoke Tests To Run After Manual Approval

Run these only after a human explicitly approves paid smoke testing. Do not run them automatically.

| Test | Provider | Model exact ID | Action | Expected API path class | Expected output | Expected job behavior | Max duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | GPTsAPI (`replicate`) | `gpt-image-2` | `image.generate` | GPTsAPI image generation via OpenAI provider path | 1 image, 1:1, lowest supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 2 | Moyu (`moyu`) | `gpt-image-2` | `image.generate` | Moyu OpenAI Images protocol | 1 image, 1:1, lowest supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 3 | Moyu (`moyu`) | `gpt-image-2` | `image.edit` | Moyu OpenAI Images edit/multipart protocol | 1 edited image from one small local reference | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |
| 4 | Moyu (`moyu`) | `gemini-3-pro-image-preview` | `image.generate` | Moyu Gemini-native protocol | 1 image, 1:1, lowest supported quality | queued -> submitting/polling -> downloading/finalizing -> succeeded | 180s |

## Preconditions

- Use only enabled real providers listed by V2 Provider Settings.
- Verify `Provider`, `Model`, and capabilities in the UI before submitting.
- Use 1 output, 1:1 aspect ratio, and the minimum quality the provider supports.
- Do not enable automatic provider failover.
- Stop after the first paid smoke failure and inspect Job / Generation history.
- Total planned paid generation requests: 4 maximum.
- Do not use Best-of-N, batch count > 1, or automatic cross-provider retry.

## Safety Notes

- Re-submit after ambiguous transport failure must reuse the same client `requestId`.
- Re-run restores settings into PromptBar only; it must not auto-submit.
- Failed provider A must not auto-submit to provider B.

## Smoke Result Template

Fill one block per manually approved smoke test.

```text
Provider =
Model =
Action =
Started At =
Generation ID =
Job ID =
Remote Task ID Present = YES/NO
Submit Count =
Poll Count =
Duration =
Final Status =
Asset ID =
Node Attached = YES/NO
Reload Persisted = YES/NO
Cost = UNKNOWN
Error =
```

Never record API keys, Authorization headers, `secret_json`, provider path internals, or raw vendor tickets in this file.
