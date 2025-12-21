# Quick Start - Fixed Pluely with Direct Gemini API

## What Was Fixed?
✅ Removed Pluely backend dependency
✅ Enabled direct API calls to Gemini (and all other AI providers)
✅ No license required - use your own API keys
✅ All features work: chat, completion, audio, screenshots

## Setup (3 Steps)

### 1. Get Gemini API Key
Visit: https://aistudio.google.com/app/apikey

### 2. Configure Pluely
- Open Settings
- Provider: **Gemini**
- API Key: *paste your key*
- Model: **gemini-2.0-flash-exp** (or gemini-1.5-flash, gemini-1.5-pro)

### 3. Start Chatting!
That's it! No backend, no license, just direct API access.

## Supported Models
- `gemini-2.0-flash-exp` ⭐ (recommended)
- `gemini-1.5-flash` (fast)
- `gemini-1.5-pro` (powerful)

## Files Changed
1. `src/lib/functions/ai-response.function.ts` - Removed Pluely API routing
2. `src/hooks/useChatCompletion.ts` - Direct API only
3. `src/hooks/useCompletion.ts` - Direct API only
4. `src/hooks/useSystemAudio.ts` - Direct API only

## Build & Run
```bash
cd pluely-master
npm run build
npm run tauri dev
```

## Troubleshooting
- **429 Error**: API quota exceeded, wait 24 hours
- **404 Error**: Check model name spelling
- **401 Error**: Invalid API key, get new one

## More Info
See `GEMINI_DIRECT_API_FIX.md` for complete technical details.
