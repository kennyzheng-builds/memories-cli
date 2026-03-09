/**
 * Shared context - creates client from config/env
 */

import { MemoriesClient } from './client.js';
import { getApiKey, getConfig } from './config.js';
import { error } from './output.js';

export function createClient(opts = {}) {
  const apiKey = opts.apiKey || getApiKey();
  if (!apiKey) {
    error('No API key configured. Run: memories auth login <key>');
    error('Or set MEMORIES_API_KEY environment variable.');
    process.exit(1);
  }
  return new MemoriesClient(apiKey);
}

export function getUniqueId(opts = {}) {
  return opts.uniqueId || opts.uid || getConfig('defaultUniqueId') || 'default';
}

export function getFormat(opts = {}) {
  return opts.json ? 'json' : (opts.format || getConfig('outputFormat') || 'table');
}

/**
 * Read piped stdin if available
 */
export async function readStdin() {
  if (process.stdin.isTTY) return null;
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString().trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
