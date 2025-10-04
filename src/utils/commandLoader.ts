import fs from 'fs';
import path from 'path';
import { Collection, REST, Routes, Client } from 'discord.js';
import { Command } from '@commands/types';
import { CONFIG, ENV } from '@config';
import { structuredLog } from '@utils/logger';

export const loadCommands = async (): Promise<Collection<string, Command>> => {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
  for (const file of files) {
    if (file === 'types.ts') continue;
    const filePath = path.join(commandsPath, file);
    const module = await import(filePath);
    const command: Command = module.default;
    commands.set(command.data.name, command);
  }
  return commands;
};

export const registerSlashCommands = async (client: Client, commands: Collection<string, Command>) => {
  if (!ENV.registerCommands) return;
  const rest = new REST({ version: '10' }).setToken(ENV.token);
  const data = commands.map((command) => command.data.toJSON());
  if (ENV.guildId) {
    await rest.put(Routes.applicationGuildCommands(ENV.clientId, ENV.guildId), { body: data });
    structuredLog('info', 'Registered guild slash commands', { guildId: ENV.guildId, count: data.length });
  } else {
    await rest.put(Routes.applicationCommands(ENV.clientId), { body: data });
    structuredLog('info', 'Registered global slash commands', { count: data.length });
  }
};
