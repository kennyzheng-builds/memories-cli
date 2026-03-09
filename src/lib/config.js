/**
 * Configuration management using Conf (XDG-compliant)
 * Stores API key and defaults in ~/.config/memories-cli/config.json
 */

import Conf from 'conf';

const config = new Conf({
  projectName: 'memories-cli',
  schema: {
    apiKey: { type: 'string', default: '' },
    defaultUniqueId: { type: 'string', default: 'default' },
    outputFormat: { type: 'string', enum: ['table', 'json', 'raw'], default: 'table' },
    pageSize: { type: 'number', default: 20, minimum: 1, maximum: 100 },
  },
});

export function getApiKey() {
  return process.env.MEMORIES_API_KEY || config.get('apiKey');
}

export function setApiKey(key) {
  config.set('apiKey', key);
}

export function getConfig(key) {
  return config.get(key);
}

export function setConfig(key, value) {
  config.set(key, value);
}

export function getAllConfig() {
  return config.store;
}

export function clearConfig() {
  config.clear();
}

export { config };
