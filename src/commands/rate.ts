import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from './types';
import { RateService } from '@services/rateService';

const rateService = new RateService();

const data = new SlashCommandBuilder()
  .setName('rate')
  .setDescription('Show Hart Law billing rates')
  .addSubcommand((sub) =>
    sub
      .setName('show')
      .setDescription('Show rate table for a tier')
      .addStringOption((option) =>
        option
          .setName('tier')
          .setDescription('Tier to view')
          .setRequired(true)
          .addChoices(
            { name: 'Standard', value: 'standard' },
            { name: 'High-Profile', value: 'high-profile' },
            { name: 'SCOTUS', value: 'scotus' }
          )
      )
  );

const execute = async (interaction: ChatInputCommandInteraction) => {
  const tier = interaction.options.getString('tier', true) as 'standard' | 'high-profile' | 'scotus';
  const rates = rateService.getRatesForTier(tier);
  const rows = rates.map((rate) => `**${rate.role}** — $${rate.rate.toFixed(2)}/hr`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('Hart Law PLLC')
    .setDescription(`Hourly rates for the ${tier} tier`)
    .addFields({ name: 'Rates (USD)', value: rows || 'No rates configured.' })
    .addFields({
      name: 'Robux Formula',
      value:
        tier === 'standard'
          ? 'Lead 40 R$/hr; each additional team member +20 R$/hr'
          : tier === 'high-profile'
          ? 'Lead 60 R$/hr; each additional team member +30 R$/hr'
          : 'Lead 75 R$/hr; each additional team member +35 R$/hr'
    })
    .setTimestamp(new Date());
  await interaction.reply({ embeds: [embed], ephemeral: true });
};

const command: Command = {
  data,
  execute
};

export default command;
