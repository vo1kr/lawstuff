import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from './types';
import { hasStaffRole } from '@utils/permissions';
import { SettingsService } from '@services/settingsService';

const settingsService = new SettingsService();
const allowedKeys = new Set([
  'invoice_cadence_days',
  'invoice_due_days',
  'late_policy_type',
  'late_policy_value',
  'billing_min_increment',
  'travel_half_rate',
  'internal_conference_cap',
  'max_simultaneous_billable',
  'require_retainer'
]);

const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Hart Law runtime settings')
  .addSubcommand((sub) => sub.setName('show').setDescription('Show runtime settings'))
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Update a runtime setting')
      .addStringOption((option) => option.setName('key').setDescription('Setting key').setRequired(true))
      .addStringOption((option) => option.setName('value').setDescription('Value').setRequired(true))
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild?.members.fetch(interaction.user.id);
  if (!hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'Staff only.', ephemeral: true });
    return;
  }
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'show') {
    const settings = await settingsService.all();
    const entries = Object.entries(settings)
      .map(([key, value]) => `• **${key}**: ${value}`)
      .join('\n');
    await interaction.reply({ content: entries || 'No settings stored.', ephemeral: true });
    return;
  }
  if (subcommand === 'set') {
    const key = interaction.options.getString('key', true);
    const value = interaction.options.getString('value', true);
    if (!allowedKeys.has(key)) {
      await interaction.reply({ content: 'That setting cannot be changed at runtime.', ephemeral: true });
      return;
    }
    await settingsService.set(key, value);
    await interaction.reply({ content: `Updated ${key} to ${value}.`, ephemeral: true });
    return;
  }
};

const command: Command = {
  data,
  execute
};

export default command;
