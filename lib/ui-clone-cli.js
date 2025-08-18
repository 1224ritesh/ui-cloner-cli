import readline from "readline";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WebsiteCloner } from "./website-cloner.js";
import { AIAgent3 } from "./ai-agent3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class UICloneCLI {
  constructor() {
    this.configPath = path.join(os.homedir(), ".ui-clone-cli-config.json");
    this.conversationHistory = [];
    this.cloner = new WebsiteCloner();
    this.aiProcessor = null;
    this.rl = null;
  }

  async startInteractive() {
    console.clear();
    this.showWelcome();

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "🎨 Clone a website UI", value: "clone" },
          { name: "💬 Chat with AI assistant", value: "chat" },
          { name: "🔧 Setup API key", value: "setup" },
          { name: "❌ Exit", value: "exit" },
        ],
      },
    ]);

    switch (action) {
      case "clone":
        await this.interactiveClone();
        break;
      case "chat":
        await this.startChat();
        break;
      case "setup":
        await this.setupApiKey();
        break;
      case "exit":
        console.log(chalk.yellow("👋 Goodbye!"));
        process.exit(0);
    }
  }

  async interactiveClone() {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "url",
        message: "Enter the website URL to clone:",
        validate: (input) => {
          if (!input) return "URL is required";
          try {
            new URL(input);
            return true;
          } catch {
            return "Please enter a valid URL";
          }
        },
      },
      {
        type: "input",
        name: "output",
        message: "Output directory:",
        default: "./cloned-ui",
      },
    ]);

    await this.cloneWebsite(answers.url, answers);
  }

  async cloneWebsite(url, options = {}) {
    const spinner = ora("🚀 Initializing UI cloner...").start();

    try {
      // Initialize AI processor only if not disabled
      if (!options.noAi) {
        // Get API key
        const apiKey = options.apiKey || (await this.getApiKey());
        if (!apiKey) {
          spinner.warn("⚠️ No API key found. Cloning without AI processing.");
          options.useAI = false;
        } else {
          // Initialize AI agent with Groq DeepSeek
          this.aiProcessor = new AIAgent3(apiKey);
        }
      } else {
        console.log(
          chalk.gray(
            "ℹ️ AI processing disabled - preserving original HTML structure"
          )
        );
      }

      spinner.text = "🌐 Fetching website...";

      // Clone the website
      const result = await this.cloner.clone(url, {
        outputDir: options.output || "./cloned-ui",
        outputType: "html", // Always use HTML output
        aiProcessor: this.aiProcessor,
        useAI: !options.noAi && !!this.aiProcessor, // Enable AI by default unless --no-ai is used
      });

      spinner.succeed(chalk.green("✅ Website cloned successfully!"));

      console.log(chalk.blue("\n📁 Output:"), result.outputPath);
      console.log(chalk.blue("🎨 Type:"), result.outputType);
      console.log(chalk.blue("📊 Assets:"), `${result.assetsCount} files`);

      console.log(chalk.yellow("\n🌐 To serve locally:"));
      console.log(chalk.white(`  cd ${result.outputPath}`));
      console.log(chalk.white("  python -m http.server 8000"));
    } catch (error) {
      spinner.fail(chalk.red("❌ Cloning failed: " + error.message));
    }
  }

  async startChat() {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      console.log(chalk.red("❌ No API key found. Please run setup first."));
      await this.setupApiKey();
      return;
    }

    this.aiProcessor = new AIAgent3(apiKey);

    console.log(
      chalk.green("\n💬 AI Chat Mode - Type your message or commands")
    );
    console.log(chalk.gray("Commands: clone <url>, help, exit"));

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue("🤖 > "),
    });

    this.setupChatHandlers();
    this.rl.prompt();
  }

  setupChatHandlers() {
    this.rl.on("line", async (input) => {
      const trimmedInput = input.trim();

      if (trimmedInput === "") {
        this.rl.prompt();
        return;
      }

      if (trimmedInput.toLowerCase() === "exit") {
        console.log(chalk.yellow("👋 Goodbye!"));
        process.exit(0);
      }

      if (trimmedInput.toLowerCase() === "help") {
        this.showChatHelp();
        this.rl.prompt();
        return;
      }

      // Check for clone command
      const cloneMatch = trimmedInput.match(/^clone\s+(https?:\/\/[^\s]+)/i);
      if (cloneMatch) {
        const url = cloneMatch[1];
        console.log(chalk.blue(`\n🎨 Cloning ${url}...`));
        await this.cloneWebsite(url);
        this.rl.prompt();
        return;
      }

      await this.processChatInput(trimmedInput);
      this.rl.prompt();
    });

    this.rl.on("close", () => {
      console.log(chalk.yellow("\n👋 Goodbye!"));
      process.exit(0);
    });
  }

  async processChatInput(input) {
    const spinner = ora("🤔 Thinking...").start();

    try {
      const response = await this.aiProcessor.processCommand(input, {
        conversationHistory: this.conversationHistory,
        context: "ui-cloning-chat",
      });

      spinner.stop();

      // Add to conversation history
      this.conversationHistory.push(
        { role: "user", content: input },
        { role: "assistant", content: response.text }
      );

      console.log(chalk.green("🤖 AI:"), response.text);

      // Execute any commands if present
      if (response.commands && response.commands.length > 0) {
        for (const command of response.commands) {
          await this.executeCommand(command);
        }
      }
    } catch (error) {
      spinner.fail(chalk.red("❌ Error: " + error.message));
    }
  }

  async executeCommand(command) {
    const spinner = ora(`⚡ ${command.description}...`).start();

    try {
      switch (command.action) {
        case "clone_website":
          await this.cloneWebsite(command.url, command.options);
          break;
        case "open_file":
          // Implementation for opening files
          break;
        case "create_file":
          await fs.writeFile(command.path, command.content);
          break;
        default:
          console.log(chalk.yellow(`⚠️ Unknown command: ${command.action}`));
      }

      spinner.succeed(chalk.green(`✅ ${command.description}`));
    } catch (error) {
      spinner.fail(
        chalk.red(`❌ ${command.description} failed: ${error.message}`)
      );
    }
  }

  async getApiKey() {
    try {
      if (await fs.pathExists(this.configPath)) {
        const config = await fs.readJson(this.configPath);
        return config.apiKey;
      }
    } catch (error) {
      // Config file doesn't exist or is corrupted
    }
    return null;
  }

  async setupApiKey() {
    console.log(chalk.blue("\n🔑 API Key Setup"));
    console.log(
      chalk.gray("Get your Groq API key from: https://console.groq.com/keys")
    );

    const { apiKey } = await inquirer.prompt([
      {
        type: "password",
        name: "apiKey",
        message: "Enter your Groq API key:",
        mask: "*",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "API key is required";
          }
          return true;
        },
      },
    ]);

    try {
      await fs.writeJson(this.configPath, { apiKey: apiKey.trim() });
      console.log(chalk.green("✅ API key saved successfully!"));
    } catch (error) {
      console.log(chalk.red("❌ Failed to save API key:", error.message));
    }
  }

  showWelcome() {
    console.log(chalk.blue.bold("\n🎨 UI Clone CLI v1.0"));
    console.log(chalk.gray("═".repeat(50)));
    console.log(chalk.green("✨ Perfect UI cloning with AI assistance"));
    console.log(chalk.white("  • 🌐 Clone any website UI perfectly"));
    console.log(
      chalk.white(
        "  • 🎯 Supports: piyushgarg.dev, google.com, hitesh.ai, VS Code"
      )
    );
    console.log(chalk.white("  • 📱 Generate clean HTML/CSS/JS"));
    console.log(chalk.white("  • 🤖 AI-powered optimization"));
    console.log(chalk.white("  • 💬 Chat interface like Claude/Gemini"));
    console.log(chalk.gray("─".repeat(50)));
  }

  showChatHelp() {
    console.log(chalk.blue("\n💡 Chat Commands:"));
    console.log(chalk.white("  clone <url>     - Clone a website"));
    console.log(chalk.white("  help           - Show this help"));
    console.log(chalk.white("  exit           - Exit chat mode"));
    console.log(chalk.gray("\nOr just chat naturally with the AI!\n"));
  }
}
