import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { ENV } from '@config';
import { structuredLog } from '@utils/logger';
import { loadCommands, registerSlashCommands } from '@utils/commandLoader';
import readyEvent from '@events/ready';
import interactionHandler from '@events/interactionCreate';
import messageHandler from '@events/messageCreate';
import { Command } from '@commands/types';
import { getDb } from '@db/client';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

let commands: Collection<string, Command>;

(async () => {
  try {
    getDb();
    commands = await loadCommands();
    readyEvent(client);
    interactionHandler(client, commands);
    messageHandler(client);
    await client.login(ENV.token);
    await registerSlashCommands(client, commands);
  } catch (error) {
    structuredLog('error', 'Failed to start bot', { error });
    process.exit(1);
  }
})();
