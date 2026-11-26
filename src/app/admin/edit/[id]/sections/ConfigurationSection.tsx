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
    <fieldset className="mt-8">
      <legend className="dp-section-title">Konfiguration</legend>
  
      {/* Domain */}
      <div className="mb-4">
        <label className="dp-label">Domain</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="domain"
            value={formData.domain}
            onChange={handleInputChange} 
            placeholder="www.kundendomain.at"
            className="dp-field pr-10"
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
        <label className="dp-label">Favicon URL <span className="dp-label-optional">· optional</span></label>
        <div className="relative mt-1">
          <input
            type="text"
            name="favicon_url"
            value={formData.favicon_url}
            onChange={handleInputChange} 
            placeholder="https://example.com/favicon.png"
            className="dp-field pr-10"
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
        <label className="dp-label">GSC Site URL</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="gscSiteUrl"
            value={formData.gscSiteUrl}
            onChange={handleInputChange} 
            placeholder="sc-domain:kundendomain.at"
            className="dp-field pr-10"
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
        <label className="dp-label">Sitemap URL <span className="dp-label-optional">· optional</span></label>
        <div className="relative mt-1">
          <input
            type="url"
            name="sitemapUrl"
            value={formData.sitemapUrl}
            onChange={handleInputChange}
            placeholder="https://kundendomain.at/sitemap.xml"
            className="dp-field pr-10"
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
        <label className="dp-label">GA4 Property ID</label>
        <div className="relative mt-1">
          <input
            type="text"
            name="ga4PropertyId"
            value={formData.ga4PropertyId}
            onChange={handleInputChange} 
            placeholder="123456789"
            className="dp-field pr-10"
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
