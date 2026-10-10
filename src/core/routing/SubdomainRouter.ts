/**
 * ReachOutOS Complete Subdomain Architecture Engine
 * Handles subdomain detection, multi-tenant isolation, cross-subdomain URL generation,
 * and routing between Landing Page, App Workspace, API, and Custom Branded Links.
 */

export type SubdomainType = 'LANDING' | 'APP' | 'API' | 'LINKS' | 'TENANT';

export interface HostInfo {
  hostname: string;
  subdomain: string | null;
  mode: SubdomainType;
  tenantSlug: string | null;
  isLocalhost: boolean;
  baseDomain: string;
}

export class SubdomainRouter {
  public static PRODUCTION_DOMAIN = 'reachoutos.com';

  /**
   * Parses the hostname and returns detailed subdomain and routing metadata
   */
  public static parseHost(hostname?: string, searchParams?: URLSearchParams): HostInfo {
    const host = (hostname || (typeof window !== 'undefined' ? window.location.hostname : 'reachoutos.com')).toLowerCase();
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');

    // Handle query parameter overrides for local testing (e.g. ?subdomain=app or ?tenant=yarhoney)
    if (searchParams) {
      const explicitSubdomain = searchParams.get('subdomain') || searchParams.get('view');
      const explicitTenant = searchParams.get('tenant');
      if (explicitSubdomain === 'app') {
        return {
          hostname: host,
          subdomain: 'app',
          mode: 'APP',
          tenantSlug: explicitTenant || null,
          isLocalhost,
          baseDomain: isLocalhost ? 'localhost' : this.PRODUCTION_DOMAIN
        };
      }
      if (explicitSubdomain === 'landing') {
        return {
          hostname: host,
          subdomain: null,
          mode: 'LANDING',
          tenantSlug: null,
          isLocalhost,
          baseDomain: isLocalhost ? 'localhost' : this.PRODUCTION_DOMAIN
        };
      }
      if (explicitTenant) {
        return {
          hostname: host,
          subdomain: explicitTenant,
          mode: 'TENANT',
          tenantSlug: explicitTenant,
          isLocalhost,
          baseDomain: isLocalhost ? 'localhost' : this.PRODUCTION_DOMAIN
        };
      }
    }

    // 1. Localhost subdomains (e.g. app.localhost:3000, yarhoney.localhost:3000)
    if (isLocalhost) {
      if (host.startsWith('app.')) {
        return {
          hostname: host,
          subdomain: 'app',
          mode: 'APP',
          tenantSlug: null,
          isLocalhost: true,
          baseDomain: 'localhost'
        };
      }
      if (host.startsWith('api.')) {
        return {
          hostname: host,
          subdomain: 'api',
          mode: 'API',
          tenantSlug: null,
          isLocalhost: true,
          baseDomain: 'localhost'
        };
      }
      if (host.startsWith('links.')) {
        return {
          hostname: host,
          subdomain: 'links',
          mode: 'LINKS',
          tenantSlug: null,
          isLocalhost: true,
          baseDomain: 'localhost'
        };
      }
      
      const parts = host.split('.');
      if (parts.length > 1 && parts[0] !== 'localhost') {
        return {
          hostname: host,
          subdomain: parts[0],
          mode: 'TENANT',
          tenantSlug: parts[0],
          isLocalhost: true,
          baseDomain: 'localhost'
        };
      }

      // Root localhost defaults to LANDING unless path is /app or hash is #app
      return {
        hostname: host,
        subdomain: null,
        mode: 'LANDING',
        tenantSlug: null,
        isLocalhost: true,
        baseDomain: 'localhost'
      };
    }

    // 2. Vercel deployment domains (e.g. reachoutos.vercel.app or reachoutos-app.vercel.app)
    if (host.endsWith('.vercel.app')) {
      const isAppBranch = host.includes('-app') || host.startsWith('app-') || host.startsWith('app.');
      return {
        hostname: host,
        subdomain: isAppBranch ? 'app' : null,
        mode: isAppBranch ? 'APP' : 'LANDING',
        tenantSlug: null,
        isLocalhost: false,
        baseDomain: 'vercel.app'
      };
    }

    // 3. Production Custom Domain parsing (reachoutos.com)
    if (host === 'reachoutos.com' || host === 'www.reachoutos.com') {
      return {
        hostname: host,
        subdomain: null,
        mode: 'LANDING',
        tenantSlug: null,
        isLocalhost: false,
        baseDomain: this.PRODUCTION_DOMAIN
      };
    }

    if (host.startsWith('app.')) {
      return {
        hostname: host,
        subdomain: 'app',
        mode: 'APP',
        tenantSlug: null,
        isLocalhost: false,
        baseDomain: this.PRODUCTION_DOMAIN
      };
    }

    if (host.startsWith('api.')) {
      return {
        hostname: host,
        subdomain: 'api',
        mode: 'API',
        tenantSlug: null,
        isLocalhost: false,
        baseDomain: this.PRODUCTION_DOMAIN
      };
    }

    if (host.startsWith('links.')) {
      return {
        hostname: host,
        subdomain: 'links',
        mode: 'LINKS',
        tenantSlug: null,
        isLocalhost: false,
        baseDomain: this.PRODUCTION_DOMAIN
      };
    }

    // Custom Tenant Subdomain (e.g. yarhoney.reachoutos.com)
    const sub = host.split('.')[0];
    return {
      hostname: host,
      subdomain: sub,
      mode: 'TENANT',
      tenantSlug: sub,
      isLocalhost: false,
      baseDomain: this.PRODUCTION_DOMAIN
    };
  }

  /**
   * Constructs a cross-subdomain URL for seamless navigation
   */
  public static buildUrl(
    target: SubdomainType,
    options: {
      tenantSlug?: string;
      path?: string;
      hash?: string;
      params?: Record<string, string>;
    } = {}
  ): string {
    const isClient = typeof window !== 'undefined';
    const currentHost = isClient ? window.location.hostname : 'reachoutos.com';
    const currentPort = isClient && window.location.port ? `:${window.location.port}` : '';
    const isLocalhost = currentHost.includes('localhost') || currentHost.includes('127.0.0.1');
    const path = options.path || '/';
    const hash = options.hash ? `#${options.hash}` : '';

    const query = new URLSearchParams(options.params || {});

    // Development Environment
    if (isLocalhost) {
      if (target === 'APP') {
        query.set('subdomain', 'app');
        return `http://${currentHost}${currentPort}${path}?${query.toString()}${hash}`;
      }
      if (target === 'LANDING') {
        query.set('subdomain', 'landing');
        return `http://${currentHost}${currentPort}${path}?${query.toString()}${hash}`;
      }
      if (target === 'TENANT' && options.tenantSlug) {
        query.set('tenant', options.tenantSlug);
        return `http://${currentHost}${currentPort}${path}?${query.toString()}${hash}`;
      }
      return `http://${currentHost}${currentPort}${path}?${query.toString()}${hash}`;
    }

    // Vercel Preview / Default Domain Environment (*.vercel.app)
    if (currentHost.endsWith('.vercel.app')) {
      if (target === 'APP') {
        query.set('subdomain', 'app');
        return `https://${currentHost}${path}?${query.toString()}${hash}`;
      }
      if (target === 'LANDING') {
        query.set('subdomain', 'landing');
        return `https://${currentHost}${path}?${query.toString()}${hash}`;
      }
      if (target === 'TENANT' && options.tenantSlug) {
        query.set('tenant', options.tenantSlug);
        return `https://${currentHost}${path}?${query.toString()}${hash}`;
      }
      return `https://${currentHost}${path}?${query.toString()}${hash}`;
    }

    // Production Environment with official DNS Subdomains
    const protocol = 'https://';
    const base = this.PRODUCTION_DOMAIN;
    const queryString = query.toString() ? `?${query.toString()}` : '';

    switch (target) {
      case 'APP':
        return `${protocol}app.${base}${path}${queryString}${hash}`;
      case 'API':
        return `${protocol}api.${base}${path}${queryString}${hash}`;
      case 'LINKS':
        return `${protocol}links.${base}${path}${queryString}${hash}`;
      case 'TENANT':
        const slug = options.tenantSlug || 'app';
        return `${protocol}${slug}.${base}${path}${queryString}${hash}`;
      case 'LANDING':
      default:
        return `${protocol}${base}${path}${queryString}${hash}`;
    }
  }

  /**
   * Returns root cookie domain for cross-subdomain authentication SSO sharing
   */
  public static getCookieDomain(): string {
    if (typeof window === 'undefined') return `.${this.PRODUCTION_DOMAIN}`;
    const host = window.location.hostname;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return 'localhost';
    }
    return `.${this.PRODUCTION_DOMAIN}`;
  }
}
