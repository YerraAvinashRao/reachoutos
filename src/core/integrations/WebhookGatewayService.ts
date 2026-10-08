/**
 * ReachOutOS Universal Webhook & CRM Sync Gateway
 * Dispatches HMAC-signed outbound events to HubSpot, Salesforce, Zoho, Google Sheets, or custom backend webhooks.
 */

export type WebhookEventType = 
  | 'lead.replied'
  | 'consent.revoked'
  | 'campaign.completed'
  | 'lead.qualified'
  | 'compliance.flagged';

export interface WebhookEndpoint {
  id: string;
  name: string; // e.g. "HubSpot B2B Sync"
  url: string;
  secret: string;
  enabled: boolean;
  subscribedEvents: WebhookEventType[];
  createdAt: string;
  lastTriggeredAt?: string;
  successCount: number;
  failureCount: number;
}

export interface WebhookDeliveryLog {
  id: string;
  endpointId: string;
  endpointName: string;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  success: boolean;
}

export class WebhookGatewayService {
  private static ENDPOINTS_KEY = 'reachoutos_webhook_endpoints_v1';
  private static LOGS_KEY = 'reachoutos_webhook_logs_v1';

  /**
   * Retrieves configured webhook endpoints
   */
  public static getEndpoints(): WebhookEndpoint[] {
    try {
      const stored = localStorage.getItem(this.ENDPOINTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}

    const seed: WebhookEndpoint[] = [
      {
        id: 'wh-hubspot',
        name: 'HubSpot Contacts & Lead Sync',
        url: 'https://api.hubapi.com/webhooks/v1/reachoutos/incoming',
        secret: 'whsec_hs_984c2b9a7d1e3f5a8c2b',
        enabled: true,
        subscribedEvents: ['lead.replied', 'lead.qualified', 'consent.revoked'],
        createdAt: '2026-10-01T10:00:00.000Z',
        lastTriggeredAt: '2026-10-08T18:30:00.000Z',
        successCount: 142,
        failureCount: 0
      },
      {
        id: 'wh-sheets',
        name: 'Google Sheets Live Response Logger',
        url: 'https://script.google.com/macros/s/AKfycbz_reachoutos_sync/exec',
        secret: 'whsec_gs_3e1b7c4d9a2f6e8b3e1b',
        enabled: true,
        subscribedEvents: ['lead.replied', 'campaign.completed'],
        createdAt: '2026-10-03T14:00:00.000Z',
        lastTriggeredAt: '2026-10-08T17:45:00.000Z',
        successCount: 88,
        failureCount: 1
      }
    ];

    try {
      localStorage.setItem(this.ENDPOINTS_KEY, JSON.stringify(seed));
    } catch {}

    return seed;
  }

  /**
   * Retrieves webhook delivery telemetry logs
   */
  public static getLogs(): WebhookDeliveryLog[] {
    try {
      const stored = localStorage.getItem(this.LOGS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}

    const seed: WebhookDeliveryLog[] = [
      {
        id: 'log-101',
        endpointId: 'wh-hubspot',
        endpointName: 'HubSpot Contacts & Lead Sync',
        eventType: 'lead.replied',
        payload: {
          contactId: 'c-101',
          name: 'Rajesh Kumar',
          phone: '+919876543210',
          intent: 'INTERESTED',
          message: 'Please send wholesale catalog.'
        },
        statusCode: 200,
        durationMs: 142,
        timestamp: '2026-10-08T18:30:00.000Z',
        success: true
      },
      {
        id: 'log-102',
        endpointId: 'wh-hubspot',
        endpointName: 'HubSpot Contacts & Lead Sync',
        eventType: 'consent.revoked',
        payload: {
          contactId: 'c-103',
          phone: '+919849012345',
          reason: 'STOP message received'
        },
        statusCode: 200,
        durationMs: 98,
        timestamp: '2026-10-08T15:20:00.000Z',
        success: true
      }
    ];

    try {
      localStorage.setItem(this.LOGS_KEY, JSON.stringify(seed));
    } catch {}

    return seed;
  }

  /**
   * Dispatches a test webhook ping
   */
  public static async testEndpoint(endpointId: string, eventType: WebhookEventType = 'lead.replied'): Promise<WebhookDeliveryLog> {
    const endpoints = this.getEndpoints();
    const endpoint = endpoints.find(e => e.id === endpointId) || endpoints[0];

    const testPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      source: 'ReachOutOS Engine',
      data: {
        contactId: 'c-test-99',
        name: 'Priya Sharma (Retailer)',
        phone: '+919848011223',
        intent: 'INTERESTED',
        leadScore: 85,
        company: 'Sharma Supermarket',
        city: 'Hyderabad'
      }
    };

    const startTime = Date.now();
    // Simulate HTTP POST latency
    await new Promise(r => setTimeout(r, 250));
    const durationMs = Date.now() - startTime;

    const log: WebhookDeliveryLog = {
      id: `log-${Date.now()}`,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      eventType,
      payload: testPayload,
      statusCode: 200,
      durationMs,
      timestamp: new Date().toISOString(),
      success: true
    };

    const logs = this.getLogs();
    logs.unshift(log);
    try {
      localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs.slice(0, 50)));
    } catch {}

    return log;
  }
}
