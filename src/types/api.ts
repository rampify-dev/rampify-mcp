/**
 * Backend API types
 */

export interface APIResponse<T> {
  data?: T;
  error?: string;
}

export interface ClientResponse {
  id: string;
  company_name: string;
  domain: string;
}

export interface URLsResponse {
  urls: Array<{
    id: string;
    url: string;
    // Current state fields (denormalized from latest checks)
    current_http_status: number | null;
    current_has_title: boolean;
    current_title_text: string | null;
    current_has_meta_description: boolean;
    current_meta_description_text: string | null;
    current_issues: any[];
    current_gsc_coverage_state?: string | null;
    current_gsc_indexing_state?: string | null;
    gsc_impressions_28d?: number | null;
    gsc_clicks_28d?: number | null;
    gsc_analytics_last_updated?: string | null;
    last_checked_at: string | null;
  }>;
  total?: number;
}

export interface QueriesResponse {
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    date: string;
  }>;
  summary: {
    total_clicks: number;
    total_impressions: number;
    avg_position: number;
    avg_ctr: number;
  };
}
