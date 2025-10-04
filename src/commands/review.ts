import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from './types';
import { CONFIG } from '@config';
import { ReviewService } from '@services/reviewService';

const reviewService = new ReviewService();

const data = new SlashCommandBuilder()
  .setName('review')
  .setDescription('Submit a Hart Law review')
  .addIntegerOption((option) => option.setName('rating').setDescription('Rating 1-5').setRequired(true).setMinValue(1).setMaxValue(5))
  .addStringOption((option) => option.setName('text').setDescription('Review text').setRequired(true).setMaxLength(1000));

const execute = async (interaction: ChatInputCommandInteraction) => {
  if (interaction.channelId !== CONFIG.reviewChannelId) {
    await interaction.reply({ content: 'This command can only be used in the dedicated review channel.', ephemeral: true });
    return;
  }
  const rating = interaction.options.getInteger('rating', true);
  const text = interaction.options.getString('text', true);
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  const embed = new EmbedBuilder()
    .setTitle('Hart Law PLLC')
    .setDescription(`${stars}\n${text}`)
    .setFooter({ text: `Submitted by ${interaction.user.tag}` })
    .setTimestamp(new Date());
  const message = await interaction.channel?.send({ content: `<@${interaction.user.id}> submitted a review:`, embeds: [embed] });
  if (message) {
    reviewService.addReview(interaction.user.id, rating, text, message.id);
  }
  await interaction.reply({ content: 'Thank you for your review!', ephemeral: true });
};

const command: Command = {
  data,
  execute
};

export default command;
