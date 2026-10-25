import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/business';
import { LEGAL_DOCS } from './legal/docs';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', ...Object.keys(LEGAL_DOCS).map((d) => `/legal/${d}`)].map((p) => ({ url: `${siteUrl()}${p}` }));
}
