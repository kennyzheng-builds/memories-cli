import { Command } from 'commander';
import chalk from 'chalk';
import { setApiKey, getApiKey, getAllConfig, setConfig, clearConfig } from '../lib/config.js';
import { success, error, info, formatOutput } from '../lib/output.js';

const auth = new Command('auth')
  .description('Manage authentication and configuration');

auth
  .command('login <api-key>')
  .description('Save your memories.ai API key')
  .action((apiKey) => {
    setApiKey(apiKey);
    success(`API key saved (${apiKey.slice(0, 6)}...${apiKey.slice(-4)})`);
    info('You can also set MEMORIES_API_KEY environment variable.');
  });

auth
  .command('logout')
  .description('Remove saved API key')
  .action(() => {
    setApiKey('');
    success('API key removed.');
  });

auth
  .command('status')
  .description('Show current authentication status')
  .action(() => {
    const key = getApiKey();
    if (key) {
      success(`Authenticated: ${key.slice(0, 6)}...${key.slice(-4)}`);
      const source = process.env.MEMORIES_API_KEY ? 'environment variable' : 'config file';
      info(`Source: ${source}`);
    } else {
      error('Not authenticated. Run: memories auth login <key>');
    }
  });

auth
  .command('config')
  .description('Show or set configuration')
  .option('--set <key=value>', 'Set a config value')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    if (opts.set) {
      const [key, ...rest] = opts.set.split('=');
      const value = rest.join('=');
      const validKeys = ['defaultUniqueId', 'outputFormat', 'pageSize'];
      if (!validKeys.includes(key)) {
        error(`Invalid key. Valid keys: ${validKeys.join(', ')}`);
        return;
      }
      setConfig(key, key === 'pageSize' ? parseInt(value) : value);
      success(`Set ${key} = ${value}`);
    } else {
      const cfg = { ...getAllConfig() };
      if (cfg.apiKey) cfg.apiKey = cfg.apiKey.slice(0, 6) + '...' + cfg.apiKey.slice(-4);
      console.log(formatOutput(cfg, { format: opts.json ? 'json' : 'table', title: 'Configuration' }));
    }
  });

export default auth;
