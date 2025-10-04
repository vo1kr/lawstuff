import {
  SlashCommandBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  GuildMember
} from 'discord.js';
import { Command } from './types';
import { hasStaffRole } from '@utils/permissions';
import { TicketService } from '@services/ticketService';
import { CaseService } from '@services/caseService';
import { CONFIG } from '@config';
import { structuredLog } from '@utils/logger';

const ticketService = new TicketService();
const caseService = new CaseService();

const buildModal = (type: 'civil' | 'criminal' | 'appellate') => {
  const modal = new ModalBuilder().setCustomId(`ticket-new-${type}`).setTitle(`New ${type} ticket`);
  const inputs: TextInputBuilder[] = [];
  if (type === 'civil') {
    inputs.push(
      new TextInputBuilder().setCustomId('civil_client_name').setLabel('Roblox/Discord Username').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('civil_entity').setLabel('Entity you are suing (N/A if person)').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('civil_defendant').setLabel("Defendant's Username (N/A if entity)").setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('civil_remedies').setLabel('Remedies sought').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('civil_story').setLabel('Story & key facts').setRequired(true).setStyle(TextInputStyle.Paragraph)
    );
  } else if (type === 'criminal') {
    inputs.push(
      new TextInputBuilder().setCustomId('criminal_client_name').setLabel('Roblox/Discord Username').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('criminal_charges').setLabel('Charges faced').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('criminal_case_number').setLabel('Case Number (optional)').setRequired(false).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('criminal_history').setLabel('Prior convictions & currently detained?').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('criminal_circumstances').setLabel('Circumstances leading to charges').setRequired(true).setStyle(TextInputStyle.Paragraph)
    );
  } else {
    inputs.push(
      new TextInputBuilder().setCustomId('appellate_client_name').setLabel('Roblox/Discord Username').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('appellate_case_no').setLabel('Original Case No.').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('appellate_date').setLabel('Date of Judgment/Order (YYYY-MM-DD)').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('appellate_issues').setLabel('Issue(s) to appeal').setRequired(true).setStyle(TextInputStyle.Short),
      new TextInputBuilder().setCustomId('appellate_history').setLabel('Case history & why appealing').setRequired(true).setStyle(TextInputStyle.Paragraph)
    );
  }
  inputs.forEach((input) => modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)));
  return modal;
};

const ensureStaff = (member: GuildMember | null): boolean => {
  return hasStaffRole(member ?? null);
};

const handleAppellateFromCase = async (interaction: ChatInputCommandInteraction) => {
  const caseId = interaction.options.getString('case_id', true);
  const caseRecord = caseService.getCase(caseId);
  if (!caseRecord) {
    await interaction.reply({ content: 'Case not found.', ephemeral: true });
    return;
  }
  const intake = {
    client_name: caseRecord.client_name,
    'Roblox/Discord Username': caseRecord.client_name,
    'Original Case No.': caseId,
    'Date of Judgment/Order': new Date().toISOString().slice(0, 10),
    'Issue(s) to appeal': 'Linked appellate request',
    'Case history & why appealing': 'Linked from existing case'
  };
  const ticket = await ticketService.createTicket({
    type: 'appellate',
    clientUserId: interaction.user.id,
    intakeJson: intake,
    intakeChannelId: CONFIG.intakeChannelId,
    threadId: caseRecord.channel_id,
    linkedCaseId: caseId
  });
  ticketService.updateStatus(ticket.id, 'ACTIVE');
  await interaction.reply({ content: `Linked appellate ticket ${ticket.id} created for case ${caseId}.`, ephemeral: true });
};

const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Hart Law ticketing')
  .addSubcommand((sub) =>
    sub
      .setName('new')
      .setDescription('Open a new intake ticket')
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Ticket type')
          .setRequired(true)
          .addChoices(
            { name: 'Civil Litigation', value: 'civil' },
            { name: 'Criminal Defense', value: 'criminal' },
            { name: 'Appellate Representation', value: 'appellate' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('assign')
      .setDescription('Assign a ticket to a staff member')
      .addStringOption((option) => option.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
      .addUserOption((option) => option.setName('user').setDescription('User to assign').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('claim')
      .setDescription('Claim a ticket')
      .addStringOption((option) => option.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('close')
      .setDescription('Close a ticket with a reason')
      .addStringOption((option) => option.setName('ticket_id').setDescription('Ticket ID').setRequired(true))
      .addStringOption((option) => option.setName('reason').setDescription('Reason for closing').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('appellate-from-case')
      .setDescription('Create an appellate ticket linked to an existing case')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'new') {
    const type = interaction.options.getString('type', true) as 'civil' | 'criminal' | 'appellate';
    await interaction.showModal(buildModal(type));
    return;
  }

  const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild?.members.fetch(interaction.user.id);
  if (!ensureStaff(member ?? null)) {
    await interaction.reply({ content: 'This command is restricted to staff.', ephemeral: true });
    return;
  }

  if (subcommand === 'assign') {
    const ticketId = interaction.options.getString('ticket_id', true);
    const user = interaction.options.getUser('user', true);
    ticketService.updateAssignment(ticketId, user.id);
    await interaction.reply({ content: `Assigned ticket ${ticketId} to <@${user.id}>.`, ephemeral: true });
    return;
  }

  if (subcommand === 'claim') {
    const ticketId = interaction.options.getString('ticket_id', true);
    ticketService.updateAssignment(ticketId, interaction.user.id);
    await interaction.reply({ content: `You claimed ticket ${ticketId}.`, ephemeral: true });
    return;
  }

  if (subcommand === 'close') {
    const ticketId = interaction.options.getString('ticket_id', true);
    const reason = interaction.options.getString('reason', true);
    ticketService.updateStatus(ticketId, 'CLOSED');
    await interaction.reply({ content: `Ticket ${ticketId} closed. Reason: ${reason}`, ephemeral: true });
    return;
  }

  if (subcommand === 'appellate-from-case') {
    await handleAppellateFromCase(interaction);
    return;
  }

  structuredLog('warn', 'Unhandled ticket subcommand', { subcommand });
};

const command: Command = {
  data,
  execute
};

export default command;
