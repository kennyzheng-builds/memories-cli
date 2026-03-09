import { Command } from 'commander';
import ora from 'ora';
import { createClient, getUniqueId, getFormat } from '../lib/context.js';
import { success } from '../lib/output.js';

const scrape = new Command('scrape')
  .description('Import videos from social media platforms');

// ─── Scrape by URL ───────────────────────────────────────────────────

scrape
  .command('url <platform-url>')
  .description('Import a video from a social media post URL (TikTok, YouTube, Instagram, Twitter)')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--json', 'Output as JSON')
  .action(async (url, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Importing video from URL...').start();
    try {
      const res = await client.scrapeByUrl({
        url,
        uniqueId: getUniqueId(opts),
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success('Video imported successfully.');
        if (res.data) console.log(JSON.stringify(res.data, null, 2));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Scrape by Hashtag ───────────────────────────────────────────────

scrape
  .command('hashtag <tag>')
  .description('Import videos by hashtag from a platform')
  .option('--platform <p>', 'Platform: TIKTOK, YOUTUBE, INSTAGRAM', 'TIKTOK')
  .option('-n, --count <n>', 'Number of videos to import', '10')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--json', 'Output as JSON')
  .action(async (tag, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora(`Importing ${opts.count} videos with #${tag}...`).start();
    try {
      const res = await client.scrapeByHashtag({
        hashtag: tag,
        platform: opts.platform,
        count: parseInt(opts.count),
        uniqueId: getUniqueId(opts),
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success(`Imported videos with hashtag #${tag}.`);
        if (res.data) console.log(JSON.stringify(res.data, null, 2));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Scrape by Creator ───────────────────────────────────────────────

scrape
  .command('creator <creator-url>')
  .description('Import videos from a creator\'s profile page')
  .option('-n, --count <n>', 'Number of videos', '10')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('--json', 'Output as JSON')
  .action(async (creatorUrl, opts) => {
    const client = createClient(opts);
    const format = getFormat(opts);

    const spinner = ora('Importing creator videos...').start();
    try {
      const res = await client.scrapeByCreator({
        creatorUrl,
        uniqueId: getUniqueId(opts),
        count: parseInt(opts.count),
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success('Creator videos imported.');
        if (res.data) console.log(JSON.stringify(res.data, null, 2));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

export default scrape;
