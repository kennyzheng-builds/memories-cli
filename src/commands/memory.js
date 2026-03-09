import { Command } from 'commander';
import ora from 'ora';
import { createClient, getUniqueId, getFormat, readStdin } from '../lib/context.js';
import { formatOutput, success, error, truncate } from '../lib/output.js';

const memory = new Command('memory')
  .alias('mem')
  .description('Manage text memories (add, list, search)');

// ─── Add Memory ──────────────────────────────────────────────────────

memory
  .command('add <content...>')
  .description('Add a new memory. Supports piped input.')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-r, --role <role>', 'Role for the memory entry', 'user')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .option('--lat <latitude>', 'Latitude')
  .option('--lng <longitude>', 'Longitude')
  .option('--at <datetime>', 'Memory timestamp (ISO 8601)')
  .option('--json', 'Output as JSON')
  .action(async (contentParts, opts) => {
    const client = createClient(opts);
    const uid = getUniqueId(opts);
    const format = getFormat(opts);

    // Support piped input
    let content = contentParts.join(' ');
    if (!content || content === '-') {
      const piped = await readStdin();
      if (piped) {
        content = typeof piped === 'string' ? piped : JSON.stringify(piped);
      }
    }

    if (!content) {
      error('No content provided. Pass text or pipe via stdin.');
      process.exit(1);
    }

    const spinner = ora('Adding memory...').start();
    try {
      const res = await client.addMemory({
        uniqueId: uid,
        memories: [{ role: opts.role, content }],
        tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : undefined,
        latitude: opts.lat,
        longitude: opts.lng,
        memoriesAt: opts.at,
      });
      spinner.stop();

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else {
        success('Memory added successfully.');
        if (res.data && Array.isArray(res.data)) {
          for (const m of res.data) {
            console.log(`  ID: ${m.id}`);
            console.log(`  Content: ${truncate(m.content, 80)}`);
            if (m.tags?.length) console.log(`  Tags: ${m.tags.join(', ')}`);
          }
        }
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── List Memories ───────────────────────────────────────────────────

memory
  .command('list')
  .alias('ls')
  .description('List all memories')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-s, --size <n>', 'Page size', '20')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const client = createClient(opts);
    const uid = getUniqueId(opts);
    const format = getFormat(opts);

    const filters = {};
    if (opts.tags) {
      filters.AND = opts.tags.split(',').map(t => ({ tags: { contains: t.trim() } }));
    }

    const spinner = ora('Fetching memories...').start();
    try {
      const res = await client.listMemories({
        uniqueId: uid,
        page: parseInt(opts.page),
        pageSize: parseInt(opts.size),
        filters: Object.keys(filters).length ? filters : undefined,
      });
      spinner.stop();

      const items = res.data?.content || [];

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else if (items.length === 0) {
        console.log('No memories found.');
      } else {
        const rows = items.map(m => ({
          id: m.id,
          content: truncate(m.content, 50),
          tags: (m.tags || []).join(', ') || '-',
          created: m.created_at ? new Date(m.created_at).toLocaleDateString() : '-',
        }));
        console.log(formatOutput(rows, {
          format: 'table',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'content', label: 'Content' },
            { key: 'tags', label: 'Tags' },
            { key: 'created', label: 'Created' },
          ],
        }));
        const total = res.data?.totalElements || items.length;
        const pages = res.data?.totalPages || 1;
        console.log(`\nPage ${opts.page}/${pages} (${total} total)`);
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

// ─── Search Memories ─────────────────────────────────────────────────

memory
  .command('search <query...>')
  .description('Semantic search across memories')
  .option('-u, --uid <id>', 'Unique ID (namespace)')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-s, --size <n>', 'Page size', '20')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--json', 'Output as JSON')
  .action(async (queryParts, opts) => {
    const client = createClient(opts);
    const uid = getUniqueId(opts);
    const format = getFormat(opts);

    let query = queryParts.join(' ');
    if (!query || query === '-') {
      const piped = await readStdin();
      if (piped) query = typeof piped === 'string' ? piped : JSON.stringify(piped);
    }

    const filters = {};
    if (opts.tags) {
      filters.OR = opts.tags.split(',').map(t => ({ tags: { contains: t.trim() } }));
    }

    const spinner = ora('Searching memories...').start();
    try {
      const res = await client.searchMemories({
        uniqueId: uid,
        query,
        page: parseInt(opts.page),
        pageSize: parseInt(opts.size),
        filters: Object.keys(filters).length ? filters : undefined,
      });
      spinner.stop();

      const items = res.data?.content || [];

      if (format === 'json') {
        console.log(JSON.stringify(res.data, null, 2));
      } else if (items.length === 0) {
        console.log('No matching memories found.');
      } else {
        const rows = items.map(m => ({
          id: m.id,
          content: truncate(m.content, 50),
          tags: (m.tags || []).join(', ') || '-',
          score: m.score != null ? m.score.toFixed(3) : '-',
        }));
        console.log(formatOutput(rows, {
          format: 'table',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'content', label: 'Content' },
            { key: 'tags', label: 'Tags' },
            { key: 'score', label: 'Score' },
          ],
        }));
      }
    } catch (e) {
      spinner.fail(e.message);
      process.exit(1);
    }
  });

export default memory;
