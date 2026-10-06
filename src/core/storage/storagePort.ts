export interface StoredAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
}

export interface StoragePort {
  uploadFile(name: string, mimeType: string, buffer: Buffer): Promise<StoredAttachment>;
  getAttachment(id: string): Promise<StoredAttachment | null>;
  deleteAttachment(id: string): Promise<void>;
}

export class InMemoryStorageProvider implements StoragePort {
  private files: Map<string, StoredAttachment> = new Map();

  async uploadFile(name: string, mimeType: string, buffer: Buffer): Promise<StoredAttachment> {
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const attachment: StoredAttachment = {
      id,
      name,
      sizeBytes: buffer.length,
      mimeType,
      url: `/api/v1/attachments/${id}/${encodeURIComponent(name)}`,
      uploadedAt: new Date().toISOString()
    };
    this.files.set(id, attachment);
    return attachment;
  }

  async getAttachment(id: string): Promise<StoredAttachment | null> {
    return this.files.get(id) || null;
  }

  async deleteAttachment(id: string): Promise<void> {
    this.files.delete(id);
  }
}
