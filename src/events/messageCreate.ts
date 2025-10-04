import { Client } from 'discord.js';
import { FileService } from '@services/fileService';
import { CaseService } from '@services/caseService';
import { structuredLog } from '@utils/logger';

const fileService = new FileService();
const caseService = new CaseService();

export default (client: Client) => {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author?.bot) return;
      if (!message.guild) return;
      if (!message.attachments.size) return;
      const caseRecord = caseService.getCaseByChannel(message.channelId);
      if (!caseRecord || caseRecord.status !== 'ARCHIVED' || !caseRecord.archived_category_code) return;
      for (const attachment of message.attachments.values()) {
        try {
          await fileService.mirrorAttachment(
            caseRecord.id,
            caseRecord.archived_category_code,
            caseRecord.client_name,
            message.channelId,
            attachment.url,
            attachment.name ?? 'file',
            message.author.id
          );
        } catch (error) {
          structuredLog('error', 'Failed to mirror attachment', { error, attachment: attachment.url });
        }
      }
    } catch (error) {
      structuredLog('error', 'messageCreate handler error', { error });
    }
  });
};
