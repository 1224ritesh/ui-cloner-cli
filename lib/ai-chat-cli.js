import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import SystemController from './system-controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AIChatCLI {
    constructor() {
        this.configPath = path.join(os.homedir(), '.ai-chat-cli-config.json');
        this.conversationHistory = [];
        this.systemController = new SystemController();
        this.rl = null;
        this.model = null;
    }

    async start() {
        console.clear();
        this.showWelcome();
        
        // Check for API key
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            console.log(chalk.red('❌ No API key found. Please set up your Gemini API key first.'));
            await this.setupApiKey();
            return;
        }

        // Initialize AI model
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                generationConfig: {
                    temperature: 0.3,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 8192,
                }
            });
        } catch (error) {
            console.log(chalk.red('❌ Failed to initialize AI model. Please check your API key.'));
            await this.setupApiKey();
            return;
        }

        // Start interactive session
        this.startInteractiveSession();
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
        console.log(chalk.blue('\n🔑 API Key Setup'));
        console.log(chalk.gray('Get your free Gemini API key from: https://makersuite.google.com/app/apikey'));
        
        const { apiKey } = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your Gemini API key:',
                mask: '*',
                validate: (input) => {
                    if (!input || input.trim().length === 0) {
                        return 'API key is required';
                    }
                    return true;
                }
            }
        ]);

        // Save API key
        try {
            await fs.writeJson(this.configPath, { apiKey: apiKey.trim() });
            console.log(chalk.green('✅ API key saved successfully!'));
            console.log(chalk.blue('💡 You can now start chatting with: ai-chat'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to save API key:', error.message));
        }
    }

    startInteractiveSession() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue('🤖 AI > ')
        });

        this.setupEventHandlers();
        console.log(chalk.green('\n✨ AI Assistant is ready! Type your message or "help" for commands.'));
        this.rl.prompt();
    }

    setupEventHandlers() {
        this.rl.on('line', async (input) => {
            const trimmedInput = input.trim();
            
            if (trimmedInput === '') {
                this.rl.prompt();
                return;
            }
            
            if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
                console.log(chalk.yellow('👋 Goodbye! Thanks for using AI Chat CLI.'));
                process.exit(0);
            }
            
            if (trimmedInput.toLowerCase() === 'clear') {
                console.clear();
                this.showWelcome();
                this.rl.prompt();
                return;
            }
            
            if (trimmedInput.toLowerCase() === 'help') {
                this.showHelp();
                this.rl.prompt();
                return;
            }

            if (trimmedInput.toLowerCase() === 'setup') {
                await this.setupApiKey();
                this.rl.prompt();
                return;
            }
            
            await this.processUserInput(trimmedInput);
            this.rl.prompt();
        });

        this.rl.on('close', () => {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            process.exit(0);
        });

        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n👋 Goodbye!'));
            process.exit(0);
        });
    }

    async processUserInput(input) {
        const spinner = ora('🤔 Thinking...').start();
        
        try {
            // Add user input to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: input
            });
            
            // Get AI response
            const response = await this.getAIResponse(input);
            
            spinner.stop();
            
            // Parse and execute system commands
            await this.executeSystemCommands(response);
            
            // Add AI response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.text || response
            });
            
        } catch (error) {
            spinner.fail(chalk.red('❌ Error: ' + error.message));
        }
    }

    async getAIResponse(userInput) {
        const systemInfo = await this.systemController.getSystemInfo();
        
        const systemPrompt = `You are an advanced AI assistant with system interaction capabilities. You can help users with:

SYSTEM CAPABILITIES:
1. FILE OPERATIONS: Create, read, write, delete files and directories
2. CODE GENERATION: Write code in any programming language  
3. VS CODE INTEGRATION: Open VS Code, create projects, manage workspaces
4. SYSTEM COMMANDS: Execute shell commands, manage processes
5. PROJECT MANAGEMENT: Create full projects, install dependencies, run builds
6. GIT OPERATIONS: Initialize repos, commit changes, manage branches
7. DEVELOPMENT TOOLS: Run servers, build tools, package managers
8. INTERNET ACCESS: Search web, download files, API calls

CURRENT CONTEXT:
- Working Directory: ${systemInfo.cwd}
- Platform: ${systemInfo.platform}
- Node Version: ${systemInfo.nodeVersion}
- Home Directory: ${systemInfo.home}

CONVERSATION HISTORY:
${this.conversationHistory.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

USER REQUEST: ${userInput}

RESPONSE FORMAT:
Provide a helpful response and include system commands in this format when needed:
<SYSTEM_COMMAND>
{
  "action": "command_type",
  "params": {
    "command": "actual_command",
    "path": "file_path", 
    "content": "file_content",
    "description": "what_this_does"
  }
}
</SYSTEM_COMMAND>

Available actions:
- "exec": Execute shell command
- "create_file": Create a file with content
- "read_file": Read file content
- "create_directory": Create directory
- "open_vscode": Open VS Code
- "install_packages": Install npm/yarn packages
- "git_command": Execute git commands
- "start_server": Start development server
- "web_search": Search the internet
- "download_file": Download file from URL
- "api_request": Make HTTP API request

Be conversational, helpful, and provide clear explanations of what you're doing.`;

        const result = await this.model.generateContent(systemPrompt);
        return result.response.text();
    }

    async executeSystemCommands(response) {
        // Extract system commands from response
        const commandRegex = /<SYSTEM_COMMAND>([\s\S]*?)<\/SYSTEM_COMMAND>/g;
        let match;
        
        // Display the text response first
        const textResponse = response.replace(commandRegex, '').trim();
        if (textResponse) {
            console.log(chalk.green('🤖 AI Assistant:'));
            console.log(textResponse);
            console.log();
        }
        
        // Execute system commands
        while ((match = commandRegex.exec(response)) !== null) {
            try {
                const commandData = JSON.parse(match[1]);
                await this.systemController.executeCommand(commandData);
            } catch (error) {
                console.log(chalk.red('❌ Failed to execute command:', error.message));
            }
        }
    }

    async quickAsk(question) {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            console.log(chalk.red('❌ No API key found. Run "ai-chat setup" first.'));
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                generationConfig: {
                    temperature: 0.3,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 8192,
                }
            });

            await this.processUserInput(question);
        } catch (error) {
            console.log(chalk.red('❌ Error:', error.message));
        }
    }

    showWelcome() {
        console.log(chalk.blue.bold('\n🤖 AI Chat CLI v1.0'));
        console.log(chalk.gray('═'.repeat(50)));
        console.log(chalk.green('✨ I can help you with:'));
        console.log(chalk.white('  • 💬 Natural conversation and Q&A'));
        console.log(chalk.white('  • 📝 Write and manage code files'));
        console.log(chalk.white('  • 🚀 Open VS Code and create projects'));
        console.log(chalk.white('  • 📁 File system operations'));
        console.log(chalk.white('  • 🔧 Run shell commands and tools'));
        console.log(chalk.white('  • 📦 Install packages and dependencies'));
        console.log(chalk.white('  • 🌐 Start development servers'));
        console.log(chalk.white('  • 🔀 Git operations and version control'));
        console.log(chalk.white('  • 🌍 Search the internet and download files'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.yellow('💡 Commands: help | clear | setup | exit'));
        console.log(chalk.blue('💬 Just tell me what you want to do!'));
    }

    showHelp() {
        console.log(chalk.blue.bold('\n🆘 AI Chat CLI Help'));
        console.log(chalk.gray('═'.repeat(50)));
        console.log(chalk.green('📋 Available Commands:'));
        console.log(chalk.white('  help     - Show this help message'));
        console.log(chalk.white('  clear    - Clear the screen'));
        console.log(chalk.white('  setup    - Setup or change API key'));
        console.log(chalk.white('  exit     - Exit the CLI'));
        console.log();
        console.log(chalk.green('💬 Example Requests:'));
        console.log(chalk.white('  "Create a React project"'));
        console.log(chalk.white('  "Open VS Code in current directory"'));
        console.log(chalk.white('  "Write a Python script to sort files"'));
        console.log(chalk.white('  "Install express and nodemon"'));
        console.log(chalk.white('  "Search for Node.js best practices"'));
        console.log(chalk.white('  "Initialize a git repository"'));
        console.log(chalk.white('  "Start a development server"'));
        console.log(chalk.white('  "Download a file from GitHub"'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.blue('🤖 I understand natural language - just ask!\n'));
    }
}

export default AIChatCLI;