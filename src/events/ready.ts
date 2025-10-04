import { Client } from 'discord.js';
import { structuredLog } from '@utils/logger';

export default (client: Client) => {
  client.once('ready', () => {
    structuredLog('info', 'Hart Law PLLC bot ready', { user: client.user?.tag });
  });
};
