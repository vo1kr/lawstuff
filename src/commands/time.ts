import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { Command } from './types';
import { hasStaffRole } from '@utils/permissions';
import { BillingService, Tier } from '@services/billingService';

const billingService = new BillingService();

const data = new SlashCommandBuilder()
  .setName('time')
  .setDescription('Track billable time')
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Add a time entry to a case')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
      .addStringOption((option) => option.setName('role').setDescription('Role title').setRequired(true))
      .addStringOption((option) =>
        option
          .setName('tier')
          .setDescription('Billing tier')
          .setRequired(true)
          .addChoices(
            { name: 'Standard', value: 'standard' },
            { name: 'High-Profile', value: 'high-profile' },
            { name: 'SCOTUS', value: 'scotus' }
          )
      )
      .addNumberOption((option) => option.setName('hours').setDescription('Hours worked').setRequired(true).setMinValue(0.1))
      .addStringOption((option) => option.setName('description').setDescription('Description of work').setRequired(true))
      .addBooleanOption((option) => option.setName('travel').setDescription('Is this travel time?'))
      .addBooleanOption((option) => option.setName('internal_conference').setDescription('Internal conference time?'))
      .addIntegerOption((option) => option.setName('team_size').setDescription('Team size for Robux billing').setMinValue(1).setMaxValue(10))
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild?.members.fetch(interaction.user.id);
  if (!hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'Staff only.', ephemeral: true });
    return;
  }
  const caseId = interaction.options.getString('case_id', true);
  const role = interaction.options.getString('role', true);
  const tier = interaction.options.getString('tier', true) as Tier;
  const hours = interaction.options.getNumber('hours', true);
  const description = interaction.options.getString('description', true);
  const isTravel = interaction.options.getBoolean('travel') ?? false;
  const isInternal = interaction.options.getBoolean('internal_conference') ?? false;
  const teamSize = interaction.options.getInteger('team_size') ?? 1;

  try {
    const entry = billingService.addTimeEntry({
      caseId,
      staffUserId: interaction.user.id,
      role,
      tier,
      hours,
      description,
      isTravel,
      isInternalConference: isInternal,
      teamSize
    });
    await interaction.reply({
      content: `Logged ${entry.hours.toFixed(2)} hours for case ${caseId}. USD $${(entry.amount_usd ?? 0).toFixed(2)} | R$ ${entry.amount_rbx?.toFixed(2)}`,
      ephemeral: true
    });
  } catch (error: any) {
    await interaction.reply({ content: `Failed to add time entry: ${error.message ?? error}`, ephemeral: true });
  }
};

const command: Command = {
  data,
  execute
};

export default command;
