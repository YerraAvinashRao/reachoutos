/**
 * ReachOutOS Multi-Tenant White-Label Branding & Custom Domain Service
 * Manages organization branding, custom tracking domains, and branded link generator.
 */

export interface TenantBrandingConfig {
  orgName: string;
  logoUrl?: string;
  primaryColor: string;
  trackingDomain: string; // e.g. "links.brand.com"
  senderAlias: string;
  supportPhone: string;
  supportEmail: string;
  enableBrandedLinks: boolean;
}

export class TenantBrandingService {
  private static STORAGE_KEY = 'reachoutos_tenant_branding_v1';

  /**
   * Retrieves tenant branding configuration with smart defaults
   */
  public static getBranding(): TenantBrandingConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}

    const defaultConfig: TenantBrandingConfig = {
      orgName: 'YAR Pure Honey & Organics',
      logoUrl: '',
      primaryColor: '#10b981', // Emerald
      trackingDomain: 'links.reachoutos.com',
      senderAlias: 'YAR Wholesale Desk',
      supportPhone: '+919848011223',
      supportEmail: 'wholesale@yarhoney.com',
      enableBrandedLinks: true
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(defaultConfig));
    } catch {}

    return defaultConfig;
  }

  /**
   * Updates tenant branding configuration
   */
  public static updateBranding(config: Partial<TenantBrandingConfig>): TenantBrandingConfig {
    const current = this.getBranding();
    const updated = { ...current, ...config };
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return updated;
  }

  /**
   * Builds a branded shortlink with UTM tags
   */
  public static createBrandedLink(targetUrl: string, campaignName: string): string {
    const branding = this.getBranding();
    const domain = branding.trackingDomain || 'links.reachoutos.com';
    const slug = Math.random().toString(36).substring(2, 7);
    return `https://${domain}/${slug}?utm_campaign=${encodeURIComponent(campaignName)}`;
  }
}
