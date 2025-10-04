import { GuildMember } from 'discord.js';
import { CONFIG } from '@config';

export const hasStaffRole = (member: GuildMember | null): boolean => {
  if (!member) return false;
  return CONFIG.staffRoleIds.some((roleId) => member.roles.cache.has(roleId));
};
