import {
  ActionRowBuilder,
  AnyThreadChannel,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  ModalSubmitFields,
  StringSelectMenuBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  UserSelectMenuBuilder
} from 'discord.js';
import { Collection } from 'discord.js';
import { Command } from '@commands/types';
import { structuredLog } from '@utils/logger';
import { TicketService } from '@services/ticketService';
import { CaseService } from '@services/caseService';
import { hasStaffRole } from '@utils/permissions';
import { CONFIG } from '@config';

const ticketService = new TicketService();
const caseService = new CaseService();

const TICKET_ASSIGN_ID = 'ticket_assign';
const TICKET_CLAIM_ID = 'ticket_claim';
const TICKET_CONVERT_ID = 'ticket_convert';
const TICKET_CLOSE_ID = 'ticket_close';

const createTicketActions = (ticketId: string) => {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${TICKET_ASSIGN_ID}:${ticketId}`).setLabel('Assign').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${TICKET_CLAIM_ID}:${ticketId}`).setLabel('Claim').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`${TICKET_CONVERT_ID}:${ticketId}`).setLabel('Convert to Case').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`${TICKET_CLOSE_ID}:${ticketId}`).setLabel('Close').setStyle(ButtonStyle.Danger)
  );
};

const createTicketEmbed = (ticketId: string, type: string, intake: Record<string, string>) => {
  const embed = new EmbedBuilder()
    .setTitle('Hart Law PLLC')
    .setDescription(`Ticket **${ticketId}** opened for ${type.toUpperCase()} intake.`)
    .setColor(0x004aad)
    .setTimestamp(new Date());
  for (const [key, value] of Object.entries(intake)) {
    if (key === 'client_name') continue;
    embed.addFields({ name: key, value: value.length > 1024 ? `${value.slice(0, 1010)}…` : value });
  }
  return embed;
};

const createIntakeThread = async (interaction: Interaction, nameHint: string, clientUserId: string): Promise<AnyThreadChannel | TextChannel> => {
  const guild = interaction.guild;
  if (!guild) throw new Error('Guild not found');
  const intakeChannel = await guild.channels.fetch(CONFIG.intakeChannelId);
  if (!intakeChannel) throw new Error('Intake channel missing');

  if (intakeChannel.type === ChannelType.GuildText) {
    const thread = await intakeChannel.threads.create({
      name: nameHint,
      type: ChannelType.PrivateThread,
      reason: 'Hart Law intake ticket',
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
    });
    await thread.members.add(clientUserId).catch(() => null);
    return thread;
  }

  const category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('tickets'));
  const channel = await guild.channels.create({
    name: nameHint,
    type: ChannelType.GuildText,
    parent: category?.id,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: ['ViewChannel'] },
      ...CONFIG.staffRoleIds.map((roleId) => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
      { id: clientUserId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
    ]
  });
  return channel as TextChannel;
};

const openCloseTicketModal = (interaction: Interaction, ticketId: string) => {
  const modal = new ModalBuilder().setCustomId(`ticket-close-modal:${ticketId}`).setTitle('Close Ticket');
  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for closing')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  if (interaction.isButton()) {
    interaction.showModal(modal);
  }
};

const buildIntakePayload = (type: 'civil' | 'criminal' | 'appellate', fields: ModalSubmitFields) => {
  const intake: Record<string, string> = {};
  switch (type) {
    case 'civil':
      intake['client_name'] = fields.getTextInputValue('civil_client_name');
      intake['Roblox/Discord Username'] = fields.getTextInputValue('civil_client_name');
      intake['Entity being sued'] = fields.getTextInputValue('civil_entity');
      intake['Defendant Username'] = fields.getTextInputValue('civil_defendant');
      intake['Remedies sought'] = fields.getTextInputValue('civil_remedies');
      intake['Story & key facts'] = fields.getTextInputValue('civil_story');
      break;
    case 'criminal':
      intake['client_name'] = fields.getTextInputValue('criminal_client_name');
      intake['Roblox/Discord Username'] = fields.getTextInputValue('criminal_client_name');
      intake['Charges faced'] = fields.getTextInputValue('criminal_charges');
      intake['Case Number'] = fields.getTextInputValue('criminal_case_number');
      intake['Prior convictions & detention'] = fields.getTextInputValue('criminal_history');
      intake['Circumstances'] = fields.getTextInputValue('criminal_circumstances');
      break;
    case 'appellate':
      intake['client_name'] = fields.getTextInputValue('appellate_client_name');
      intake['Roblox/Discord Username'] = fields.getTextInputValue('appellate_client_name');
      intake['Original Case No.'] = fields.getTextInputValue('appellate_case_no');
      intake['Date of Judgment/Order'] = fields.getTextInputValue('appellate_date');
      intake['Issue(s) to appeal'] = fields.getTextInputValue('appellate_issues');
      intake['Case history & why appealing'] = fields.getTextInputValue('appellate_history');
      break;
  }
  return intake;
};

const handleTicketModal = async (interaction: Interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('ticket-new-')) return;
  const type = interaction.customId.replace('ticket-new-', '') as 'civil' | 'criminal' | 'appellate';
  try {
    const intake = buildIntakePayload(type, interaction.fields);
    const placeholderName = `${type}-intake`;
    const threadOrChannel = await createIntakeThread(interaction, placeholderName, interaction.user.id);
    const ticket = await ticketService.createTicket({
      type,
      clientUserId: interaction.user.id,
      intakeJson: intake,
      intakeChannelId: CONFIG.intakeChannelId,
      threadId: threadOrChannel.id
    });

    if (threadOrChannel.type === ChannelType.PrivateThread || threadOrChannel.type === ChannelType.PublicThread) {
      await threadOrChannel.setName(ticket.id).catch(() => null);
    } else if (threadOrChannel.isTextBased()) {
      await (threadOrChannel as TextChannel).setName(ticket.id.toLowerCase()).catch(() => null);
    }

    const embed = createTicketEmbed(ticket.id, type, intake);
    if (threadOrChannel.isTextBased()) {
      await threadOrChannel.send({
        content: `Ticket ${ticket.id} created by <@${interaction.user.id}>`,
        embeds: [embed],
        components: [createTicketActions(ticket.id)]
      });
    }

    await interaction.reply({ content: `Your ticket **${ticket.id}** has been opened. Staff will reach out shortly.`, ephemeral: true });
  } catch (error) {
    structuredLog('error', 'Error handling ticket modal', { error });
    if (!interaction.replied) {
      await interaction.reply({ content: 'Failed to create ticket. Please contact staff.', ephemeral: true }).catch(() => null);
    }
  }
};

const handleCloseModal = async (interaction: Interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('ticket-close-modal')) return;
  const [_, ticketId] = interaction.customId.split(':');
  const reason = interaction.fields.getTextInputValue('reason');
  const ticket = ticketService.getTicket(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }
  ticketService.updateStatus(ticketId, 'CLOSED');
  await interaction.reply({ content: `Ticket ${ticketId} closed. Reason: ${reason}`, ephemeral: true });
  const channel = await interaction.guild?.channels.fetch(ticket.thread_or_channel_id).catch(() => null);
  if (channel?.isTextBased()) {
    await channel.send({ content: `Ticket closed by <@${interaction.user.id}>: ${reason}` });
  }
};

const handleAssignSelect = async (interaction: Interaction) => {
  if (!interaction.isUserSelectMenu()) return;
  if (!interaction.customId.startsWith('ticket-assign-select')) return;
  const [_, ticketId] = interaction.customId.split(':');
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? (await interaction.guild?.members.fetch(interaction.user.id));
  if (!hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'Staff only action.', ephemeral: true });
    return;
  }
  const selected = interaction.values[0];
  ticketService.updateAssignment(ticketId, selected);
  await interaction.update({ content: `Assigned ticket ${ticketId} to <@${selected}>`, components: [] });
  const ticket = ticketService.getTicket(ticketId);
  if (ticket) {
    const channel = await interaction.guild?.channels.fetch(ticket.thread_or_channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send({ content: `Ticket assigned to <@${selected}> by <@${interaction.user.id}>.` });
    }
  }
};

const handleConvertSelect = async (interaction: Interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('ticket-convert-select')) return;
  const [_, ticketId] = interaction.customId.split(':');
  const division = interaction.values[0] as 'civil' | 'criminal' | 'appellate';
  const ticket = ticketService.getTicket(ticketId);
  if (!ticket) {
    await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
    return;
  }
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: 'Guild not accessible.', ephemeral: true });
    return;
  }
  const intake = JSON.parse(ticket.intake_json) as Record<string, string>;
  const clientName = intake['client_name'] ?? 'client';
  const caseChannelName = `case-${clientName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`.slice(0, 90) || 'case';
  const category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(division));
  const channel = await guild.channels.create({
    name: caseChannelName,
    type: ChannelType.GuildText,
    parent: category?.id,
    reason: `Case channel for ${ticketId}`,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: ['ViewChannel'] },
      ...CONFIG.staffRoleIds.map((roleId) => ({ id: roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] })),
      { id: ticket.client_user_id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
    ]
  });
  const caseRecord = caseService.createCase({ division, clientName, channelId: channel.id });
  ticketService.linkCase(ticketId, caseRecord.id);
  ticketService.updateStatus(ticketId, 'ACTIVE');
  await channel.send({ content: `Case channel created from ticket ${ticketId}.` });
  await interaction.update({ content: `Ticket ${ticketId} converted to case ${caseRecord.id}.`, components: [] });
};

const handleButtons = async (interaction: Interaction) => {
  if (!interaction.isButton()) return;
  const [action, ticketId] = interaction.customId.split(':');
  const member = interaction.guild?.members.cache.get(interaction.user.id) ?? (await interaction.guild?.members.fetch(interaction.user.id));
  if (![TICKET_CLAIM_ID].includes(action) && !hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'Staff only action.', ephemeral: true });
    return;
  }
  switch (action) {
    case TICKET_ASSIGN_ID: {
      const menu = new UserSelectMenuBuilder().setCustomId(`ticket-assign-select:${ticketId}`).setPlaceholder('Select staff member');
      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu);
      await interaction.reply({ content: 'Select staff member to assign.', components: [row], ephemeral: true });
      break;
    }
    case TICKET_CLAIM_ID: {
      ticketService.updateAssignment(ticketId, interaction.user.id);
      await interaction.reply({ content: `You claimed ticket ${ticketId}.`, ephemeral: true });
      const ticket = ticketService.getTicket(ticketId);
      if (ticket) {
        const channel = await interaction.guild?.channels.fetch(ticket.thread_or_channel_id).catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send({ content: `<@${interaction.user.id}> has claimed this ticket.` });
        }
      }
      break;
    }
    case TICKET_CONVERT_ID: {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`ticket-convert-select:${ticketId}`)
        .setPlaceholder('Select division')
        .addOptions([
          { label: 'Civil', value: 'civil' },
          { label: 'Criminal', value: 'criminal' },
          { label: 'Appellate', value: 'appellate' }
        ]);
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
      await interaction.reply({ content: 'Choose division for the case.', components: [row], ephemeral: true });
      break;
    }
    case TICKET_CLOSE_ID: {
      openCloseTicketModal(interaction, ticketId);
      break;
    }
  }
};

const handleModalAndButtons = async (interaction: Interaction) => {
  await handleTicketModal(interaction);
  await handleCloseModal(interaction);
  await handleAssignSelect(interaction);
  await handleConvertSelect(interaction);
  await handleButtons(interaction);
};

const executeCommand = async (interaction: ChatInputCommandInteraction, client: Client, commands: Collection<string, Command>) => {
  const command = commands.get(interaction.commandName);
  if (!command) return;
  await command.execute(interaction, client);
};

export default (client: Client, commands: Collection<string, Command>) => {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await executeCommand(interaction, client, commands);
        return;
      }
      await handleModalAndButtons(interaction);
    } catch (error) {
      structuredLog('error', 'Interaction handler error', { error, interaction: interaction.id });
      if ('reply' in interaction && !interaction.replied) {
        try {
          await (interaction as any).reply({ content: 'An error occurred processing this interaction.', ephemeral: true });
        } catch (err) {
          structuredLog('error', 'Failed to send error reply', { err });
        }
      }
    }
  });
};
