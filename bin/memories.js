#!/usr/bin/env node

/**
 * memories — CLI for memories.ai
 * AI agent infrastructure for video understanding, memory, and search.
 *
 * Usage:
 *   memories auth login <key>      — Authenticate
 *   memories memory add <content>  — Add a memory
 *   memories memory search <query> — Semantic search
 *   memories video upload <url>    — Upload a video
 *   memories chat video <no> <q>   — Chat with a video
 *   memories search public <query> — Search public videos
 *   memories scrape url <url>      — Import from social media
 *   memories caption video <url>   — AI video analysis
 *
 * Agent-friendly: pipe output is always JSON. Use --json for explicit JSON.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import auth from '../src/commands/auth.js';
import memory from '../src/commands/memory.js';
import video from '../src/commands/video.js';
import search from '../src/commands/search.js';
import chat from '../src/commands/chat.js';
import scrape from '../src/commands/scrape.js';
import caption from '../src/commands/caption.js';

const program = new Command();

program
  .name('memories')
  .version('1.0.0')
  .description(
    `${chalk.bold('memories')} — CLI for memories.ai\n` +
    `AI agent infrastructure for video understanding, memory, and search.\n\n` +
    `${chalk.dim('Agent-friendly: piped output is always JSON. Use --json for explicit JSON mode.')}`
  );

// Register all subcommands
program.addCommand(auth);
program.addCommand(memory);
program.addCommand(video);
program.addCommand(search);
program.addCommand(chat);
program.addCommand(scrape);
program.addCommand(caption);

// Global options
program.option('--api-key <key>', 'Override API key for this request');

// Parse with graceful error handling
program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  if (err.code === 'commander.missingArgument' || err.code === 'commander.unknownCommand') {
    process.exit(1);
  }
  // Unexpected error
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
}
