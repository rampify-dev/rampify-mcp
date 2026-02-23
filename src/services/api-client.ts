/**
 * Backend API client
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ClientResponse, URLsResponse, QueriesResponse } from '../types/api.js';

export class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.backendApiUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} ${error.config?.url}`, error);
        } else if (error.request) {
          logger.error('API No Response', error);
        } else {
          logger.error('API Setup Error', error);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get client by domain
   */
  async getClientByDomain(domain: string): Promise<ClientResponse | null> {
    try {
      const response = await this.client.get<{ data: ClientResponse }>('/api/clients', {
        params: { domain },
      });
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get client by ID
   */
  async getClient(clientId: string): Promise<ClientResponse | null> {
    try {
      const response = await this.client.get<{ data: ClientResponse }>(`/api/clients/${clientId}`);
      return response.data.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get client profile by client ID
   */
  async getClientProfile(clientId: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/api/clients/${clientId}/profile`);
      return response.data || null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get URLs for a site
   */
  async getSiteUrls(
    siteId: string,
    filters?: {
      status?: 'active' | 'removed';
      limit?: number;
      offset?: number;
    }
  ): Promise<URLsResponse> {
    try {
      const response = await this.client.get<URLsResponse>(`/api/sites/${siteId}/urls`, {
        params: filters,
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch URLs for site ${siteId}`, error);
      throw error;
    }
  }

  /**
   * Get GSC queries for a URL
   */
  async getUrlQueries(
    urlId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      days?: number;
      limit?: number;
    }
  ): Promise<QueriesResponse> {
    try {
      const response = await this.client.get<any>(`/api/urls/${urlId}/queries`, {
        params,
      });

      // Transform camelCase API response to snake_case
      const data = response.data;
      const queries = (data.queries || []).map((q: any) => ({
        query: q.query,
        clicks: q.clicks || 0,
        impressions: q.impressions || 0,
        ctr: q.ctr || 0,
        position: q.position || 0,
        date: q.date || '',
      }));

      // Use summary from API if available (includes rollup data even when queries is empty)
      // Otherwise calculate from query-level data
      const summary = data.summary
        ? {
            total_clicks: data.summary.totalClicks || 0,
            total_impressions: data.summary.totalImpressions || 0,
            avg_position: data.summary.avgPosition || 0,
            avg_ctr: data.summary.avgCtr || 0,
          }
        : {
            total_clicks: queries.reduce((sum: number, q: any) => sum + q.clicks, 0),
            total_impressions: queries.reduce((sum: number, q: any) => sum + q.impressions, 0),
            avg_position: queries.length > 0
              ? queries.reduce((sum: number, q: any) => sum + q.position, 0) / queries.length
              : 0,
            avg_ctr: queries.reduce((sum: number, q: any) => sum + q.impressions, 0) > 0
              ? queries.reduce((sum: number, q: any) => sum + q.clicks, 0) /
                queries.reduce((sum: number, q: any) => sum + q.impressions, 0)
              : 0,
          };

      return {
        queries,
        summary,
      };
    } catch (error) {
      // If GSC not connected, return empty data
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          queries: [],
          summary: {
            total_clicks: 0,
            total_impressions: 0,
            avg_position: 0,
            avg_ctr: 0,
          },
        };
      }
      logger.error(`Failed to fetch queries for URL ${urlId}`, error);
      throw error;
    }
  }

  /**
   * Get GSC queries for a site
   */
  async getSiteQueries(
    siteId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      limit?: number;
    }
  ): Promise<QueriesResponse> {
    try {
      const response = await this.client.get<any>(`/api/sites/${siteId}/queries`, {
        params,
      });

      // Transform camelCase API response to snake_case
      const data = response.data;
      const queries = (data.queries || []).map((q: any) => ({
        query: q.query,
        clicks: q.totalClicks || 0,
        impressions: q.totalImpressions || 0,
        ctr: q.avgCtr || 0,
        position: q.avgPosition || 0,
        date: q.date || '',
      }));

      // Calculate summary stats if not provided or incomplete
      const totalClicks = data.summary?.totalClicks || 0;
      const totalImpressions = data.summary?.totalImpressions || 0;
      const avgPosition = queries.length > 0
        ? queries.reduce((sum: number, q: any) => sum + q.position, 0) / queries.length
        : 0;
      const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

      return {
        queries,
        summary: {
          total_clicks: totalClicks,
          total_impressions: totalImpressions,
          avg_position: avgPosition,
          avg_ctr: avgCtr,
        },
      };
    } catch (error) {
      // If GSC not connected, return empty data
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return {
          queries: [],
          summary: {
            total_clicks: 0,
            total_impressions: 0,
            avg_position: 0,
            avg_ctr: 0,
          },
        };
      }
      logger.error(`Failed to fetch queries for site ${siteId}`, error);
      throw error;
    }
  }

  /**
   * Trigger site analysis
   */
  async triggerSiteAnalysis(clientId: string): Promise<{
    success: boolean;
    summary: {
      total_urls: number;
      urls_checked: number;
      issues_found: number;
      critical_issues: number;
      warnings: number;
      duration: number;
    };
  }> {
    try {
      const response = await this.client.post(`/api/clients/${clientId}/analyze`);
      const data = response.data;

      // Transform camelCase API response to snake_case
      return {
        success: data.success || false,
        summary: {
          total_urls: data.summary?.totalUrls || 0,
          urls_checked: data.summary?.urlsChecked || 0,
          issues_found: data.summary?.issuesFound || 0,
          critical_issues: data.summary?.criticalIssues || 0,
          warnings: data.summary?.warnings || 0,
          duration: data.summary?.duration || 0,
        },
      };
    } catch (error) {
      logger.error(`Failed to trigger analysis for client ${clientId}`, error);
      throw error;
    }
  }

  /**
   * Get site health score (will need to be implemented in backend)
   */
  async getSiteHealthScore(siteId: string): Promise<{
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: any;
  }> {
    try {
      const response = await this.client.get(`/api/sites/${siteId}/health-score`);
      return response.data;
    } catch (error) {
      // If endpoint doesn't exist yet, calculate basic score
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Health score endpoint not yet implemented, using fallback');
        return this.calculateBasicHealthScore(siteId);
      }
      throw error;
    }
  }

  /**
   * Fallback health score calculation (basic)
   */
  private async calculateBasicHealthScore(siteId: string): Promise<{
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    breakdown: any;
  }> {
    try {
      const urls = await this.getSiteUrls(siteId, { limit: 1000 });

      const total = urls.urls.length;
      const with404 = urls.urls.filter(u => u.current_http_status === 404).length;
      const withoutTitle = urls.urls.filter(u => !u.current_has_title).length;
      const withoutMeta = urls.urls.filter(u => !u.current_has_meta_description).length;

      // Basic calculation
      const score404 = (1 - with404 / total) * 40; // 40% weight
      const scoreTitle = (1 - withoutTitle / total) * 30; // 30% weight
      const scoreMeta = (1 - withoutMeta / total) * 30; // 30% weight

      const score = Math.round(score404 + scoreTitle + scoreMeta);

      const grade = score >= 90 ? 'A'
        : score >= 80 ? 'B'
        : score >= 70 ? 'C'
        : score >= 60 ? 'D'
        : 'F';

      return {
        score,
        grade,
        breakdown: {
          technical_health: score404,
          content_quality: (scoreTitle + scoreMeta) / 2,
        },
      };
    } catch (error) {
      logger.error('Failed to calculate basic health score', error);
      return { score: 0, grade: 'F', breakdown: {} };
    }
  }

  /**
   * Get issues for a site (real-time detection from current URL state)
   */
  async getSiteIssues(siteId: string, options?: { severity?: 'critical' | 'warning' | 'info' }): Promise<{
    issues: any[];
    summary: {
      total: number;
      critical: number;
      warning: number;
      info: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (options?.severity) {
        params.append('severity', options.severity);
      }

      const response = await this.client.get(`/api/sites/${siteId}/issues?${params.toString()}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch site issues', error);
      throw error;
    }
  }

  /**
   * Get comprehensive site statistics (new unified endpoint)
   */
  async getSiteStats(siteId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/sites/${siteId}/stats`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch site stats', error);
      throw error;
    }
  }

  /**
   * Resolve a siteId and clientId from either a project_id or domain.
   * All tools should use this instead of implementing their own resolution logic.
   */
  async resolveSiteAndClient(opts: {
    projectId?: string;
    domain?: string;
  }): Promise<{ siteId: string; clientId: string } | { error: string }> {
    const { projectId, domain } = opts;

    // Step 1: Resolve client ID
    let clientId: string;

    if (projectId) {
      clientId = projectId;
    } else if (domain) {
      const client = await this.getClientByDomain(domain);
      if (!client) {
        return { error: `No project found for domain "${domain}". Add this domain in the Rampify dashboard first.` };
      }
      clientId = client.id;
    } else {
      return { error: 'No domain or project_id specified. Provide domain, project_id, or set SEO_CLIENT_DOMAIN / RAMPIFY_PROJECT_ID env var.' };
    }

    // Step 2: Get site via client → site endpoint
    const site = await this.get<any>(`/api/clients/${clientId}/site`);
    if (site?.id) {
      return { siteId: site.id, clientId: site.client_id || clientId };
    }

    // Step 3: If projectId was provided, it might be a direct site UUID (not a client ID)
    if (projectId) {
      const siteData = await this.get<any>(`/api/sites/${projectId}`);
      if (siteData?.client_id) {
        return { siteId: projectId, clientId: siteData.client_id };
      }
    }

    return { error: `Could not resolve a project for ${projectId ? `ID "${projectId}"` : `domain "${domain}"`}. Check your Rampify dashboard.` };
  }

  /**
   * Generic GET request
   */
  async get<T>(path: string, options?: { params?: any }): Promise<T | null> {
    try {
      const response = await this.client.get<T>(path, options);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Generic POST request
   */
  async post<T>(path: string, body?: any): Promise<T> {
    const response = await this.client.post<T>(path, body);
    return response.data;
  }

  /**
   * Generic PATCH request
   */
  async patch<T>(path: string, body?: any): Promise<T> {
    const response = await this.client.patch<T>(path, body);
    return response.data;
  }
}

export const apiClient = new APIClient();
