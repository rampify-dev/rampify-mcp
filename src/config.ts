/**
 * Configuration loader
 */

import { config as loadEnv } from 'dotenv';
import { logger } from './utils/logger.js';

// Load .env file if it exists
loadEnv();

interface Config {
  backendApiUrl: string;
  apiKey?: string;
  cacheTTL: number;
  logLevel: string;
  defaultDomain?: string;
}

function getConfig(): Config {
  const backendApiUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
  const cacheTTL = parseInt(process.env.CACHE_TTL || '3600', 10);
  const logLevel = process.env.LOG_LEVEL || 'info';
  // Support both RAMPIFY_API_KEY (new) and API_KEY (legacy) for backwards compatibility
  const apiKey = process.env.RAMPIFY_API_KEY || process.env.API_KEY;
  const defaultDomain = process.env.SEO_CLIENT_DOMAIN;

  logger.debug('Configuration loaded', {
    backendApiUrl,
    cacheTTL,
    logLevel,
    hasApiKey: !!apiKey,
    defaultDomain: defaultDomain || 'not set',
  });

  return {
    backendApiUrl,
    apiKey,
    cacheTTL,
    logLevel,
    defaultDomain,
  };
}

export const config = getConfig();
