/**
 * ReachOut OS Client API Client
 * Authenticated REST bridge to /api/v1/*
 * Strictly connects to Supabase Auth and PostgreSQL API.
 * Uses official Supabase client for session management.
 * NO fake fallback credentials, NO manual JWT pasting.
 */

import { supabase } from './supabaseClient';

class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}, retries = 3): Promise<any> {
    // Automatically retrieve official Supabase Auth session token
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token;
    } catch (e) {
      console.warn('[ApiClient] Unable to get Supabase session:', e);
    }

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {})
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(endpoint, {
          ...options,
          headers
        });

        // Read raw text first to avoid uncaught JSON parse exceptions on non-JSON error bodies
        const text = await res.text();
        let json: any = {};
        let isJson = false;

        if (text) {
          try {
            json = JSON.parse(text);
            isJson = true;
          } catch {
            isJson = false;
            json = {
              error: {
                code: res.status === 429 || text.includes('Rate exceeded') ? 'RATE_LIMITED' : `HTTP_${res.status}`,
                message: text || `HTTP ${res.status}`
              }
            };
          }
        }

        // If rate-limited by gateway or upstream (HTTP 429 or "Rate exceeded." message)
        const isRateLimited = res.status === 429 || (typeof text === 'string' && text.includes('Rate exceeded'));
        if (isRateLimited && attempt < retries) {
          attempt++;
          const delay = attempt * 1200 + Math.floor(Math.random() * 400);
          console.warn(`[ApiClient] Rate limit reached on ${endpoint}. Retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (!res.ok) {
          const errorMsg = json?.error?.message || (isRateLimited ? 'Rate limit exceeded. Please wait a moment.' : `API request failed with status ${res.status}`);
          const error = new Error(errorMsg) as any;
          error.code = json?.error?.code || (isRateLimited ? 'RATE_LIMITED' : `HTTP_${res.status}`);
          error.status = res.status;
          error.data = json;
          throw error;
        }

        return json;
      } catch (err: any) {
        const isRateLimited = err?.code === 'RATE_LIMITED' || err?.status === 429 || (err?.message && err.message.includes('Rate exceeded'));
        if (isRateLimited && attempt < retries) {
          attempt++;
          const delay = attempt * 1200 + Math.floor(Math.random() * 400);
          console.warn(`[ApiClient] Rate limited on ${endpoint}. Retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  }

  // ================= HEALTH =================
  async getHealth() {
    try {
      return await this.request('/api/v1/health');
    } catch (err: any) {
      if (err?.code === 'RATE_LIMITED' || err?.status === 429 || err?.message?.includes('Rate exceeded')) {
        return {
          status: 'RATE_LIMITED',
          version: '1.0.0',
          database: 'SUPABASE_POSTGRESQL',
          isDatabaseConfigured: true,
          message: 'Upstream rate limit reached. Retrying connection...'
        };
      }
      // For any server error (500, network failure, etc.) assume DB is configured
      // and let the auth/data calls reveal the real issue. This prevents the app
      // from getting stuck on the "No DB Config" screen due to a transient API error.
      console.warn('[ApiClient] Health check failed, proceeding optimistically:', err?.message || err);
      return {
        status: err?.status === 503 ? 'DATABASE_UNCONFIGURED' : 'HEALTHY',
        version: '1.0.0',
        database: 'SUPABASE_POSTGRESQL',
        isDatabaseConfigured: err?.status !== 503,
        message: err?.status === 503
          ? (err.message || 'Supabase PostgreSQL database is not configured.')
          : 'API health check unavailable — proceeding with cached configuration.'
      };
    }
  }

  // ================= BOOTSTRAP =================
  async getWorkspaceBootstrap() {
    const json = await this.request('/api/v1/workspace/bootstrap');
    return json.data;
  }

  // ================= AUTH =================
  async logout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Error signing out of Supabase:', e);
    }
  }

  async getMe() {
    const json = await this.request('/api/v1/auth/me');
    return json.data;
  }

  // ================= TENANT & WORKSPACE =================
  async getTenant() {
    const json = await this.request('/api/v1/tenant');
    return json.data;
  }

  async toggleKillSwitch(isActive: boolean, reason?: string) {
    const json = await this.request('/api/v1/tenant/kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive, reason })
    });
    return json.data;
  }

  // ================= CONTACTS =================
  async getContacts(params?: { search?: string; tag?: string; listId?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.tag) query.append('tag', params.tag);
    if (params?.listId) query.append('listId', params.listId);
    if (params?.status) query.append('status', params.status);

    const json = await this.request(`/api/v1/contacts?${query.toString()}`);
    return json.data;
  }

  async getContact(id: string) {
    const json = await this.request(`/api/v1/contacts/${id}`);
    return json.data;
  }

  async createContact(data: any) {
    const json = await this.request('/api/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async updateContact(id: string, updates: any) {
    const json = await this.request(`/api/v1/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return json.data;
  }

  async bulkUpdateContacts(contactIds: string[], updates: Record<string, any>) {
    const json = await this.request('/api/v1/contacts/bulk-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds, updates })
    });
    return json.data;
  }

  async deleteContact(id: string) {
    return this.request(`/api/v1/contacts/${id}`, { method: 'DELETE' });
  }

  async bulkDeleteContacts(contactIds: string[]) {
    const json = await this.request('/api/v1/contacts/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds })
    });
    return json.data;
  }

  async toggleContactBlock(id: string, reason?: string) {
    const json = await this.request(`/api/v1/contacts/${id}/toggle-block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return json.data;
  }

  async addContactNote(id: string, note: string) {
    const json = await this.request(`/api/v1/contacts/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    return json.data;
  }

  // ================= IMPORTS =================
  async previewImport(rawData: any[], columnMapping: any) {
    const json = await this.request('/api/v1/imports/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawData, columnMapping })
    });
    return json.data;
  }

  async commitImport(rows: any[], duplicatePolicy: string, sourceFileName: string, leadStatus?: string, targetListId?: string) {
    const json = await this.request('/api/v1/imports/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, duplicatePolicy, sourceFileName, leadStatus, targetListId })
    });
    return json.data;
  }

  // ================= LISTS =================
  async getContactLists() {
    const json = await this.request('/api/v1/contact-lists');
    return json.data;
  }

  async createContactList(data: any) {
    const json = await this.request('/api/v1/contact-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async addMembersToList(listId: string, contactIds: string[]) {
    const json = await this.request(`/api/v1/contact-lists/${listId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds })
    });
    return json.data;
  }

  // ================= TEMPLATES =================
  async getTemplates() {
    const json = await this.request('/api/v1/templates');
    return json.data;
  }

  async createTemplate(data: any) {
    const json = await this.request('/api/v1/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async updateTemplate(id: string, data: any) {
    const json = await this.request(`/api/v1/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async deleteTemplate(id: string) {
    return this.request(`/api/v1/templates/${id}`, { method: 'DELETE' });
  }

  // ================= CAMPAIGNS =================
  async getCampaigns() {
    const json = await this.request('/api/v1/campaigns');
    return json.data;
  }

  async getCampaign(id: string) {
    const json = await this.request(`/api/v1/campaigns/${id}`);
    return json.data;
  }

  async createCampaign(data: any) {
    const json = await this.request('/api/v1/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async updateCampaignStatus(id: string, newStatus: string) {
    const json = await this.request(`/api/v1/campaigns/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus })
    });
    return json.data;
  }

  async deleteCampaign(id: string) {
    return this.request(`/api/v1/campaigns/${id}`, { method: 'DELETE' });
  }

  async syncCampaignTemplate(id: string) {
    const json = await this.request(`/api/v1/campaigns/${id}/sync-template`, {
      method: 'POST'
    });
    return json.data;
  }

  async prepareRecipient(campaignId: string, recipientId: string) {
    const json = await this.request(`/api/v1/campaigns/${campaignId}/recipients/${recipientId}/prepare`, {
      method: 'POST'
    });
    return json.data;
  }

  async markRecipientSent(campaignId: string, recipientId: string) {
    const json = await this.request(`/api/v1/campaigns/${campaignId}/recipients/${recipientId}/mark-sent`, {
      method: 'POST'
    });
    return json.data;
  }

  async skipRecipient(campaignId: string, recipientId: string, reason?: string) {
    const json = await this.request(`/api/v1/campaigns/${campaignId}/recipients/${recipientId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return json.data;
  }

  async blockRecipient(campaignId: string, recipientId: string, reason?: string) {
    const json = await this.request(`/api/v1/campaigns/${campaignId}/recipients/${recipientId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return json.data;
  }

  async sendTest(campaignId: string, testPhone: string, testName: string) {
    const json = await this.request(`/api/v1/campaigns/${campaignId}/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPhone, testName })
    });
    return json.data;
  }

  // ================= AI COPILOT =================
  async aiGenerateDrafts(data: any) {
    const json = await this.request('/api/v1/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async aiPersonalize(data: any) {
    const json = await this.request('/api/v1/ai/personalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async aiRewrite(data: any) {
    const json = await this.request('/api/v1/ai/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  }

  async aiGuardrails(message: string) {
    const json = await this.request('/api/v1/ai/guardrails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return json.data;
  }

  // ================= COMPLIANCE POLICY ENGINE =================
  async evaluateCompliance(context: any) {
    const json = await this.request('/api/v1/compliance/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    });
    return json.data;
  }

  async getCompliancePolicy() {
    const json = await this.request('/api/v1/compliance/policy');
    return json.data;
  }

  // ================= AUDIT & STATS =================
  async getAuditLogs(limit = 50) {
    const json = await this.request(`/api/v1/audit?limit=${limit}`);
    return json.data;
  }

  async getStats() {
    const json = await this.request('/api/v1/stats');
    return json.data;
  }

  // ================= ADMIN & GOVERNANCE CAPABILITIES =================
  async adminListMembers() {
    const json = await this.request('/api/v1/admin/members');
    return json.data;
  }

  async adminInviteMember(email: string, name: string, role: string) {
    const json = await this.request('/api/v1/admin/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, role })
    });
    return json.data;
  }

  async adminUpdateMemberRole(memberId: string, role: string) {
    const json = await this.request(`/api/v1/admin/members/${memberId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    return json.data;
  }

  async adminRemoveMember(memberId: string) {
    const json = await this.request(`/api/v1/admin/members/${memberId}`, {
      method: 'DELETE'
    });
    return json.data;
  }

  async adminGetComplianceReviews() {
    const json = await this.request('/api/v1/admin/compliance/reviews');
    return json.data;
  }

  async adminResolveComplianceReview(reviewId: string, decision: 'ALLOW' | 'BLOCK', reason: string) {
    const json = await this.request(`/api/v1/admin/compliance/reviews/${reviewId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason })
    });
    return json.data;
  }

  async adminGetBlocklist() {
    const json = await this.request('/api/v1/admin/blocklist');
    return json.data;
  }

  async adminAddBlocklist(identifier: string, reason: string) {
    const json = await this.request('/api/v1/admin/blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, reason })
    });
    return json.data;
  }

  async adminRemoveBlocklist(contactId: string) {
    const json = await this.request(`/api/v1/admin/blocklist/${contactId}`, {
      method: 'DELETE'
    });
    return json.data;
  }

  async adminGetSystemHealth() {
    const json = await this.request('/api/v1/admin/system/health');
    return json.data;
  }
}

export const apiClient = new ApiClient();
