import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from './types';
import { RateService } from '@services/rateService';

const rateService = new RateService();

const data = new SlashCommandBuilder()
  .setName('retainer')
  .setDescription('Retainer quotes')
  .addSubcommand((sub) =>
    sub
      .setName('quote')
      .setDescription('Quote a 10-hour retainer at lead-partner rate')
      .addStringOption((option) =>
        option
          .setName('tier')
          .setDescription('Tier')
          .setRequired(true)
          .addChoices(
            { name: 'Standard', value: 'standard' },
            { name: 'High-Profile', value: 'high-profile' },
            { name: 'SCOTUS', value: 'scotus' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('currency')
          .setDescription('Currency (USD or R$)')
          .setRequired(true)
          .addChoices(
            { name: 'USD', value: 'USD' },
            { name: 'Robux (R$)', value: 'R$' }
          )
      )
  );

const retainerRobux: Record<'standard' | 'high-profile' | 'scotus', number> = {
  standard: 400,
  'high-profile': 600,
  scotus: 750
};

const execute = async (interaction: ChatInputCommandInteraction) => {
  const tier = interaction.options.getString('tier', true) as 'standard' | 'high-profile' | 'scotus';
  const currency = interaction.options.getString('currency', true) as 'USD' | 'R$';
  let amount: number;
  if (currency === 'USD') {
    const rate = rateService.getRate('Equity Partner (Lead Counsel)', tier) ?? 0;
    amount = rate * 10;
  } else {
    amount = retainerRobux[tier];
  }
  const embed = new EmbedBuilder()
    .setTitle('Hart Law PLLC')
    .setDescription(`Retainer quote for ${tier} tier`)
    .addFields({ name: 'Amount', value: currency === 'USD' ? `$${amount.toFixed(2)}` : `${amount} R$` })
    .addFields({ name: 'Basis', value: '10 hours at the lead-partner rate as required before work commences.' })
    .setTimestamp(new Date());
  await interaction.reply({ embeds: [embed], ephemeral: true });
};

const command: Command = {
  data,
  execute
};

export default command;
