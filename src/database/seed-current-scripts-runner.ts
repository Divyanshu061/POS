// shell-runner: runs your existing standalone seed scripts (those that call seed() themselves)
// Usage: npx ts-node -r tsconfig-paths/register src/database/seed-current-scripts-runner.ts

import * as child from 'child_process';

const scripts = [
  'src/database/seed-users.ts',
  'src/database/seed-clients.ts',
  'src/database/seed-clients-invoices-payments.ts',
  'src/database/seed-invoices-payments.ts',
  'src/database/seed-products.ts',
  'src/database/seed-purchase-orders.ts',
  'src/database/seed-sales.ts',
  'src/database/seed-tags.ts',
];

function runScript(script: string) {
  console.log('\n--- Running', script, '---');
  child.execSync(`npx ts-node -r tsconfig-paths/register ${script}`, {
    stdio: 'inherit',
  });
}

try {
  for (const s of scripts) runScript(s);
  console.log('\n🎉 All listed current seeds completed successfully');
} catch (err) {
  console.error('\n❌ Seed runner failed:', err);
  process.exit(1);
}
