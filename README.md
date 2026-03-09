# memories-cli

A practical command-line interface for [Memories.ai](https://memories.ai) — built for developers, automation, and agent workflows.

## Why a CLI

[Memories.ai](https://memories.ai) provides a powerful video understanding platform: one-time video indexing, semantic search, multi-video analysis, AI chat, transcription, and Memory Augmented Generation (MAG). Their REST API covers all of this.

But if you're building automation — or integrating video intelligence into an AI agent — raw API calls get tedious fast. You end up re-implementing auth management, polling for processing status, parsing responses, clipping video segments, and handling error quirks.

`memories-cli` wraps the official Memories.ai API into small, composable shell commands. It's designed to work equally well when a human types it in a terminal, when a shell script chains commands together, or when an AI agent calls it programmatically.

## What this tool is

- A **third-party** CLI wrapper around the [Memories.ai API](https://api-tools.memories.ai/api-reference/getting-started/overview)
- Human-friendly by default (colored tables, progress spinners), machine-friendly with `--json`
- Suitable for terminal use, shell scripts, CI pipelines, and AI agent orchestration
- Not affiliated with Memories.ai — just a developer tool built on their public API

## Use this when

- You want to call Memories.ai from a terminal, script, CI job, or AI agent
- You're building workflows like `upload -> wait -> search -> chat`
- You need to query a video library with natural language from the command line
- You want JSON output that can be piped into `jq`, other tools, or consumed by agents
- You're managing multiple projects or tenants via `unique_id` namespacing

## Don't use this when

- You only want to explore the API in a browser — use the [web dashboard](https://memories.ai/app) instead
- You need an endpoint that hasn't been wrapped yet (see [Capability Map](#capability-map) below)
- You prefer the hosted UI experience over command-line workflows

## Capability Map

How Memories.ai's official capabilities map to CLI commands:

| Memories.ai capability | CLI command | Notes |
|---|---|---|
| Upload video (URL) | `memories video upload <url>` | Supports `--callback` for webhook |
| Upload video (file) | `memories video upload-file <path>` | Auto MIME detection |
| List videos | `memories video ls` | Filter by status |
| Check video status | `memories video info <videoNo>` | Lightweight, agent-friendly |
| Wait for processing | `memories video wait <videoNo...>` | Blocking, for scripts/CI |
| Download video | `memories video download <videoNo>` | With `--start`/`--end` clipping |
| Delete videos | `memories video delete <videoNo...>` | |
| Video transcription | `memories video transcript <videoNo>` | Video or `--audio` |
| Private-library search | `memories search video <query>` | Semantic, supports `--download` |
| Public-platform search | `memories search public <query>` | TikTok, YouTube, Instagram |
| Audio transcript search | `memories search audio <videoNo> <query>` | |
| Chat with specific video | `memories chat video <videoNo> <prompt>` | |
| Chat with personal media | `memories chat personal <prompt>` | Recommended for general Q&A |
| Video captioning | `memories caption video <url>` | With `--think` reasoning mode |
| Image captioning | `memories caption image <url>` | |
| Text memory — add | `memories memory add <content>` | Supports piped stdin |
| Text memory — search | `memories memory search <query>` | Semantic search |
| Text memory — list | `memories memory ls` | |
| Social import by URL | `memories scrape url <url>` | TikTok, YouTube, Instagram, Twitter |
| Social import by hashtag | `memories scrape hashtag <tag>` | |
| Social import by creator | `memories scrape creator <url>` | |

**Not yet covered:** extract-frames, video-clip, video-edit, video-split, image/text/video embeddings, search-clips-by-image, human-reid, streaming-caption, v2 API endpoints. PRs welcome.

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
memories auth whoami   # Verify
```

Get your API key at [api-platform.memories.ai](https://api-platform.memories.ai).

### Set a Namespace (Optional)

```bash
# All data is scoped by unique_id. Default is "default".
memories auth set unique_id my-project
```

### Try It

```bash
# Search TikTok for "baby laughing" and see results
memories search public "baby laughing" --platform TIKTOK

# Same thing, but download the matching clips
memories search public "baby laughing" --platform TIKTOK --download ./clips

# Ask a question across your entire video library
memories chat personal "What topics are covered in my videos?"
```

## Output Contract

This matters if you're piping output or calling from an agent:

| Behavior | Detail |
|---|---|
| `--json` flag | Returns clean JSON on **stdout** |
| Progress / hints | Written to **stderr** (won't pollute piped data) |
| Exit code `0` | Success |
| Non-zero exit code | Command failed |
| Long-running tasks | Return `videoNo` / `taskId` immediately; poll with `video info` or block with `video wait` |
| Streaming | Only with `--stream` flag on chat commands |

```bash
# Safe to pipe — stderr spinner doesn't appear in output
memories search video "cooking" --json | jq '.[0].videoNo'

# Agent can check exit code
memories video info VI123 --json && echo "ready" || echo "failed"
```

## Command Reference

### Video Management

```bash
# Upload from URL or local file
memories video upload "https://example.com/video.mp4"
memories video upload-file ./local-video.mp4

# Upload with webhook callback (for your backend)
memories video upload "https://..." --callback "https://your-server.com/webhook"

# Check processing status (lightweight, one API call)
memories video info VI685903399832780800 --json
# → {"video_no":"VI...","status":"PARSE","ready":true,...}

# Block until processing completes (for scripts/CI)
memories video wait VI685903399832780800 --timeout 300

# List all videos
memories video ls

# Download with time-range clipping (requires ffmpeg)
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

# Search + download matching clips in one step
memories search public "dramatic moment" --platform TIKTOK --download ./clips

# Search within audio transcripts
memories search audio VI1234567 "mentioned the product launch"
```

### Chat with Videos

```bash
# Chat about a specific video
memories chat video VI685903399832780800 "What happens in this video?"

# Chat across your entire library (recommended for general questions)
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

## Workflow Recipes

### Recipe 1: Agent — On-Demand Status Check

The agent doesn't block. It checks status only when the user comes back.

```
Turn 1 (User: "Upload and analyze this video"):
  $ memories video upload "$URL" --json       → videoNo
  $ memories video info "$VIDEO_NO" --json    → {"ready": false}
  → "Video uploaded (VI123456). Still processing — ask me again shortly."

Turn 2 (User: "Is my video ready?"):
  $ memories video info "$VIDEO_NO" --json    → {"ready": true}
  $ memories chat personal "Analyze VI123456" --json
  → Delivers analysis to user
```

Total status checks: **2** (not 360).

### Recipe 2: Script — Upload, Wait, Process

When you need everything in one shot:

```bash
VIDEO_NO=$(memories video upload "$URL" --json | jq -r '.videoNo')
memories video wait "$VIDEO_NO" --timeout 600
memories search video "key moment" --download ./results --json
```

### Recipe 3: Search, Download, and Clip

```bash
# Find clips on TikTok and download the matching segments
memories search public "product review" --platform TIKTOK --download ./clips --json

# --download automatically:
# 1. Downloads each matching video
# 2. Clips to the exact startTime-endTime from search results
# 3. Returns file paths for further processing
```

### Recipe 4: Piped Composition

```bash
# Search → feed top result into chat
memories search video "important meeting" --json \
  | jq -r '.[0].videoNo' \
  | xargs -I {} memories chat video {} "Summarize the key decisions"

# Bulk upload from a URL list
cat video_urls.txt | xargs -I {} memories video upload {} --json
```

## Decision Guide

Not sure which command to use? Start here:

| I want to... | Use this |
|---|---|
| Ask a question about my whole library | `memories chat personal` |
| Ask about a specific video | `memories chat video` |
| Find moments across my private videos | `memories search video` |
| Find content on TikTok / YouTube | `memories search public` |
| Check if a video is ready (from an agent) | `memories video info --json` |
| Wait until a video is ready (in a script) | `memories video wait` |
| Understand a video without uploading | `memories caption video` |
| Store and retrieve text knowledge | `memories memory add` / `search` |

## Failure Modes and Recovery

| Symptom | Likely Cause | Recovery |
|---|---|---|
| Empty `chat video` response | Credits depleted (0402) or video still indexing | Check credits at [api-platform.memories.ai](https://api-platform.memories.ai). Try `memories video info` to confirm status. Use `chat personal` as fallback. |
| `API Error [0402]` | Insufficient credits | Top up your plan. The error message includes a direct hint. |
| `API Error [0429]` | Rate limited | Wait a few seconds and retry. Avoid rapid sequential calls. |
| `Streaming endpoint returned an error` | Server-side stream failure | Retry without `--stream`. |
| `Download not available for this video` | Private videos (VI-prefix) can't be downloaded | Use `search`, `chat`, or `transcript` to access the content instead. |
| Video stuck in `UNPARSE` | Still processing | Use `video info` to check. Short clips typically finish in under a minute; longer videos may take several minutes. |

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
│       ├── client.js        # API client (Memories.ai REST wrapper)
│       ├── config.js        # XDG-compliant config persistence
│       ├── context.js       # Shared helpers (createClient, getUniqueId)
│       └── output.js        # Formatting (table, JSON, colored status)
```

**Key design decisions:**

- **Native `FormData`** (Node 18+) instead of the `form-data` npm package — required for compatibility with Memories.ai's Spring backend
- **ffmpeg integration** for client-side video clipping — search results include `startTime`/`endTime`, so we clip locally rather than downloading full videos
- **Stderr for status, stdout for data** — spinners and hints go to stderr so piped JSON stays clean
- **`unique_id` as namespace** — all data is scoped, enabling multi-tenant or multi-project usage from a single API key

## Requirements

- Node.js >= 18 (for native `FormData` and `fetch`)
- ffmpeg (optional, for video clipping with `--start`/`--end` and `search --download`)
- A [Memories.ai](https://api-platform.memories.ai) API key

## License

MIT
