/**
 * Output formatting utilities
 * Supports: table, json, raw modes
 * Auto-detects piped output for agent-friendly JSON
 */

import chalk from 'chalk';
import Table from 'cli-table3';

// Detect if output is being piped to another process
// When piped, data output is JSON but status messages still go to stderr
const isPiped = !process.stdout.isTTY && !process.env.FORCE_TTY;

export function formatOutput(data, { format, columns, title } = {}) {
  const effectiveFormat = format === 'json' ? 'json' : (isPiped ? 'json' : (format || 'table'));

  switch (effectiveFormat) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'raw':
      return typeof data === 'string' ? data : JSON.stringify(data);
    case 'table':
    default:
      return formatTable(data, columns, title);
  }
}

function formatTable(data, columns, title) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return chalk.dim('No results.');
  }

  if (!Array.isArray(data)) {
    // Single object - render as key/value pairs
    const table = new Table();
    if (title) table.push([{ colSpan: 2, content: chalk.bold(title), hAlign: 'center' }]);
    for (const [k, v] of Object.entries(data)) {
      const val = typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v ?? '');
      table.push([chalk.cyan(k), val]);
    }
    return table.toString();
  }

  // Array of objects
  const cols = columns || Object.keys(data[0] || {});
  const table = new Table({
    head: cols.map(c => chalk.cyan(c.label || c)),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  if (title) {
    console.log(chalk.bold(`\n${title}`));
  }

  for (const row of data) {
    table.push(
      cols.map(c => {
        const key = c.key || c;
        const val = row[key];
        if (c.transform) return c.transform(val, row);
        return val === null || val === undefined ? chalk.dim('-') : String(val);
      })
    );
  }

  return table.toString();
}

export function success(msg) {
  // Status messages go to stderr so they don't pollute piped JSON output
  console.error(chalk.green('OK') + ' ' + msg);
}

export function error(msg) {
  console.error(chalk.red('ERR') + ' ' + msg);
}

export function info(msg) {
  console.error(chalk.blue('..') + ' ' + msg);
}

export function warn(msg) {
  console.error(chalk.yellow('!!') + ' ' + msg);
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 3) + '...' : str;
}
