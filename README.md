# memories-cli

A command-line interface for [memories.ai](https://memories.ai) — designed as **agent infrastructure** for video understanding.

## Why This Exists

The web is drowning in video. TikTok, YouTube, Instagram — billions of hours of content, but no good way for AI agents to *understand* and *work with* video programmatically.

[memories.ai](https://memories.ai) offers powerful video understanding APIs: semantic search across video content, AI-powered chat with videos, transcription, and more. But APIs alone aren't enough. AI agents — like Claude, GPT, or custom LLM pipelines — need a **composable, scriptable interface** that speaks their language: structured commands, JSON output, and Unix-style piping.

That's what `memories-cli` is. It turns memories.ai's video intelligence into building blocks that any AI agent can use.

## Design Philosophy

### Agent-First, Human-Friendly

Every command is designed for two audiences:

- **AI agents** get `--json` output, predictable exit codes, and machine-parseable results
- **Humans** get colored tables, spinners, and helpful hints

```bash
# Human mode (default)
memories search public "baby crying" --platform TIKTOK
# → Pretty table with colors

# Agent mode
memories search public "baby crying" --platform TIKTOK --json
# → Clean JSON array, ready for programmatic consumption
```

### Composable Primitives, Not Monolithic Workflows

The CLI doesn't try to be clever. It provides small, focused commands that agents (or shell scripts) compose into workflows:

```bash
# Upload → Wait → Search → Download — each step is independent
VIDEO_NO=$(memories video upload "$URL" --json | jq -r '.videoNo')
memories video wait "$VIDEO_NO"
memories search video "key moment" --json | jq '.[0]'
memories video download "$VIDEO_NO" --start 10 --end 15
```

### Two Polling Patterns for Two Use Cases

We discovered an important architectural distinction during development:

| Command | Who Uses It | How It Works |
|---------|------------|--------------|
| `video info` | AI agents | Single status check per conversation turn. Agent checks only when it needs the video. Zero wasted calls. |
| `video wait` | Scripts & CI pipelines | Blocking poll loop. Runs `upload && wait && process` in one shot. |

An AI agent doesn't sit around waiting. It uploads a video, tells the user "processing", and checks status on the next interaction. A shell script, on the other hand, needs to block until ready. Both patterns are first-class.

### Honest Error Messages

The API has quirks. We hit them so you don't have to:

- **Error 0402** (insufficient credits) — surfaces clearly instead of returning empty results silently
- **Error 0429** (rate limited) — tells you to wait and retry
- **Empty chat responses** — warns that the video may still be indexing, suggests `chat personal` as fallback
- **Private video download** — detects and reports that VI-prefixed videos can't be downloaded via the download API

## Quick Start

### Install

```bash
git clone https://github.com/kennyzheng-builds/memories-cli.git
cd memories-cli
npm install
npm link   # Makes 'memories' available globally
```

### Authenticate

```bash
memories auth login <your-api-key>

# Verify
memories auth whoami
```

Get your API key at [app.memories.ai](https://app.memories.ai).

### Set a Namespace (Optional)

```bash
# All data is scoped by unique_id. Default is "default".
memories auth set unique_id my-project
```

## Command Reference

### Video Management

```bash
# Upload from URL or local file
memories video upload "https://example.com/video.mp4"
memories video upload-file ./local-video.mp4

# Upload with webhook callback (for your backend)
memories video upload "https://..." --callback "https://your-server.com/webhook"

# Check processing status (lightweight, agent-friendly)
memories video info VI685903399832780800 --json
# → {"video_no":"VI...","status":"PARSE","ready":true,...}

# Block until processing completes (for scripts/CI)
memories video wait VI685903399832780800 --timeout 300

# List all videos
memories video ls

# Download with time-range clipping
memories video download PI1234567 --start 10 --end 15 -o clip.mp4

# Get transcription
memories video transcript VI685903399832780800

# Delete
memories video delete VI685903399832780800
```

### Semantic Search

```bash
# Search your private video library
memories search video "person walking in the rain"

# Search public platforms
memories search public "baby laughing" --platform TIKTOK
memories search public "cooking tutorial" --platform YOUTUBE

# One-step: search + download matching clips
memories search public "dramatic moment" --platform TIKTOK --download ./clips

# Search within audio transcripts
memories search audio VI1234567 "mentioned the product launch"
```

### Chat with Videos

```bash
# Chat about a specific video
memories chat video VI685903399832780800 "What happens in this video?"

# Chat across your entire library (recommended)
memories chat personal "Find videos where someone is cooking pasta"

# Streaming mode
memories chat personal "Summarize my recent videos" --stream

# Multi-turn conversation
memories chat personal "What's in my videos?" --session 12345
memories chat personal "Tell me more about the second one" --session 12345
```

### Memory

```bash
# Store a memory
memories memory add "Meeting notes: discussed Q4 roadmap with the team"

# Semantic search across memories
memories memory search "roadmap discussions"

# List all memories
memories memory ls --tags "meeting,important"

# Pipe content in
echo "Important insight from today" | memories memory add -
```

### Social Media Import

```bash
# Import from a specific URL
memories scrape url "https://www.tiktok.com/@user/video/1234567"

# Import by hashtag
memories scrape hashtag "cooking" --platform TIKTOK -n 20

# Import from a creator's profile
memories scrape creator "https://www.tiktok.com/@creator" -n 10
```

### AI Captioning

```bash
# Analyze a video
memories caption video "https://example.com/video.mp4" -p "What emotions are shown?"

# Analyze an image
memories caption image "https://example.com/photo.jpg" -p "Describe the scene"

# With reasoning mode
memories caption video "https://..." -p "Count the people" --think
```

## Agent Integration Patterns

### Pattern 1: On-Demand Status Check (Recommended for Agents)

The agent doesn't block. It checks status only when the user asks.

```
Turn 1 (User: "Upload and analyze this video"):
  $ memories video upload "$URL" --json       → videoNo
  $ memories video info "$VIDEO_NO" --json    → {"ready": false}
  → "Video uploaded (VI123456). It's still processing — ask me again shortly."

Turn 2 (User: "Is my video ready?"):
  $ memories video info "$VIDEO_NO" --json    → {"ready": true}
  $ memories chat personal "Analyze VI123456" → result
  → Delivers analysis to user
```

Total API calls for status: **2** (not 360).

### Pattern 2: Blocking Pipeline (For Scripts)

When the user explicitly says "wait for it", use `video wait`:

```bash
VIDEO_NO=$(memories video upload "$URL" --json | jq -r '.videoNo')
memories video wait "$VIDEO_NO" --timeout 600
memories search video "key moment" --download ./results --json
```

### Pattern 3: Search → Download → Analyze

```bash
# Find relevant clips across TikTok
memories search public "product review" --platform TIKTOK --download ./clips --json

# The --download flag automatically:
# 1. Downloads each matching video
# 2. Clips to the exact startTime-endTime from search results
# 3. Returns file paths for further processing
```

### Pattern 4: Piped Composition

```bash
# Search → feed results into chat
memories search video "important meeting" --json \
  | jq -r '.[0].videoNo' \
  | xargs -I {} memories chat video {} "Summarize the key decisions"

# Bulk upload from a URL list
cat video_urls.txt | xargs -I {} memories video upload {} --json
```

## Architecture

```
memories-cli/
├── bin/memories.js          # Entry point
├── src/
│   ├── commands/
│   │   ├── auth.js          # Login, config, whoami
│   │   ├── video.js         # Upload, list, download, info, wait, transcript
│   │   ├── search.js        # Private search, public search, audio search
│   │   ├── chat.js          # Video chat, personal chat, streaming
│   │   ├── memory.js        # Add, list, semantic search
│   │   ├── scrape.js        # Import from TikTok/YouTube/Instagram
│   │   └── caption.js       # AI video & image analysis
│   └── lib/
│       ├── client.js        # API client (memories.ai REST wrapper)
│       ├── config.js        # XDG-compliant config persistence
│       ├── context.js       # Shared helpers (createClient, getUniqueId)
│       └── output.js        # Formatting (table, JSON, colored status)
```

**Key design decisions:**

- **Native `FormData`** (Node 18+) instead of the `form-data` npm package — required for compatibility with memories.ai's Spring backend
- **ffmpeg integration** for client-side video clipping — search results include `startTime`/`endTime`, so we clip locally rather than downloading full videos
- **Stderr for status, stdout for data** — spinners and hints go to stderr so piped JSON stays clean
- **`unique_id` as namespace** — all data is scoped, enabling multi-tenant or multi-project usage from a single API key

## Known Limitations

- **Private videos (VI-prefix) can't be downloaded** via the download API. The download endpoint only works for public videos (PI-prefix). For private videos, use `chat` or `search` to interact with the content.
- **`chat video` may return empty content** when credits are depleted (error 0402). The API doesn't always return an explicit error code — it sometimes just returns an empty response. Use `chat personal` as a more reliable alternative.
- **Streaming endpoints** may return `data:"Error"` without details. The CLI detects this and suggests using the non-streaming variant.
- **Video processing time** varies: short clips (~30s) process in under a minute; longer videos may take several minutes. Use `video info` or `video wait` to track status.

## Requirements

- Node.js >= 18 (for native `FormData` and `fetch`)
- ffmpeg (optional, for video clipping — `video download --start/--end` and `search --download`)
- A [memories.ai](https://app.memories.ai) API key

## License

MIT
