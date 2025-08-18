# 🎨 UI Clone CLI

**AI-powered CLI to clone any website into clean, offline-ready HTML/CSS/JS**

Transform any website into optimized static code using advanced AI models (Groq API with GPT-OSS & DeepSeek).

## 🎥 Demo Video

[![UI Clone CLI Demo](https://img.shields.io/badge/▶️_Watch_Demo-YouTube-red?style=for-the-badge&logo=youtube)](https://youtu.be/1GWI_gsuErc)

*See the UI Clone CLI in action*

## ✨ Features

- 🎯 **Perfect cloning** with AI analysis and optimization
- 🌐 **Clean, consolidated assets** - single CSS & JS files
- 📱 **Responsive design** fully preserved
- 🔧 **Smart asset consolidation** (109+ assets → organized structure)
- 💻 **Offline-ready** - works without internet after cloning
- 🤖 **Dual AI models** - GPT-OSS-120B + DeepSeek-R1 fallback
- 💬 **Interactive chat** mode for guided cloning

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- [Groq API key](https://console.groq.com/) (Free tier available)

### Installation
```bash
git clone https://github.com/1224ritesh/ui-cloner-cli.git
cd ui-cloner-cli
npm install
npm run setup  # Enter your Groq API key
```

### Usage
```bash
# Clone any website
node bin/cli.js https://example.com

# Clone with custom output folder  
node bin/cli.js https://tailwindcss.com --output ./my-clone

# Interactive chat mode
node bin/cli.js chat

# Setup API key
npm run setup
```

## 📁 Enhanced Output Structure

```
cloned-ui/
├── index.html              # Optimized main HTML file
├── style.css               # ALL CSS consolidated (647KB+)
├── script.js               # ALL JavaScript consolidated (922KB+)
├── serve.py                # Python local server (auto-opens browser)
├── serve.bat               # Windows batch server
└── [images/]               # Optimized image assets
    ├── image_*.png         # Downloaded images
    ├── favicons.png        # Site favicons
    └── photo-*.png         # Responsive images
```

### Key Improvements:
- ✅ **Asset Consolidation**: All CSS/JS combined into single files
- ✅ **Offline-Ready**: Works completely without internet
- ✅ **Optimized**: Removes tracking scripts, optimizes for performance
- ✅ **Clean Structure**: Simple, organized file layout
- ✅ **Ready to Serve**: Built-in server scripts included

## 🤖 AI Models Used

- **Primary**: `openai/gpt-oss-120b` (65,536 tokens)
- **Fallback**: `deepseek-r1-distill-llama-70b` (131,072 tokens)
- **Provider**: Groq API (fast inference, free tier available)

## 💬 Chat Mode

```bash
node bin/cli.js chat
```

Interactive AI-powered cloning:
```
🤖 UI Clone Assistant
🎨 > clone https://tailwindcss.com
✅ Cloned successfully to ./cloned-ui

🎨 > serve
🌐 Starting server at http://localhost:8000
```

## 🛠️ Commands

```bash
# Basic cloning
node bin/cli.js <url>                           # Clone website
node bin/cli.js <url> --output <dir>            # Custom output directory

# Configuration
npm run setup                                   # Configure Groq API key
node bin/cli.js --api-key <key> <url>          # Use specific API key

# Interactive modes
node bin/cli.js chat                            # Interactive chat mode
python serve.py                                 # Serve cloned site (from output dir)
```

## 🎯 Example Results

### TailwindCSS Clone
```bash
node bin/cli.js https://tailwindcss.com
```

### Example.com Clone  
```bash
node bin/cli.js https://example.com
```
**Result**: Clean, minimal site with consolidated assets → Perfect offline replica

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

**Transform any website into clean, offline-ready code with AI** ⚡

*Powered by Groq API • GPT-OSS-120B • DeepSeek-R1*