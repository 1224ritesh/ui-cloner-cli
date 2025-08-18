# 🎨 UI Clone CLI

**AI-powered CLI to clone any websit## 💬 Chat Mode

```bash
node bin/cli.js chat
```

Chat with AI to clone websites:
```
🤖 > clone https://example.com
🎨 Analyzing and cloning...
✅ Saved to ./cloned-ui
```

## 🛠️ Commands

```bash
node bin/cli.js <url>                    # Clone website
node bin/cli.js --output <dir> <url>     # Custom output
node bin/cli.js --api-key <key> <url>    # Use specific API key
npm run setup                            # Configure API key
node bin/cli.js chat                     # Interactive mode
```n HTML/CSS/JS**

Transform any website into static code using Google Gemini AI.

## ✨ Features

- 🎯 **Perfect cloning** with AI analysis
- 🌐 **Clean HTML/CSS/JS** output only
- 📱 **Responsive design** preserved
- 🔧 **Auto asset download** (images, fonts)
- 💬 **Interactive chat** mode

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- [Gemini API key](https://makersuite.google.com/app/apikey)

### Installation
```bash
git clone https://github.com/1224ritesh/ui-cloner-cli.git
cd ui-cloner-cli
npm install
npm run setup  # Enter your Gemini API key
```

### Usage
```bash
# Clone any website
node bin/cli.js https://example.com

# Specify output folder  
node bin/cli.js https://google.com --output ./my-clone

# Interactive chat mode
node bin/cli.js chat

# Setup API key
npm run setup
```

## 📁 Output Structure

```
cloned-ui/
├── index.html       # Main HTML file
├── assets/
│   ├── css/        # Styles
│   ├── js/         # JavaScript
│   ├── images/     # Images
│   └── fonts/      # Fonts
├── serve.py        # Local server
└── serve.bat       # Windows server
```

## � Chat Mode

```bash
ui-clone chat
```

Chat with AI to clone websites:
```
🤖 > clone https://example.com
🎨 Analyzing and cloning...
✅ Saved to ./cloned-ui
```

## 🛠️ Commands

```bash
ui-clone <url>              # Clone website
ui-clone --output <dir>     # Custom output
ui-clone --api-key <key>    # Use specific API key
ui-clone setup              # Configure API key
ui-clone chat               # Interactive mode
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push: `git push origin feature-name`
5. Submit Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

**Transform websites into clean code with AI** ⚡