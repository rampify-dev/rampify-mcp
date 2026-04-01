/**
 * MCP Tool: generate_schema
 * Auto-generate structured data (schema.org) for any page type
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { isLocalDomain, fetchLocalHTML, analyzeHTML } from '../services/local-analyzer.js';

// Input schema
export const GenerateSchemaInput = z.object({
  domain: z.string().optional().describe('Site domain (e.g., "example.com"). Uses SEO_CLIENT_DOMAIN env var if not provided.'),
  url_path: z.string().optional().describe('Page URL path (e.g., "/blog/post")'),
  schema_type: z.enum([
    'auto',
    'Article',
    'BlogPosting',
    'Product',
    'Organization',
    'LocalBusiness',
    'FAQPage',
    'BreadcrumbList',
  ]).optional().default('auto').describe('Schema type to generate. Use "auto" to detect automatically.'),
});

export type GenerateSchemaParams = z.infer<typeof GenerateSchemaInput>;

export interface GenerateSchemaResult {
  detected_page_type: string;
  recommended_schemas: string[];
  schemas: Array<{
    type: string;
    json_ld: any;
    validation: {
      valid: boolean;
      warnings?: string[];
    };
  }>;
  implementation: {
    where_to_add: string;
    code_snippet: string;
    instructions: string;
  };
  url: string;
}

/**
 * Generate structured data for a page
 */
export async function generateSchema(params: GenerateSchemaParams): Promise<GenerateSchemaResult | { error: string }> {
  const { domain: providedDomain, url_path, schema_type } = params;

  // Use provided domain or fall back to default
  const domain = providedDomain || config.defaultDomain;

  if (!domain) {
    return {
      error: 'No domain specified. Either provide domain parameter or set SEO_CLIENT_DOMAIN environment variable.',
    };
  }

  if (!url_path) {
    return {
      error: 'url_path is required. Provide the page path (e.g., "/blog/post")',
    };
  }

  logger.info('Generating schema', { domain, url_path, schema_type });

  try {
    // Construct full URL
    const protocol = isLocalDomain(domain) ? 'http' : 'https';
    const fullUrl = `${protocol}://${domain}${url_path}`;

    // Fetch page HTML
    let html: string;
    if (isLocalDomain(domain)) {
      logger.info('Fetching from local dev server', { url: fullUrl });
      html = await fetchLocalHTML(domain, url_path);
    } else {
      // For production, fetch from URL
      logger.info('Fetching from production site', { url: fullUrl });
      // TODO: Implement production fetch (can use axios or fetch)
      const axios = (await import('axios')).default;
      const response = await axios.get(fullUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SEO-Intelligence-MCP/1.0',
        },
      });
      html = response.data;
    }

    // Analyze HTML to extract metadata
    const baseUrl = `${protocol}://${domain}`;
    const analysis = analyzeHTML(html, baseUrl);

    // Detect page type if auto
    const detectedPageType = schema_type === 'auto'
      ? detectPageType(url_path, analysis)
      : schema_type;

    // Generate appropriate schemas
    const schemas = generateSchemasForPageType(detectedPageType, analysis, fullUrl, domain);

    // Validate schemas
    const validatedSchemas = schemas.map(schema => ({
      type: schema.type,
      json_ld: schema.json_ld,
      validation: validateSchema(schema.json_ld),
    }));

    // Generate implementation instructions
    const implementation = generateImplementationInstructions(validatedSchemas, url_path);

    return {
      detected_page_type: detectedPageType,
      recommended_schemas: schemas.map(s => s.type),
      schemas: validatedSchemas,
      implementation,
      url: fullUrl,
    };

  } catch (error) {
    logger.error('Failed to generate schema', error);
    return {
      error: `Failed to generate schema: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Detect page type from URL and content
 */
function detectPageType(urlPath: string, analysis: any): string {
  // Blog/Article patterns
  if (urlPath.match(/\/(blog|article|post|news)\//)) {
    return 'Article';
  }

  // Product patterns
  if (urlPath.match(/\/(product|shop|store|item)\//)) {
    return 'Product';
  }

  // FAQ patterns
  if (urlPath.match(/\/(faq|help|support)\//)) {
    return 'FAQPage';
  }

  // Local business patterns
  if (urlPath.match(/\/(location|locations|store-locator|find-us|our-office|branches|service-area)\//)) {
    return 'LocalBusiness';
  }

  // About/Company patterns
  if (urlPath.match(/\/(about|company|contact)\//)) {
    return 'Organization';
  }

  // Check content for article indicators
  if (analysis.has_article_date || analysis.has_author) {
    return 'Article';
  }

  // Default to Article for content pages
  if (analysis.word_count > 500) {
    return 'Article';
  }

  return 'Organization';
}

/**
 * Generate schemas for detected page type
 */
function generateSchemasForPageType(pageType: string, analysis: any, url: string, domain: string): Array<{ type: string; json_ld: any }> {
  const schemas: Array<{ type: string; json_ld: any }> = [];

  switch (pageType) {
    case 'Article':
    case 'BlogPosting':
      schemas.push({
        type: 'Article',
        json_ld: generateArticleSchema(analysis, url),
      });
      break;

    case 'Product':
      schemas.push({
        type: 'Product',
        json_ld: generateProductSchema(analysis, url),
      });
      break;

    case 'Organization':
      schemas.push({
        type: 'Organization',
        json_ld: generateOrganizationSchema(analysis, url, domain),
      });
      break;

    case 'LocalBusiness':
      schemas.push({
        type: 'LocalBusiness',
        json_ld: generateLocalBusinessSchema(analysis, url, domain),
      });
      break;

    case 'FAQPage':
      schemas.push({
        type: 'FAQPage',
        json_ld: generateFAQSchema(analysis, url),
      });
      break;
  }

  // Always add BreadcrumbList if not homepage
  if (url.split('/').length > 3) {
    schemas.push({
      type: 'BreadcrumbList',
      json_ld: generateBreadcrumbSchema(url),
    });
  }

  return schemas;
}

/**
 * Generate Article schema
 */
function generateArticleSchema(analysis: any, url: string): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: analysis.title || 'Article Title',
    description: analysis.description || 'Article description',
    url: url,
    datePublished: analysis.article_date || new Date().toISOString(),
    dateModified: analysis.article_date || new Date().toISOString(),
    author: {
      '@type': 'Person',
      name: analysis.author || 'Author Name',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Your Organization',
      logo: {
        '@type': 'ImageObject',
        url: 'https://example.com/logo.png',
      },
    },
    image: analysis.og_image || 'https://example.com/default-image.jpg',
  };
}

/**
 * Generate Product schema
 */
function generateProductSchema(analysis: any, url: string): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: analysis.title || 'Product Name',
    description: analysis.description || 'Product description',
    url: url,
    image: analysis.og_image || 'https://example.com/product-image.jpg',
    brand: {
      '@type': 'Brand',
      name: 'Your Brand',
    },
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
}

/**
 * Generate Organization schema
 */
function generateOrganizationSchema(analysis: any, _url: string, domain: string): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Your Organization',
    url: `https://${domain}`,
    logo: 'https://example.com/logo.png',
    description: analysis.description || 'Organization description',
    sameAs: [
      'https://twitter.com/yourcompany',
      'https://linkedin.com/company/yourcompany',
    ],
  };
}

/**
 * Generate LocalBusiness schema
 */
function generateLocalBusinessSchema(analysis: any, _url: string, domain: string): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: analysis.title || 'Business Name',
    url: `https://${domain}`,
    description: analysis.description || 'Business description',
    image: analysis.og_image || 'https://example.com/storefront.jpg',
    telephone: '+1-000-000-0000',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Main St',
      addressLocality: 'City',
      addressRegion: 'ST',
      postalCode: '00000',
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 0,
      longitude: 0,
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:00',
        closes: '17:00',
      },
    ],
  };
}

/**
 * Generate FAQPage schema
 */
function generateFAQSchema(_analysis: any, _url: string): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Sample Question 1?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sample answer to question 1.',
        },
      },
      {
        '@type': 'Question',
        name: 'Sample Question 2?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sample answer to question 2.',
        },
      },
    ],
  };
}

/**
 * Generate BreadcrumbList schema
 */
function generateBreadcrumbSchema(url: string): any {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(Boolean);

  const items = pathParts.map((part, index) => {
    const position = index + 2; // Start at 2 (1 is home)
    const itemUrl = `${urlObj.origin}/${pathParts.slice(0, index + 1).join('/')}`;
    const name = part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
      '@type': 'ListItem',
      position,
      name,
      item: itemUrl,
    };
  });

  // Add home as first item
  items.unshift({
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: urlObj.origin,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Validate schema (basic validation)
 */
function validateSchema(schema: any): { valid: boolean; warnings?: string[] } {
  const warnings: string[] = [];

  // Check for placeholder values
  if (JSON.stringify(schema).includes('example.com')) {
    warnings.push('Schema contains placeholder URLs (example.com) - replace with actual values');
  }

  if (JSON.stringify(schema).includes('Your Organization') || JSON.stringify(schema).includes('Author Name')) {
    warnings.push('Schema contains placeholder text - replace with actual values');
  }

  // Check required fields
  if (schema['@type'] === 'Article') {
    if (!schema.headline || schema.headline === 'Article Title') {
      warnings.push('Article schema missing or has placeholder headline');
    }
    if (!schema.datePublished) {
      warnings.push('Article schema missing datePublished');
    }
  }

  if (schema['@type'] === 'LocalBusiness') {
    if (!schema.name || schema.name === 'Business Name') {
      warnings.push('LocalBusiness schema missing or has placeholder name');
    }
    if (!schema.telephone || schema.telephone === '+1-000-000-0000') {
      warnings.push('LocalBusiness schema missing or has placeholder telephone');
    }
    if (schema.address?.streetAddress === '123 Main St') {
      warnings.push('LocalBusiness schema has placeholder address - replace with actual NAP data');
    }
  }

  return {
    valid: warnings.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Generate implementation instructions
 */
function generateImplementationInstructions(schemas: any[], urlPath: string): {
  where_to_add: string;
  code_snippet: string;
  instructions: string;
} {
  const isNextJs = true; // TODO: Detect from project structure

  if (isNextJs) {
    return {
      where_to_add: 'In your page component\'s metadata or layout',
      code_snippet: generateNextJsSnippet(schemas),
      instructions: `
1. Add this code to your page component (e.g., app${urlPath}/page.tsx)
2. Replace placeholder values with actual data
3. Test with Google Rich Results Test: https://search.google.com/test/rich-results
4. Deploy and verify in Google Search Console
      `.trim(),
    };
  }

  return {
    where_to_add: 'In your HTML <head> section',
    code_snippet: generateHTMLSnippet(schemas),
    instructions: `
1. Add this script tag to your page's <head> section
2. Replace placeholder values with actual data
3. Test with Google Rich Results Test: https://search.google.com/test/rich-results
4. Deploy and verify in Google Search Console
    `.trim(),
  };
}

/**
 * Generate Next.js code snippet
 */
function generateNextJsSnippet(schemas: any[]): string {
  const schemaObjects = schemas.map(s => s.json_ld);

  return `
// Add to your page.tsx or layout.tsx
export const metadata = {
  // ... your existing metadata
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(${JSON.stringify(schemaObjects, null, 2)})
        }}
      />
      {/* Your page content */}
    </>
  );
}
  `.trim();
}

/**
 * Generate HTML snippet
 */
function generateHTMLSnippet(schemas: any[]): string {
  const schemaObjects = schemas.map(s => s.json_ld);

  return `
<script type="application/ld+json">
${JSON.stringify(schemaObjects, null, 2)}
</script>
  `.trim();
}
