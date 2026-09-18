# FZM AI Studio 2.0 - Real Provider Capability Audit

Generated: 2026-09-18

Scope: Phase 4.2 provider readiness audit. No real generation request was executed.

## Summary

| Provider ID | Name | Kind | Enabled | Base URL | Key | Models | Browser DTO Safe |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| `moyu` | Moyu / magic-yu relay | `moyu` | YES | `https://www.moyu.info/v1` | masked only | 2 | YES |
| `replicate` | GPTsAPI | `gptsapi` | YES | `https://api.gptsapi.net/v1` | masked only | 3 | YES |

Disabled imported providers are present for OpenAI, Gemini, fal.ai, ComfyUI, and Kling. They are not candidates for paid smoke until manually configured/enabled.

## Capability Matrix

| Provider | Kind | Model ID | Label | image.generate | image.edit | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Moyu | `moyu` | `gpt-image-2` | GPT-Image-2 | YES | YES | Server internal protocol: OpenAI Images. Hidden from browser DTO. |
| Moyu | `moyu` | `gemini-3-pro-image-preview` | Gemini 3 Pro Image Preview | YES | YES | Server internal protocol: Gemini native. Hidden from browser DTO. |
| GPTsAPI | `gptsapi` | `gpt-image-2` | GPTsAPI GPT-Image-2 | YES | NO | Server internal provider path: OpenAI. Hidden from browser DTO. |
| GPTsAPI | `gptsapi` | `gemini-3.1-flash-image-preview` | GPTsAPI Gemini 3.1 Flash Image | YES | NO | Server internal provider path: Google. Hidden from browser DTO. |
| GPTsAPI | `gptsapi` | `gemini-3-pro-image-preview` | GPTsAPI Gemini 3 Pro Image | YES | NO | Server internal provider path: Google. Hidden from browser DTO. |

## Picker Audit

- Image Generate provider picker: `moyu`, `replicate`.
- Image Edit provider picker: `moyu` only.
- GPTsAPI image edit visibility: NO.
- Moyu image edit visibility: YES.
- Model IDs preserved: YES.

## Security Audit

- `GET /api/v2/providers` includes only masked key fields.
- Browser DTO does not include `secret_json`, raw `apiKey`, `Authorization`, `endpointMode`, `providerPath`, or `protocol`.
- Raw keys are present only in server-side SQLite `provider_configs.secret_json`.
- `data/v2/fzm.db` remains ignored by git.

## Base URL Audit

| Provider | Base URL | Normalization Risk |
| --- | --- | --- |
| Moyu | `https://www.moyu.info/v1` | PASS: no `/v1/v1`, `/v1/v1beta`, or `/v1/api/v3` path duplication expected. |
| GPTsAPI | `https://api.gptsapi.net/v1` | PASS: no `/v1/v1`, `/v1/v1beta`, or `/v1/api/v3` path duplication expected. |

## Provider Test Mode

- GPTSAPI_TEST_MODE = NOT_RUN_COST_GATED
- MOYU_TEST_MODE = NOT_RUN_COST_GATED
- GEMINI_TEST_MODE = NOT_RUN_NO_ENABLED_GEMINI_PROVIDER

No config test or live probe was run against real providers.
