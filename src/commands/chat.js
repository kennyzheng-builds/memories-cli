import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { createClient, getUniqueId, getFormat, readStdin } from '../lib/context.js';
import { warn } from '../lib/output.js';

const chat = new Command('chat')
  .description('Chat with your videos or personal media');

// ─── Shared stream parser ───────────────────────────────────────────

async function handleStream(streamBody, { onToken, onError }) {
  const decoder = new TextDecoder();
  let first = true;
  let gotContent = false;

  for await (const chunk of streamBody) {
    const text = decoder.decode(chunk, { stream: true });
    const lines = text.split('\n');
    for (const line of lines) {
      // Handle SSE format: data:payload or data: payload
      const match = line.match(/^data:\s*(.+)/);
      if (!match) continue;
      const payload = match[1].trim();

      if (payload === '[DONE]') {
        if (!gotContent) onError('Stream completed with no content.');
        return;
      }
      // Detect raw error strings like data:"Error"
      if (payload === '"Error"' || payload === 'Error') {
        onError('Streaming endpoint returned an error. Try without --stream.');
        return;
      }
      try {
        const data = JSON.parse(payload);
        const token = data.content || data.token || '';
        if (token) {
          if (first) {
            process.stdout.write('\r' + ' '.repeat(30) + '\r');
            first = false;
          }
          gotContent = true;
          onToken(token);
        }
      } catch {}
    }
  }
  if (!gotContent) onError('Stream ended with no content.');
}

// ─── Video Chat ──────────────────────────────────────────────────────

chat
  .command('video <videoNos> <prompt...>')
  .description('Chat with specific videos (comma-separated video numbers)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--session <id>', 'Session ID for conversation continuity')
  .option('--stream', 'Stream the response')
  .option('--json', 'Output as JSON')
  .action(async (videoNos, promptParts, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);
    const prompt = promptParts.join(' ');
    const nos = videoNos.split(',');

    if (opts.stream) {
      process.stdout.write(chalk.dim('Thinking... '));
      try {
        const stream = await client.chatVideoStream({
          videoNos: nos,
          prompt,
          sessionId: opts.session,
          uniqueId: getUniqueId(opts),
        });
        await handleStream(stream, {
          onToken: (t) => process.stdout.write(t),
          onError: (msg) => {
            console.error(`\n${chalk.red('Error:')} ${msg}`);
            process.exit(1);
          },
        });
        console.log();
      } catch (e) {
        console.error(`\n${chalk.red('Error:')} ${e.message}`);
        process.exit(1);
      }
    } else {
      const spinner = ora('Asking your videos...').start();
      try {
        const res = await client.chatVideo({
          videoNos: nos,
          prompt,
          sessionId: opts.session,
          uniqueId: getUniqueId(opts),
        });
        spinner.stop();

        if (format === 'json') {
          console.log(JSON.stringify(res.data, null, 2));
        } else {
          const answer = res.data?.content || res.data?.data?.content;
          if (!answer) {
            warn('Video chat returned empty content. The video may still be indexing.');
            warn('Try "memories chat personal" instead, which uses transcription data.');
            if (res.data?.session_id) {
              console.log(chalk.dim(`(session_id: ${res.data.session_id})`));
            }
          } else {
            console.log(answer);
            if (res.data?.refs?.length) {
              console.log(chalk.dim('\nReferences:'));
              for (const ref of res.data.refs) {
                console.log(chalk.dim(`  ${ref.videoNo} @ ${ref.startTime}-${ref.endTime}`));
              }
            }
          }
        }
      } catch (e) {
        spinner.fail(e.message);
        process.exit(1);
      }
    }
  });

// ─── Personal Media Chat ─────────────────────────────────────────────

chat
  .command('personal <prompt...>')
  .alias('me')
  .description('Chat with all your personal media (recommended for video analysis)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--session <id>', 'Session ID for conversation continuity')
  .option('--stream', 'Stream the response')
  .option('--json', 'Output as JSON')
  .action(async (promptParts, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    let prompt = promptParts.join(' ');
    if (!prompt || prompt === '-') {
      const piped = await readStdin();
      if (piped) prompt = typeof piped === 'string' ? piped : JSON.stringify(piped);
    }

    if (opts.stream) {
      process.stdout.write(chalk.dim('Thinking... '));
      try {
        const stream = await client.chatPersonalStream({
          prompt,
          sessionId: opts.session,
          uniqueId: getUniqueId(opts),
        });
        await handleStream(stream, {
          onToken: (t) => process.stdout.write(t),
          onError: (msg) => {
            console.error(`\n${chalk.red('Error:')} ${msg}`);
            process.exit(1);
          },
        });
        console.log();
      } catch (e) {
        console.error(`\n${chalk.red('Error:')} ${e.message}`);
        process.exit(1);
      }
    } else {
      const spinner = ora('Chatting with your media...').start();
      try {
        const res = await client.chatPersonal({
          prompt,
          sessionId: opts.session,
          uniqueId: getUniqueId(opts),
        });
        spinner.stop();

        if (format === 'json') {
          console.log(JSON.stringify(res.data, null, 2));
        } else {
          const answer = res.data?.content || res.data?.data?.content || JSON.stringify(res.data);
          console.log(answer);
        }
      } catch (e) {
        spinner.fail(e.message);
        process.exit(1);
      }
    }
  });

export default chat;
