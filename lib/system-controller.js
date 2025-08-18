import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import axios from 'axios';

const execAsync = promisify(exec);

class SystemController {
    constructor() {
        this.platform = process.platform;
        this.runningProcesses = new Map();
    }

    async executeCommand(commandData) {
        const { action, params } = commandData;
        const spinner = ora(`⚡ ${params.description || 'Executing command'}...`).start();
        
        try {
            switch (action) {
                case 'exec':
                    await this.executeShellCommand(params.command);
                    break;
                    
                case 'create_file':
                    await this.createFile(params.path, params.content);
                    break;
                    
                case 'read_file':
                    await this.readFile(params.path);
                    break;
                    
                case 'create_directory':
                    await this.createDirectory(params.path);
                    break;
                    
                case 'open_vscode':
                    await this.openVSCode(params.path);
                    break;
                    
                case 'install_packages':
                    await this.installPackages(params.packages, params.manager);
                    break;
                    
                case 'git_command':
                    await this.executeGitCommand(params.command);
                    break;
                    
                case 'start_server':
                    await this.startServer(params.command, params.port);
                    break;
                    
                case 'web_search':
                    await this.webSearch(params.query);
                    break;
                    
                case 'download_file':
                    await this.downloadFile(params.url, params.path);
                    break;
                    
                case 'api_request':
                    await this.makeApiRequest(params.url, params.method, params.data);
                    break;
                    
                default:
                    throw new Error(`Unknown action: ${action}`);
            }
            
            spinner.succeed(chalk.green(`✅ ${params.description || 'Command executed successfully'}`));
            
        } catch (error) {
            spinner.fail(chalk.red(`❌ ${params.description || 'Command failed'}: ${error.message}`));
        }
    }

    async executeShellCommand(command) {
        const { stdout, stderr } = await execAsync(command, { 
            cwd: process.cwd(),
            maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        if (stdout) {
            console.log(chalk.gray('📤 Output:'));
            console.log(stdout);
        }
        
        if (stderr) {
            console.log(chalk.yellow('⚠️  Warnings:'));
            console.log(stderr);
        }
    }

    async createFile(filePath, content) {
        const fullPath = path.resolve(process.cwd(), filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf8');
        console.log(chalk.green(`📄 Created file: ${filePath}`));
    }

    async readFile(filePath) {
        const fullPath = path.resolve(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        console.log(chalk.blue(`📖 Content of ${filePath}:`));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(content);
        console.log(chalk.gray('─'.repeat(50)));
    }

    async createDirectory(dirPath) {
        const fullPath = path.resolve(process.cwd(), dirPath);
        await fs.ensureDir(fullPath);
        console.log(chalk.green(`📁 Created directory: ${dirPath}`));
    }

    async openVSCode(targetPath = '.') {
        const fullPath = path.resolve(process.cwd(), targetPath);
        
        // Try different VS Code commands based on platform
        const commands = this.getVSCodeCommands();
        
        for (const cmd of commands) {
            try {
                await execAsync(`${cmd} "${fullPath}"`);
                console.log(chalk.green(`🚀 Opened VS Code at: ${targetPath}`));
                return;
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('VS Code not found. Please install VS Code and ensure it\'s in your PATH.');
    }

    getVSCodeCommands() {
        switch (this.platform) {
            case 'win32':
                return ['code', 'code.cmd'];
            case 'darwin':
                return [
                    'code',
                    '/usr/local/bin/code',
                    '/Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin/code'
                ];
            default:
                return ['code', '/usr/local/bin/code', '/usr/bin/code'];
        }
    }

    async installPackages(packages, manager = 'npm') {
        const packageList = Array.isArray(packages) ? packages.join(' ') : packages;
        
        let command;
        switch (manager) {
            case 'yarn':
                command = `yarn add ${packageList}`;
                break;
            case 'pnpm':
                command = `pnpm add ${packageList}`;
                break;
            default: // npm
                command = `npm install ${packageList}`;
        }
        
        await this.executeShellCommand(command);
    }

    async executeGitCommand(gitCommand) {
        await this.executeShellCommand(`git ${gitCommand}`);
    }

    async startServer(command, port) {
        console.log(chalk.blue(`🌐 Starting server${port ? ` on port ${port}` : ''}...`));
        
        const serverProcess = spawn(command, [], {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true,
            env: { ...process.env, PORT: port }
        });
        
        const processId = `server_${Date.now()}`;
        this.runningProcesses.set(processId, serverProcess);
        
        console.log(chalk.green(`✅ Server started with PID: ${serverProcess.pid}`));
        console.log(chalk.yellow('💡 Press Ctrl+C to stop the server'));
        
        // Handle server process
        serverProcess.on('error', (error) => {
            console.log(chalk.red(`❌ Server error: ${error.message}`));
        });
        
        serverProcess.on('close', (code) => {
            console.log(chalk.yellow(`🛑 Server stopped with code: ${code}`));
            this.runningProcesses.delete(processId);
        });
    }

    async webSearch(query) {
        // Simple web search using DuckDuckGo Instant Answer API
        try {
            const response = await axios.get(`https://api.duckduckgo.com/`, {
                params: {
                    q: query,
                    format: 'json',
                    no_html: '1',
                    skip_disambig: '1'
                }
            });
            
            const data = response.data;
            
            if (data.Abstract) {
                console.log(chalk.blue('🔍 Search Result:'));
                console.log(chalk.white(data.Abstract));
                if (data.AbstractURL) {
                    console.log(chalk.gray(`Source: ${data.AbstractURL}`));
                }
            } else if (data.Answer) {
                console.log(chalk.blue('🔍 Answer:'));
                console.log(chalk.white(data.Answer));
            } else {
                console.log(chalk.yellow('🔍 No direct answer found. Try a more specific query.'));
            }
            
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                console.log(chalk.blue('\n📚 Related Topics:'));
                data.RelatedTopics.slice(0, 3).forEach(topic => {
                    if (topic.Text) {
                        console.log(chalk.gray(`• ${topic.Text.substring(0, 100)}...`));
                    }
                });
            }
            
        } catch (error) {
            console.log(chalk.red('❌ Web search failed:', error.message));
            console.log(chalk.yellow('💡 Try searching manually or check your internet connection.'));
        }
    }

    async downloadFile(url, filePath) {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });
            
            const fullPath = path.resolve(process.cwd(), filePath);
            await fs.ensureDir(path.dirname(fullPath));
            
            const writer = fs.createWriteStream(fullPath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(chalk.green(`📥 Downloaded: ${filePath}`));
                    resolve();
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    async makeApiRequest(url, method = 'GET', data = null) {
        try {
            const config = {
                method: method.toUpperCase(),
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'AI-Chat-CLI/1.0'
                }
            };
            
            if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
                config.data = data;
            }
            
            const response = await axios(config);
            
            console.log(chalk.blue(`🌐 API Response (${response.status}):`));
            console.log(JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            if (error.response) {
                console.log(chalk.red(`❌ API Error (${error.response.status}):`));
                console.log(JSON.stringify(error.response.data, null, 2));
            } else {
                throw new Error(`API request failed: ${error.message}`);
            }
        }
    }

    async getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cwd: process.cwd(),
            home: os.homedir(),
            env: {
                HOME: process.env.HOME || process.env.USERPROFILE,
                PATH: process.env.PATH
            }
        };
    }

    async createProject(projectName, template = 'basic') {
        const projectPath = path.join(process.cwd(), projectName);
        await fs.ensureDir(projectPath);
        
        switch (template) {
            case 'node':
                await this.createNodeProject(projectPath, projectName);
                break;
            case 'python':
                await this.createPythonProject(projectPath, projectName);
                break;
            case 'html':
                await this.createHTMLProject(projectPath, projectName);
                break;
            default:
                await this.createBasicProject(projectPath, projectName);
        }
        
        return projectPath;
    }

    async createNodeProject(projectPath, projectName) {
        const packageJson = {
            name: projectName,
            version: "1.0.0",
            description: `A Node.js project created with AI Chat CLI`,
            main: "index.js",
            type: "module",
            scripts: {
                start: "node index.js",
                dev: "node --watch index.js"
            },
            dependencies: {
                express: "^4.21.2"
            }
        };
        
        await fs.writeFile(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
        
        await fs.writeFile(
            path.join(projectPath, 'index.js'),
            `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to ${projectName}!',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
});`
        );
    }

    async createPythonProject(projectPath, projectName) {
        await fs.writeFile(
            path.join(projectPath, 'main.py'),
            `#!/usr/bin/env python3
"""
${projectName} - A Python project created with AI Chat CLI
"""

def main():
    print("Welcome to ${projectName}!")
    print("This is a Python project template.")

if __name__ == "__main__":
    main()`
        );
        
        await fs.writeFile(
            path.join(projectPath, 'requirements.txt'),
            `# Add your Python dependencies here
# Example:
# requests>=2.28.0
# flask>=2.2.0`
        );
    }

    async createHTMLProject(projectPath, projectName) {
        await fs.writeFile(
            path.join(projectPath, 'index.html'),
            `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <h1>${projectName}</h1>
    </header>
    
    <main>
        <section>
            <h2>Welcome</h2>
            <p>This is a HTML project created with AI Chat CLI.</p>
        </section>
    </main>
    
    <script src="script.js"></script>
</body>
</html>`
        );
        
        await fs.writeFile(
            path.join(projectPath, 'style.css'),
            `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    line-height: 1.6;
    color: #333;
}

header {
    background: #007bff;
    color: white;
    padding: 2rem 0;
    text-align: center;
}

main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
}

section {
    margin-bottom: 2rem;
}`
        );
        
        await fs.writeFile(
            path.join(projectPath, 'script.js'),
            `document.addEventListener('DOMContentLoaded', function() {
    console.log('${projectName} loaded successfully!');
});`
        );
    }

    async createBasicProject(projectPath, projectName) {
        await fs.writeFile(
            path.join(projectPath, 'README.md'),
            `# ${projectName}

A project created with AI Chat CLI.

## Getting Started

Add your project description and instructions here.`
        );
    }
}

export default SystemController;