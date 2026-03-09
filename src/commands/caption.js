import { Command } from 'commander';
import ora from 'ora';
import { createClient, getFormat } from '../lib/context.js';

const caption = new Command('caption')
  .description('AI-powered video and image captioning/analysis');

// ─── Video Caption ───────────────────────────────────────────────────

caption
  .command('video <url>')
  .description('Analyze a video and generate a caption or answer a question')
  .option('-p, --prompt <text>', 'What to analyze', 'Describe what happens in this video.')
  .option('--system <text>', 'System prompt')
  .option('--think', 'Enable thinking/reasoning mode')
  .option('--json', 'Output as JSON')
  .action(async (url, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Analyzing video (this may take a moment)...').start();
    try {
      const res = await client.captionVideo({
        videoUrl: url,
        userPrompt: opts.prompt,
        systemPrompt: opts.system,
        thinking: !!opts.think,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        const text = res.data?.data?.text || res.data?.text || JSON.stringify(res.data);
        console.log(text);
        if (res.data?.token) {
          const t = res.data.token;
          console.log(`\n(tokens: ${t.input} in / ${t.output} out / ${t.total} total)`);
        }
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Image Caption ───────────────────────────────────────────────────

caption
  .command('image <url>')
  .description('Analyze an image and generate a caption or answer a question')
  .option('-p, --prompt <text>', 'What to analyze', 'Describe this image in detail.')
  .option('--system <text>', 'System prompt')
  .option('--json', 'Output as JSON')
  .action(async (url, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Analyzing image...').start();
    try {
      const res = await client.captionImage({
        imageUrl: url,
        userPrompt: opts.prompt,
        systemPrompt: opts.system,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        const text = res.data?.data?.text || res.data?.text || JSON.stringify(res.data);
        console.log(text);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

export default caption;
