/**
 * Get Security Context Tool
 *
 * PRIVATE/LOCAL-ONLY TOOL
 * This tool is NOT published to npm - excluded via package.json "files" whitelist
 * Only available when running MCP server locally
 */

import { z } from 'zod';
import { apiClient } from '../services/api-client.js';
import { logger } from '../utils/logger.js';

export const GetSecurityContextInput = z.object({
  domain: z.string().describe('Site domain (e.g., "example.com")'),
});

export type GetSecurityContextInput = z.infer<typeof GetSecurityContextInput>;

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'headers' | 'ssl' | 'exposure' | 'third_party' | 'dns' | 'configuration';
  title: string;
  description: string;
  remediation?: string;
  reference_urls?: string[];
}

interface SecurityContextResult {
  success: boolean;
  domain: string;
  securityScore: number | null;
  grade: string | null;
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  recentIssues: SecurityIssue[];
  headers: {
    hasHSTS: boolean;
    hasCSP: boolean;
    hasXFrameOptions: boolean;
    hasXContentTypeOptions: boolean;
    hasReferrerPolicy: boolean;
  };
  ssl: {
    valid: boolean;
    grade?: string;
    expiresAt?: string;
    daysUntilExpiry?: number;
  };
  exposedFiles: string[];
  thirdParty: {
    totalScripts: number;
    scriptsWithoutSRI: number;
    trackingServices: string[];
  };
  recommendations: string[];
  lastScanned?: string;
}

/**
 * Get security analysis for a site (homepage only)
 */
export async function getSecurityContext(
  params: GetSecurityContextInput
): Promise<SecurityContextResult> {
  const { domain } = params;

  logger.info('Getting security context', { domain });

  try {
    // Use apiClient which has auth configured
    const response = await apiClient['client'].get<SecurityContextResult>(
      `/api/clients/by-domain/${encodeURIComponent(domain)}/security`
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to get security context', error);
    throw error;
  }
}

/**
 * Format security context for human-readable output
 */
export function formatSecurityContext(result: SecurityContextResult): string {
  const lines: string[] = [];

  lines.push(`# Security Analysis: ${result.domain}`);
  lines.push('');

  if (result.securityScore === null) {
    lines.push('⚠️  No security data available. Run a site analysis first.');
    return lines.join('\n');
  }

  // Security Score
  const scoreEmoji = result.securityScore >= 80 ? '✅' : result.securityScore >= 60 ? '⚠️' : '❌';
  lines.push(`## Security Score: ${result.securityScore}/100 ${scoreEmoji}`);
  if (result.grade) {
    lines.push(`**Grade:** ${result.grade}`);
  }
  lines.push('');

  // Issue Summary
  lines.push('## Issues Summary');
  lines.push(`- **Critical:** ${result.issues.critical}`);
  lines.push(`- **High:** ${result.issues.high}`);
  lines.push(`- **Medium:** ${result.issues.medium}`);
  lines.push(`- **Low:** ${result.issues.low}`);
  lines.push(`- **Total:** ${result.issues.total}`);
  lines.push('');

  // Recent Issues
  if (result.recentIssues.length > 0) {
    lines.push('## Recent Issues');
    lines.push('');

    for (const issue of result.recentIssues.slice(0, 5)) {
      const severityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        info: 'ℹ️',
      }[issue.severity];

      lines.push(`### ${severityEmoji} ${issue.title}`);
      lines.push(`**Severity:** ${issue.severity} | **Category:** ${issue.category}`);
      lines.push('');
      lines.push(issue.description);
      lines.push('');

      if (issue.remediation) {
        lines.push('**How to fix:**');
        lines.push(issue.remediation);
        lines.push('');
      }

      if (issue.reference_urls && issue.reference_urls.length > 0) {
        lines.push('**References:**');
        for (const ref of issue.reference_urls) {
          lines.push(`- ${ref}`);
        }
        lines.push('');
      }
    }
  } else {
    lines.push('## ✅ No Open Issues');
    lines.push('Your site has no critical security issues detected.');
    lines.push('');
  }

  // Security Headers
  lines.push('## Security Headers');
  lines.push(`- HSTS: ${result.headers.hasHSTS ? '✅' : '❌'}`);
  lines.push(`- Content Security Policy: ${result.headers.hasCSP ? '✅' : '❌'}`);
  lines.push(`- X-Frame-Options: ${result.headers.hasXFrameOptions ? '✅' : '❌'}`);
  lines.push(`- X-Content-Type-Options: ${result.headers.hasXContentTypeOptions ? '✅' : '❌'}`);
  lines.push(`- Referrer-Policy: ${result.headers.hasReferrerPolicy ? '✅' : '❌'}`);
  lines.push('');

  // SSL/TLS
  lines.push('## SSL/TLS Certificate');
  lines.push(`- Valid: ${result.ssl.valid ? '✅' : '❌'}`);
  if (result.ssl.grade) {
    lines.push(`- Grade: ${result.ssl.grade}`);
  }
  if (result.ssl.daysUntilExpiry !== undefined) {
    const expEmoji = result.ssl.daysUntilExpiry < 30 ? '⚠️' : '✅';
    lines.push(`- Expires in: ${result.ssl.daysUntilExpiry} days ${expEmoji}`);
  }
  lines.push('');

  // Exposed Files
  if (result.exposedFiles.length > 0) {
    lines.push('## ⚠️  Exposed Files');
    for (const file of result.exposedFiles) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  // Third-Party Scripts
  lines.push('## Third-Party Scripts');
  lines.push(`- Total external scripts: ${result.thirdParty.totalScripts}`);
  lines.push(`- Scripts without SRI: ${result.thirdParty.scriptsWithoutSRI}`);
  if (result.thirdParty.trackingServices.length > 0) {
    lines.push(`- Tracking services: ${result.thirdParty.trackingServices.join(', ')}`);
  }
  lines.push('');

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('## 💡 Recommendations');
    for (const rec of result.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Last Scanned
  if (result.lastScanned) {
    lines.push(`---`);
    lines.push(`*Last scanned: ${result.lastScanned}*`);
  }

  return lines.join('\n');
}
