import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { ARCHIVE_DIR } from '@config';
import { getDb } from '@db/client';
import { structuredLog } from '@utils/logger';

export class FileService {
  private db = getDb();

  private sanitizeClientName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  ensureArchiveFolder(caseId: string, category: string, clientName: string): string {
    const safe = this.sanitizeClientName(clientName) || 'client';
    const folder = path.join(ARCHIVE_DIR, `${caseId}_${category}_${safe}`);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    return folder;
  }

  async mirrorAttachment(caseId: string, category: string, clientName: string, channelId: string, attachmentUrl: string, filename: string, uploaderId: string) {
    const folder = this.ensureArchiveFolder(caseId, category, clientName);
    const timestamp = dayjs().toISOString().replace(/[:]/g, '-');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = path.join(folder, `${timestamp}-${safeFilename}`);

    try {
      const response = await axios.get<ArrayBuffer>(attachmentUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(localPath, Buffer.from(response.data));
      this.db
        .prepare(
          'INSERT INTO files (id, case_id, channel_id, uploader_user_id, discord_attachment_url, local_path, filename, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)' 
        )
        .run(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, caseId, channelId, uploaderId, attachmentUrl, localPath, filename, dayjs().toISOString());
      structuredLog('info', 'Archived attachment downloaded', { caseId, localPath });
    } catch (error) {
      structuredLog('error', 'Failed to download attachment', { error });
      throw error;
    }
  }
}
