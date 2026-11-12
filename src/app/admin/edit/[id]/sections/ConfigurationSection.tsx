// src/app/admin/edit/[id]/sections/ConfigurationSection.tsx
'use client';

import { CheckCircle } from 'react-bootstrap-icons';
import { GA4_PROPERTY_ID_HINT, parseGa4PropertyId } from '@/lib/ga4-property-id';
import { normalizeGscSiteUrl } from '@/lib/gsc-site-url';
import GoogleConnectionCheck from '@/components/admin/GoogleConnectionCheck';
import type { EditUserFormData, InputChangeHandler } from './edit-user-form-helpers';

interface ConfigurationSectionProps {
  formData: Pick<EditUserFormData, 'domain' | 'favicon_url' | 'gscSiteUrl' | 'sitemapUrl' | 'ga4PropertyId'>;
  handleInputChange: InputChangeHandler;
  isSubmitting: boolean;
}

// Domain, Favicon, GSC, Sitemap und GA4 inklusive Verbindungsprüfung.
export default function ConfigurationSection({
  formData,
  handleInputChange,
  isSubmitting,
}: ConfigurationSectionProps) {
  return (
    <fieldset className="border-t pt-4 mt-4">
      <legend className="text-sm font-medium text-body mb-2">Konfiguration</legend>
  
      {/* Domain */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-body">Domain</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="domain"
            value={formData.domain}
            onChange={handleInputChange} 
            placeholder="z.B. www.kundendomain.at"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.domain && !isSubmitting && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
      </div>

      {/* Favicon URL */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-body">Favicon URL</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="favicon_url"
            value={formData.favicon_url}
            onChange={handleInputChange} 
            placeholder="Optional: https://example.com/favicon.png"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.favicon_url && !isSubmitting && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
      </div>

      {/* GSC Site URL */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-body">GSC Site URL</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="gscSiteUrl"
            value={formData.gscSiteUrl}
            onChange={handleInputChange} 
            placeholder="z.B. sc-domain:kundendomain.at"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.gscSiteUrl && !isSubmitting && normalizeGscSiteUrl(formData.gscSiteUrl).ok && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
      </div>

      {/* Sitemap URL */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-body">Sitemap URL</label>
        <div className="relative mt-1">
          <input
            type="url"
            name="sitemapUrl"
            value={formData.sitemapUrl}
            onChange={handleInputChange}
            placeholder="Optional: https://kundendomain.at/sitemap.xml"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.sitemapUrl && !isSubmitting && (
            <CheckCircle
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success"
              size={16}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          Leer lassen für die automatische Erkennung über /sitemap.xml.
        </p>
      </div>

      {/* GA4 Property ID */}
      <div>
        <label className="block text-sm font-medium text-body">GA4 Property ID</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="ga4PropertyId"
            value={formData.ga4PropertyId}
            onChange={handleInputChange} 
            placeholder="z.B. 123456789"
            className="block w-full px-3 py-2 pr-10 border border-border rounded-md focus:outline-none focus:ring-accent focus:border-accent disabled:bg-surface-tertiary disabled:cursor-not-allowed placeholder:text-muted"
            disabled={isSubmitting}
          />
          {formData.ga4PropertyId && !isSubmitting && parseGa4PropertyId(formData.ga4PropertyId).ok && (
            <CheckCircle 
              className="absolute top-1/2 right-3 -translate-y-1/2 text-success" 
              size={16}
            />
          )}
        </div>
        {(() => {
          const check = parseGa4PropertyId(formData.ga4PropertyId);
          return check.ok
            ? <p className="mt-1 text-xs text-muted">{GA4_PROPERTY_ID_HINT}</p>
            : <p className="mt-1 text-xs text-danger" role="alert">{check.message}</p>;
        })()}
      </div>

      <div className="mt-4">
        <GoogleConnectionCheck gscSiteUrl={formData.gscSiteUrl} ga4PropertyId={formData.ga4PropertyId} />
      </div>
    </fieldset>
  );
}
