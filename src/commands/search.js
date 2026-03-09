import { Command } from 'commander';
import { writeFileSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';
import { createClient, getUniqueId, getFormat } from '../lib/context.js';
import { formatOutput, truncate, success, info } from '../lib/output.js';

const search = new Command('search')
  .description('Search across videos, audio, and public sources');

// ─── Shared clip helper ─────────────────────────────────────────────

async function downloadClips(client, items, outDir, spinner) {
  const results = [];
  // Deduplicate by videoNo (download each video once)
  const videoMap = new Map();
  for (const item of items) {
    if (!videoMap.has(item.videoNo)) videoMap.set(item.videoNo, []);
    videoMap.get(item.videoNo).push(item);
  }

  mkdirSync(resolve(outDir), { recursive: true });
  let ffmpegPath;
  try { ffmpegPath = findFfmpeg(); } catch { ffmpegPath = null; }

  let idx = 0;
  for (const [videoNo, clips] of videoMap) {
    spinner.text = `Downloading ${videoNo}...`;
    const res = await client.downloadVideoRaw(videoNo);
    const buffer = Buffer.from(await res.arrayBuffer());

    for (const clip of clips) {
      idx++;
      const start = clip.startTime || '0';
      const end = clip.endTime;
      const outName = `clip_${idx}_${videoNo}_${start}s-${end}s.mp4`;
      const outPath = resolve(outDir, outName);

      if (ffmpegPath && end) {
        const tmpPath = outPath + '.tmp.mp4';
        writeFileSync(tmpPath, buffer);
        spinner.text = `Clipping ${videoNo} [${start}s-${end}s]...`;
        try {
          const duration = String(Number(end) - Number(start));
          execFileSync(ffmpegPath, [
            '-y', '-ss', start, '-i', tmpPath, '-t', duration,
            '-c:v', 'libx264', '-c:a', 'aac', outPath,
          ], { stdio: 'pipe' });
          try { unlinkSync(tmpPath); } catch {}
        } catch {
          // ffmpeg failed, save full video
          try { require('fs').renameSync(tmpPath, outPath); } catch {}
        }
      } else {
        writeFileSync(outPath, buffer);
      }

      const size = statSync(outPath).size;
      results.push({
        file: outPath,
        videoNo,
        videoName: clip.videoName,
        start,
        end: end || 'full',
        score: clip.score,
        size,
      });
    }
  }
  return results;
}

function findFfmpeg() {
  for (const p of ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg']) {
    try { execFileSync(p, ['-version'], { stdio: 'pipe' }); return p; } catch {}
  }
  throw new Error('ffmpeg not found');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Private Video Search ────────────────────────────────────────────

search
  .command('video <query...>')
  .description('Semantic search across your private video library')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-k, --top <n>', 'Number of results', '10')
  .option('--type <type>', 'Search type: BY_VIDEO or BY_AUDIO', 'BY_VIDEO')
  .option('--filter <level>', 'Filtering level: low, medium, high')
  .option('--tag <tag>', 'Filter by tag')
  .option('--videos <nos>', 'Comma-separated video numbers to search within')
  .option('-d, --download [dir]', 'Download and clip matching segments (optionally specify output dir)')
  .option('--json', 'Output as JSON')
  .action(async (queryParts, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const query = queryParts.join(' ');

    const spinner = ora('Searching private library...').start();
    try {
      const res = await client.searchPrivate({
        query,
        searchType: opts.type,
        uniqueId: getUniqueId(opts),
        topK: parseInt(opts.top),
        filteringLevel: opts.filter,
        tag: opts.tag,
        videoNos: opts.videos ? opts.videos.split(',') : undefined,
      });

      const items = res.data || [];

      if (opts.download && items.length > 0) {
        const outDir = typeof opts.download === 'string' ? opts.download : './clips';
        const downloaded = await downloadClips(client, items, outDir, spinner);
        spinner.stop();

        if (format === 'json') {
          console.log(JSON.stringify(downloaded, null, 2));
        } else {
          success(`Downloaded ${downloaded.length} clip(s) to ${resolve(outDir)}`);
          for (const d of downloaded) {
            console.log(`  ${d.file} (${formatBytes(d.size)}) [${d.start}s-${d.end}s] score=${d.score?.toFixed(3)}`);
          }
        }
        return;
      }

      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(items, null, 2));
      } else if (items.length === 0) {
        console.log('No results found.');
      } else {
        const rows = items.map(r => ({
          video_no: r.videoNo,
          name: truncate(r.videoName, 30),
          time: `${r.startTime || '?'} - ${r.endTime || '?'}`,
          score: r.score != null ? r.score.toFixed(3) : '-',
        }));
        console.log(formatOutput(rows, {
          format: 'table',
          columns: [
            { key: 'video_no', label: 'Video No' },
            { key: 'name', label: 'Name' },
            { key: 'time', label: 'Time Range' },
            { key: 'score', label: 'Score' },
          ],
        }));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Public Video Search ─────────────────────────────────────────────

search
  .command('public <query...>')
  .description('Search public video sources (YouTube, TikTok, Instagram)')
  .option('--platform <p>', 'Platform: YOUTUBE, TIKTOK, INSTAGRAM', 'YOUTUBE')
  .option('-k, --top <n>', 'Number of results', '10')
  .option('--type <type>', 'Search type: BY_VIDEO or BY_AUDIO', 'BY_VIDEO')
  .option('--filter <level>', 'Filtering level: low, medium, high')
  .option('-d, --download [dir]', 'Download and clip matching segments (optionally specify output dir)')
  .option('--json', 'Output as JSON')
  .action(async (queryParts, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const query = queryParts.join(' ');

    const spinner = ora(`Searching ${opts.platform} videos...`).start();
    try {
      const res = await client.searchPublic({
        query,
        searchType: opts.type,
        platform: opts.platform,
        topK: parseInt(opts.top),
        filteringLevel: opts.filter,
      });

      const items = res.data || [];

      if (opts.download && items.length > 0) {
        const outDir = typeof opts.download === 'string' ? opts.download : './clips';
        const downloaded = await downloadClips(client, items, outDir, spinner);
        spinner.stop();

        if (format === 'json') {
          console.log(JSON.stringify(downloaded, null, 2));
        } else {
          success(`Downloaded ${downloaded.length} clip(s) to ${resolve(outDir)}`);
          for (const d of downloaded) {
            console.log(`  ${d.file} (${formatBytes(d.size)}) [${d.start}s-${d.end}s] score=${d.score?.toFixed(3)}`);
          }
        }
        return;
      }

      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(items, null, 2));
      } else if (items.length === 0) {
        console.log('No results found.');
      } else {
        const rows = items.map(r => ({
          video_no: r.videoNo,
          name: truncate(r.videoName, 35),
          time: `${r.startTime || '?'} - ${r.endTime || '?'}`,
          score: r.score != null ? r.score.toFixed(3) : '-',
        }));
        console.log(formatOutput(rows, {
          format: 'table',
          columns: [
            { key: 'video_no', label: 'Video No' },
            { key: 'name', label: 'Name' },
            { key: 'time', label: 'Time Range' },
            { key: 'score', label: 'Score' },
          ],
        }));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Audio Transcript Search ─────────────────────────────────────────

search
  .command('audio <videoNo> <query...>')
  .description('Search within a video\'s audio transcripts')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--json', 'Output as JSON')
  .action(async (videoNo, queryParts, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const query = queryParts.join(' ');

    const spinner = ora('Searching audio transcripts...').start();
    try {
      const res = await client.searchAudio({
        videoNo,
        query,
        uniqueId: getUniqueId(opts),
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        console.log(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

export default search;
