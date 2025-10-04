import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { Command } from './types';
import { hasStaffRole } from '@utils/permissions';
import { BillingService } from '@services/billingService';
import { CaseService } from '@services/caseService';

const billingService = new BillingService();
const caseService = new CaseService();

const data = new SlashCommandBuilder()
  .setName('invoice')
  .setDescription('Generate invoice summaries')
  .addSubcommand((sub) =>
    sub
      .setName('summary')
      .setDescription('Summarize time entries for invoicing')
      .addStringOption((option) => option.setName('case_id').setDescription('Case ID').setRequired(true))
      .addStringOption((option) => option.setName('currency').setDescription('Currency').setRequired(true).addChoices(
        { name: 'USD', value: 'USD' },
        { name: 'Robux (R$)', value: 'R$' }
      ))
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild?.members.fetch(interaction.user.id);
  if (!hasStaffRole(member ?? null)) {
    await interaction.reply({ content: 'Staff only.', ephemeral: true });
    return;
  }
  const caseId = interaction.options.getString('case_id', true);
  const currency = interaction.options.getString('currency', true) as 'USD' | 'R$';
  const caseRecord = caseService.getCase(caseId);
  if (!caseRecord) {
    await interaction.reply({ content: 'Case not found.', ephemeral: true });
    return;
  }
  const summary = billingService.invoiceSummary(caseId, currency);
  const lines = summary.entries
    .map((entry) => `${entry.created_at.slice(0, 10)} — ${entry.description} (${entry.hours.toFixed(2)}h @ ${currency === 'USD' ? `$${(entry.rate_usd ?? 0).toFixed(2)}` : `${entry.rate_rbx ?? 0} R$`} = ${currency === 'USD' ? `$${(entry.amount_usd ?? 0).toFixed(2)}` : `${entry.amount_rbx ?? 0} R$`})`)
    .join('\n');
  const embed = new EmbedBuilder()
    .setTitle('Hart Law PLLC Invoice Summary')
    .addFields({ name: 'Case', value: `${caseId} (${caseRecord.client_name})` })
    .addFields({ name: 'Entries', value: lines || 'No billable time yet.' })
    .addFields({ name: 'Subtotal', value: currency === 'USD' ? `$${summary.subtotal.toFixed(2)}` : `${summary.subtotal.toFixed(2)} R$` })
    .setTimestamp(new Date());
  if (caseRecord.contingency_only) {
    embed.addFields({ name: 'Contingency', value: `${caseRecord.contingency_percent ?? 30}% of recovery (contingency only).` });
  } else if (caseRecord.contingency_percent) {
    embed.addFields({ name: 'Contingency', value: `${caseRecord.contingency_percent}% contingent success fee in addition to hourly.` });
  }
  await interaction.reply({ embeds: [embed], ephemeral: true });
};

const command: Command = {
  data,
  execute
};

export default command;
