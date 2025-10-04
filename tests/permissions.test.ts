import { hasStaffRole } from '../src/utils/permissions';
import { CONFIG } from '../src/config';

test('returns true when member has staff role', () => {
  const roleId = CONFIG.staffRoleIds[0];
  const member: any = { roles: { cache: new Map([[roleId, true]]) } };
  member.roles.cache.has = (id: string) => member.roles.cache.get(id) ?? false;
  expect(hasStaffRole(member)).toBe(true);
});

test('returns false when member lacks staff role', () => {
  const member: any = { roles: { cache: new Map() } };
  member.roles.cache.has = () => false;
  expect(hasStaffRole(member)).toBe(false);
});
