import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, ChannelType } from 'discord.js';
import { Command } from './types';
import { hasStaffRole } from '@utils/permissions';
import { CaseService } from '@services/caseService';
import { FileService } from '@services/fileService';
import { CONFIG } from '@config';

const caseService = new CaseService();
const fileService = new FileService();

const ensureStaff = async (interaction: ChatInputCommandInteraction): Promise<GuildMember | null> => {
  const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild?.members.fetch(interaction.user.id);
  if (!hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'This command is restricted to staff.', ephemeral: true });
    return null;
  }
  return member ?? null;
};

const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Manage Hart Law cases')
  .addSubcommand((sub) =>
    sub
      .setName('archive')
      .setDescription('Archive a case channel')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
      .addStringOption((option) => option.setName('category').setDescription('Archive category code').setRequired(true).addChoices(
        { name: 'Civil (CV)', value: 'CV' },
        { name: 'Criminal (CR)', value: 'CR' },
        { name: 'SCOTUS/Appellate (SC)', value: 'SC' }
      ))
      .addStringOption((option) => option.setName('client_name').setDescription('Client display name').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('set-currency')
      .setDescription('Set case billing currency')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
      .addStringOption((option) => option.setName('currency').setDescription('Currency').setRequired(true).addChoices(
        { name: 'USD', value: 'USD' },
        { name: 'Robux (R$)', value: 'R$' }
      ))
  )
  .addSubcommand((sub) =>
    sub
      .setName('set-contingency')
      .setDescription('Configure contingency for a civil case')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
      .addBooleanOption((option) => option.setName('enabled').setDescription('Enable contingency?').setRequired(true))
      .addIntegerOption((option) => option.setName('percent').setDescription('Percent (20 or 30)').setRequired(false))
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const member = await ensureStaff(interaction);
  if (!member) return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'archive') {
    const caseId = interaction.options.getString('case_id', true);
    const category = interaction.options.getString('category', true) as 'CV' | 'CR' | 'SC';
    const clientName = interaction.options.getString('client_name', true);
    const caseRecord = caseService.getCase(caseId);
    if (!caseRecord) {
      await interaction.reply({ content: 'Case not found.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'Guild not available.', ephemeral: true });
      return;
    }
    const channel = await guild.channels.fetch(caseRecord.channel_id);
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Case channel not accessible.', ephemeral: true });
      return;
    }
    await channel.setParent(CONFIG.archiveCategoryId).catch(() => null);
    const newNamePrefix = category;
    await channel.setName(`${newNamePrefix} - ${clientName}`.slice(0, 90));
    caseService.archiveCase(caseId, category);
    fileService.ensureArchiveFolder(caseId, category, clientName);
    await interaction.reply({ content: `Case ${caseId} archived under ${category}.`, ephemeral: true });
    await channel.send(`This case has been archived by <@${interaction.user.id}>.`);
    return;
  }

  if (subcommand === 'set-currency') {
    const caseId = interaction.options.getString('case_id', true);
    const currency = interaction.options.getString('currency', true) as 'USD' | 'R$';
    caseService.setCurrency(caseId, currency);
    await interaction.reply({ content: `Updated currency for ${caseId} to ${currency}.`, ephemeral: true });
    return;
  }

  if (subcommand === 'set-contingency') {
    const caseId = interaction.options.getString('case_id', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    const percent = interaction.options.getInteger('percent');
    if (enabled && percent && ![20, 30].includes(percent)) {
      await interaction.reply({ content: 'Percent must be 20 or 30 when enabling contingency.', ephemeral: true });
      return;
    }
    caseService.setContingency(caseId, enabled, enabled ? percent ?? 30 : null);
    await interaction.reply({ content: `Contingency for ${caseId} ${enabled ? `enabled at ${percent ?? 30}%` : 'disabled'}.`, ephemeral: true });
    return;
  }
};

const command: Command = {
  data,
  execute
};

export default command;
