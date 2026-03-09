import { Command } from 'commander';
import { writeFileSync, mkdirSync, unlinkSync, renameSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { execFileSync } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';
import { createClient, getUniqueId, getFormat } from '../lib/context.js';
import { formatOutput, success, error, info, truncate } from '../lib/output.js';

const video = new Command('video')
  .alias('vid')
  .description('Upload, list, search, and manage videos');

// ─── Upload from URL ─────────────────────────────────────────────────

video
  .command('upload <url>')
  .description('Upload a video from URL')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--keep', 'Retain original video')
  .option('--prompt <text>', 'Custom transcription prompt')
  .option('--callback <url>', 'Webhook callback URL')
  .option('--json', 'Output as JSON')
  .action(async (url, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Uploading video...').start();
    try {
      const res = await client.uploadVideoFromUrl({
        url,
        uniqueId: getUniqueId(opts),
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
        retainOriginal: !!opts.keep,
        prompt: opts.prompt,
        callback: opts.callback,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success('Video uploaded successfully.');
        console.log(`  Video No:  ${res.data.videoNo}`);
        console.log(`  Name:      ${res.data.videoName}`);
        console.log(`  Status:    ${res.data.videoStatus}`);
        info('Video is processing. Use "memories video wait <videoNo>" to poll until ready.');
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Upload from file ────────────────────────────────────────────────

video
  .command('upload-file <path>')
  .description('Upload a video from local file')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--keep', 'Retain original video')
  .option('--prompt <text>', 'Custom transcription prompt')
  .option('--json', 'Output as JSON')
  .action(async (filePath, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Uploading video file...').start();
    try {
      const res = await client.uploadVideoFromFile({
        filePath,
        uniqueId: getUniqueId(opts),
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
        retainOriginal: !!opts.keep,
        prompt: opts.prompt,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success('Video uploaded successfully.');
        console.log(`  Video No: ${res.data.videoNo}`);
        console.log(`  Status:   ${res.data.videoStatus}`);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── List Videos ─────────────────────────────────────────────────────

video
  .command('list')
  .alias('ls')
  .description('List all uploaded videos')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-s, --size <n>', 'Page size', '20')
  .option('--status <status>', 'Filter by status (PARSE, UNPARSE, FAILED)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Fetching videos...').start();
    try {
      const res = await client.listVideos({
        uniqueId: getUniqueId(opts),
        page: parseInt(opts.page),
        size: parseInt(opts.size),
        status: opts.status,
      });
      spinner.stop();

      const videos = res.data?.videos || [];

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else if (videos.length === 0) {
        console.log('No videos found.');
      } else {
        const statusColor = (s) => {
          if (s === 'PARSE') return chalk.green(s);
          if (s === 'FAILED') return chalk.red(s);
          return chalk.yellow(s);
        };
        const rows = videos.map(v => ({
          video_no: v.video_no,
          name: truncate(v.video_name, 30),
          status: v.status,
          duration: v.duration || '-',
          created: v.create_time || '-',
        }));
        console.log(formatOutput(rows, {
          format: 'table',
          columns: [
            { key: 'video_no', label: 'Video No' },
            { key: 'name', label: 'Name' },
            { key: 'status', label: 'Status', transform: statusColor },
            { key: 'duration', label: 'Duration' },
            { key: 'created', label: 'Created' },
          ],
        }));
        console.log(`\nPage ${opts.page} (${res.data?.total_count || videos.length} total)`);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Video Info (agent-friendly status check) ───────────────────────

video
  .command('info <videoNo>')
  .description('Quick status check for a single video (agent-friendly)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--json', 'Output as JSON')
  .action(async (videoNo, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    try {
      const res = await client.listVideos({
        uniqueId: getUniqueId(opts),
        videoNo,
        page: 1,
        size: 1,
      });
      const video = (res.data?.videos || []).find(v => v.video_no === videoNo);

      if (!video) {
        if (format === 'json') {
          console.log(JSON.stringify({ video_no: videoNo, found: false }));
        } else {
          error(`Video ${videoNo} not found.`);
        }
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify({
          video_no: video.video_no,
          status: video.status,
          ready: video.status === 'PARSE',
          video_name: video.video_name,
          duration: video.duration || null,
          create_time: video.create_time || null,
        }));
      } else {
        const statusColor = video.status === 'PARSE' ? chalk.green : video.status === 'FAILED' ? chalk.red : chalk.yellow;
        console.log(`  Video No:  ${video.video_no}`);
        console.log(`  Name:      ${video.video_name || '-'}`);
        console.log(`  Status:    ${statusColor(video.status)}`);
        console.log(`  Ready:     ${video.status === 'PARSE' ? 'Yes' : 'No'}`);
        if (video.duration) console.log(`  Duration:  ${video.duration}`);
      }
    } catch (e) {
      if (format === 'json') {
        console.log(JSON.stringify({ video_no: videoNo, error: e.message }));
      } else {
        error(e.message);
      }
      process.exit(1);
    }
  });

// ─── Download Video ─────────────────────────────────────────────────

video
  .command('download <videoNo>')
  .alias('dl')
  .description('Download a video, optionally clipping to a time range')
  .option('-o, --output <path>', 'Output file path (default: <videoNo>.mp4)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--start <seconds>', 'Clip start time in seconds')
  .option('--end <seconds>', 'Clip end time in seconds')
  .option('--json', 'Output as JSON (returns file path and metadata)')
  .action(async (videoNo, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const needsClip = opts.start != null || opts.end != null;

    const spinner = ora('Downloading video...').start();
    try {
      const res = await client.downloadVideoRaw(videoNo, getUniqueId(opts));
      const buffer = Buffer.from(await res.arrayBuffer());

      // Determine output path
      let outPath = opts.output || `${videoNo}.mp4`;
      outPath = resolve(outPath);
      mkdirSync(dirname(outPath), { recursive: true });

      if (needsClip) {
        // Write full video to a temp file, then clip with ffmpeg
        const tmpPath = outPath + '.tmp.mp4';
        writeFileSync(tmpPath, buffer);
        spinner.text = 'Clipping to time range...';

        const ffmpegArgs = ['-y'];
        if (opts.start) ffmpegArgs.push('-ss', opts.start);
        ffmpegArgs.push('-i', tmpPath);
        if (opts.end && opts.start) {
          ffmpegArgs.push('-t', String(Number(opts.end) - Number(opts.start || 0)));
        } else if (opts.end) {
          ffmpegArgs.push('-t', opts.end);
        }
        ffmpegArgs.push('-c:v', 'libx264', '-c:a', 'aac', outPath);

        try {
          execFileSync(findFfmpeg(), ffmpegArgs, { stdio: 'pipe' });
          // Clean up temp file
          try { unlinkSync(tmpPath); } catch {}
        } catch (e) {
          // ffmpeg not found, save full video and warn
          renameSync(tmpPath, outPath);
          spinner.stop();
          info(`Saved full video (ffmpeg not found for clipping: ${e.message})`);
          if (format === 'json') {
            console.log(JSON.stringify({ path: outPath, videoNo, clipped: false, size: buffer.length }));
          } else {
            success(`Downloaded: ${outPath} (${formatBytes(buffer.length)})`);
          }
          return;
        }
      } else {
        writeFileSync(outPath, buffer);
      }

      spinner.stop();
      const finalSize = statSync(outPath).size;
      if (format === 'json') {
        console.log(JSON.stringify({
          path: outPath,
          videoNo,
          clipped: needsClip,
          start: opts.start || null,
          end: opts.end || null,
          size: finalSize,
        }));
      } else {
        success(`Downloaded: ${outPath} (${formatBytes(finalSize)})`);
        if (needsClip) info(`Clipped: ${opts.start || 0}s - ${opts.end || 'end'}s`);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

function findFfmpeg() {
  // Check common locations
  const paths = [
    'ffmpeg',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
  ];
  for (const p of paths) {
    try { execFileSync(p, ['-version'], { stdio: 'pipe' }); return p; } catch {}
  }
  throw new Error('ffmpeg not found. Install ffmpeg for clip support.');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Delete Videos ───────────────────────────────────────────────────

video
  .command('delete <videoNos...>')
  .alias('rm')
  .description('Delete one or more videos by video number')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--json', 'Output as JSON')
  .action(async (videoNos, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora(`Deleting ${videoNos.length} video(s)...`).start();
    try {
      const res = await client.deleteVideos(videoNos, getUniqueId(opts));
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res, null, 2));
      } else {
        success(`Deleted ${videoNos.length} video(s).`);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Task Status ─────────────────────────────────────────────────────

video
  .command('status <taskId>')
  .description('Check video processing task status')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--json', 'Output as JSON')
  .action(async (taskId, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Checking task status...').start();
    try {
      const res = await client.getTaskStatus(taskId, getUniqueId(opts));
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        const videos = res.data?.videos || [];
        if (videos.length === 0) {
          console.log('No videos found for this task.');
        } else {
          for (const v of videos) {
            const statusColor = v.status === 'PARSE' ? chalk.green : v.status === 'FAILED' ? chalk.red : chalk.yellow;
            console.log(`  ${v.video_no}  ${statusColor(v.status)}  ${v.video_name || ''}`);
          }
        }
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Wait for Processing ────────────────────────────────────────────

video
  .command('wait <videoNos...>')
  .description('Poll until video(s) finish processing (PARSE or FAILED)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '10')
  .option('--timeout <seconds>', 'Max wait time in seconds', '300')
  .option('--json', 'Output as JSON')
  .action(async (videoNos, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const interval = parseInt(opts.interval) * 1000;
    const timeout = parseInt(opts.timeout) * 1000;
    const startTime = Date.now();

    const spinner = ora('Waiting for video processing...').start();
    try {
      while (Date.now() - startTime < timeout) {
        const res = await client.listVideos({
          uniqueId: getUniqueId(opts),
          page: 1,
          size: 100,
        });
        const allVideos = res.data?.videos || [];
        const tracked = allVideos.filter(v => videoNos.includes(v.video_no));

        const statuses = tracked.map(v => v.status);
        const allDone = statuses.length > 0 && statuses.every(s => s === 'PARSE' || s === 'FAILED');
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        spinner.text = `Waiting... ${statuses.join(', ')} (${elapsed}s)`;

        if (allDone) {
          spinner.stop();
          const hasFailed = statuses.some(s => s === 'FAILED');
          if (format === 'json') {
            console.log(JSON.stringify({
              ready: !hasFailed,
              elapsed,
              videos: tracked.map(v => ({ video_no: v.video_no, status: v.status, video_name: v.video_name })),
            }));
          } else {
            for (const v of tracked) {
              const color = v.status === 'PARSE' ? chalk.green : chalk.red;
              console.log(`  ${v.video_no}  ${color(v.status)}  ${v.video_name || ''}`);
            }
            if (hasFailed) {
              error(`Some videos failed processing after ${elapsed}s.`);
              process.exit(1);
            } else {
              success(`All ${tracked.length} video(s) ready in ${elapsed}s.`);
            }
          }
          return;
        }

        await new Promise(r => setTimeout(r, interval));
      }
      spinner.fail(`Timed out after ${opts.timeout}s. Videos may still be processing.`);
      process.exit(1);
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Transcription ───────────────────────────────────────────────────

video
  .command('transcript <videoNo>')
  .description('Get video transcription')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--audio', 'Get audio transcription instead')
  .option('--json', 'Output as JSON')
  .action(async (videoNo, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Fetching transcription...').start();
    try {
      const fn = opts.audio ? 'getAudioTranscription' : 'getVideoTranscription';
      const res = await client[fn](videoNo, getUniqueId(opts));
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

export default video;
