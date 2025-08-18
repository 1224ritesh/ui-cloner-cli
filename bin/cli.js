#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import UICloneCLI from '../lib/ui-clone-cli.js';

const program = new Command();

program
  .name("ui-clone")
  .description(
    "🎨 AI-powered CLI to perfectly clone website UIs to HTML/CSS/JS"
  )
  .version("1.0.0")
  .argument("[url]", "Website URL to clone")
  .option("-o, --output <dir>", "Output directory", "./cloned-ui")
  .option("-k, --api-key <key>", "Gemini API key")
  .option("--no-ai", "Disable AI processing (preserve original HTML structure)")
  .action(async (url, options) => {
    try {
      const cli = new UICloneCLI();

      // Always use HTML output type
      options.type = "html";

      if (url) {
        // Direct clone command
        await cli.cloneWebsite(url, options);
      } else {
        // Interactive mode
        await cli.startInteractive();
      }
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("clone <url>")
  .description("Clone a website UI to HTML/CSS/JS")
  .option("-o, --output <dir>", "Output directory", "./cloned-ui")
  .option("-k, --api-key <key>", "Gemini API key")
  .option("--no-ai", "Disable AI processing (preserve original HTML structure)")
  .action(async (url, options) => {
    try {
      const cli = new UICloneCLI();
      // Always use HTML output type
      options.type = "html";
      await cli.cloneWebsite(url, options);
    } catch (error) {
      console.error(chalk.red("❌ Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command('chat')
  .description('Start interactive AI chat mode')
  .action(async () => {
    try {
      const cli = new UICloneCLI();
      await cli.startChat();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Setup Gemini API key')
  .action(async () => {
    try {
      const cli = new UICloneCLI();
      await cli.setupApiKey();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();