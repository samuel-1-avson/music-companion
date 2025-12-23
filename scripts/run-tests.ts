/**
 * Music Companion Test Runner Script
 * 
 * Run with: npx ts-node scripts/run-tests.ts
 * Or use npm scripts:
 *   npm test          - Run unit tests once
 *   npm run test:watch - Run unit tests in watch mode
 *   npm run test:coverage - Run with coverage report
 *   npm run e2e       - Run Playwright e2e tests
 *   npm run e2e:ui    - Run e2e tests with Playwright UI
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🎵 MUSIC COMPANION TEST RUNNER 🎵                   ║
╠═══════════════════════════════════════════════════════════════╣
`);

const testCommands: Record<string, { cmd: string; desc: string }> = {
  'unit': { cmd: 'npm test', desc: 'Run all unit tests' },
  'watch': { cmd: 'npm run test:watch', desc: 'Run unit tests in watch mode' },
  'coverage': { cmd: 'npm run test:coverage', desc: 'Run tests with coverage' },
  'e2e': { cmd: 'npm run e2e', desc: 'Run Playwright e2e tests' },
  'e2e:ui': { cmd: 'npm run e2e:ui', desc: 'Run e2e tests with UI' },
  'e2e:headed': { cmd: 'npm run e2e:headed', desc: 'Run e2e tests in browser' },
  'all': { cmd: 'npm test && npm run e2e', desc: 'Run all tests' },
};

if (args.length === 0 || args[0] === 'help') {
  console.log('║ Available commands:                                           ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  Object.entries(testCommands).forEach(([key, { desc }]) => {
    console.log(`║  ${key.padEnd(12)} - ${desc.padEnd(43)} ║`);
  });
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('\nUsage: npx ts-node scripts/run-tests.ts <command>');
  process.exit(0);
}

const testType = args[0];

if (!testCommands[testType]) {
  console.error(`Unknown test command: ${testType}`);
  console.log('Run with "help" for available commands');
  process.exit(1);
}

const { cmd, desc } = testCommands[testType];
console.log(`║ Running: ${desc.padEnd(52)} ║`);
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('\n✅ Tests completed successfully!');
} catch (error) {
  console.error('\n❌ Tests failed!');
  process.exit(1);
}
