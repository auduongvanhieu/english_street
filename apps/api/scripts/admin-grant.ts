/**
 * Give an account access to the admin site (/admin/):
 *   pnpm --filter @es/api admin:grant <email> <admin|editor|player>
 */
import { prisma } from '../src/plugins/prisma';

const [email, role = 'admin'] = process.argv.slice(2);
if (!email || !['admin', 'editor', 'player'].includes(role)) {
  console.error('usage: admin:grant <email> <admin|editor|player>');
  process.exit(1);
}
const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
if (!u) {
  console.error(`no account with email ${email} — sign up in the game first`);
  process.exit(1);
}
await prisma.user.update({ where: { id: u.id }, data: { role: role as 'admin' | 'editor' | 'player' } });
await prisma.adminAudit.create({ data: { actorId: 'cli', actorName: 'admin:grant', action: 'user.role', target: u.id, before: { role: u.role }, after: { role } } });
console.log(`${u.name} <${u.email}> is now ${role}`);
await prisma.$disconnect();
