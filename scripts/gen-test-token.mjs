/**
 * Generates a test monday.com sessionToken for local testing.
 * Usage: MONDAY_SIGNING_SECRET=your-secret node scripts/gen-test-token.mjs
 *
 * Then set NEXT_PUBLIC_DEV_SESSION_TOKEN=<output> in .env.local
 */
import { SignJWT } from 'jose';

const secret = process.env.MONDAY_SIGNING_SECRET;
if (!secret) {
  console.error('Set MONDAY_SIGNING_SECRET env var first');
  process.exit(1);
}

const accountId = parseInt(process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID ?? '34358922', 10);
const userId = parseInt(process.env.NEXT_PUBLIC_DEV_USER_ID ?? '101341530', 10);

const token = await new SignJWT({ accountId, userId })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(new TextEncoder().encode(secret));

console.log('\nTest session token (valid 7 days):\n');
console.log(token);
console.log('\nAdd to .env.local:\nNEXT_PUBLIC_DEV_SESSION_TOKEN=' + token + '\n');
