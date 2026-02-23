import { PaprikaMcpCommandLine } from './cli/PaprikaCommandLine.js';

async function main() {
  const commandLine = new PaprikaMcpCommandLine();
  await commandLine.executeAsync();
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
