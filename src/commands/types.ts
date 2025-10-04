import { ChatInputCommandInteraction, SlashCommandBuilder, Client } from 'discord.js';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
}
