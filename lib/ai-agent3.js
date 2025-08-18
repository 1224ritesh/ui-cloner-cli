import Groq from "groq-sdk";

export class AIAgent3 {
  constructor(apiKey) {
    this.groq = new Groq({ apiKey: apiKey });
    // Switch to GPT-OSS as primary due to DeepSeek rate limits
    this.primaryModel = "openai/gpt-oss-120b";
    this.fallbackModel = "deepseek-r1-distill-llama-70b";
    this.currentModel = this.primaryModel;
  }

  async processHTML(html, url, options = {}) {
    // Extract key content from the original HTML first
    const extractedContent = this.extractKeyContent(html, url);
    const visualElements = this.analyzeVisualElements(html);

    // Special handling for specific websites to create accurate replicas
    if (extractedContent.url.includes("google.com")) {
      const prompt = `Create a Google homepage replica with HTML and CSS.

Include these elements:
- Google logo at the top center
- Search input box in the center
- "Google Search" and "I'm Feeling Lucky" buttons below search box
- Clean, minimal white background
- Responsive design
- Simple footer with links

Generate a complete HTML document with embedded CSS that looks like the Google homepage.`;

      return await this.executePrompt(prompt);
    }

    if (extractedContent.url.includes("github.com")) {
      const prompt = `Create a GitHub homepage replica with HTML and CSS.

Include these elements:
- Dark header with GitHub logo and navigation
- Hero section with "Where the world builds software" headline
- Sign up form with email input
- Feature sections with developer tools
- Dark theme with purple/blue accents
- Modern grid layouts

Generate a complete HTML document with embedded CSS that looks like the GitHub homepage.`;

      return await this.executePrompt(prompt);
    }

    if (extractedContent.url.includes("code.visualstudio.com")) {
      const prompt = `Create a VS Code homepage replica with HTML and CSS.

Include these elements:
- Blue header with VS Code logo and navigation
- Hero section with "Code editing. Redefined." headline
- Download buttons for different platforms
- Feature highlights with code editor screenshots
- Extensions and marketplace sections
- Modern developer-focused design

Generate a complete HTML document with embedded CSS that looks like the VS Code homepage.`;

      return await this.executePrompt(prompt);
    }

    // General website cloning approach
    const prompt = `Create a webpage based on this website analysis:

Website: ${extractedContent.title}
URL: ${extractedContent.url}

Content Structure:
${this.formatExtractedContent(extractedContent)}

Design Elements:
${this.formatVisualElements(visualElements)}

Create a modern, responsive webpage with the extracted content and design elements.
Include proper navigation, hero section, and footer.
Use clean HTML5 structure with embedded CSS.

Generate the complete HTML document:`;

    return await this.executePrompt(prompt);
  }

  async executePrompt(prompt) {
    try {
      console.log(`🔄 Making API call to ${this.currentModel}...`);

      const result = await this.makeAPICall(prompt);
      return result;
    } catch (error) {
      console.error(`❌ ${this.currentModel} failed:`, error.message);

      // Try fallback model if primary fails
      if (this.currentModel === this.primaryModel) {
        console.log("🔄 Trying fallback model...");
        this.currentModel = this.fallbackModel;
        try {
          const result = await this.makeAPICall(prompt);
          return result;
        } catch (fallbackError) {
          console.error(
            `❌ Fallback ${this.fallbackModel} failed:`,
            fallbackError.message
          );
          throw new Error(
            `Both models failed: ${error.message}, ${fallbackError.message}`
          );
        }
      } else {
        throw new Error(`AI Agent HTML processing failed: ${error.message}`);
      }
    }
  }

  async executePrompt(prompt) {
    try {
      console.log(`🔄 Making API call to ${this.currentModel}...`);
      const result = await this.makeAPICall(prompt);
      return result;
    } catch (error) {
      console.error(`❌ ${this.currentModel} failed:`, error.message);

      // Try fallback model if primary fails
      if (this.currentModel === this.primaryModel) {
        console.log("🔄 Trying fallback model...");
        this.currentModel = this.fallbackModel;
        try {
          const result = await this.makeAPICall(prompt);
          return result;
        } catch (fallbackError) {
          console.error(
            `❌ Fallback ${this.fallbackModel} failed:`,
            fallbackError.message
          );
          throw new Error(
            `Both models failed: ${error.message}, ${fallbackError.message}`
          );
        }
      } else {
        throw new Error(`AI Agent HTML processing failed: ${error.message}`);
      }
    }
  }

  async makeAPICall(prompt) {
    const modelSettings = {
      "openai/gpt-oss-120b": {
        temperature: 0.3, // Balanced for creativity and consistency
        max_tokens: 65536, // Maximum available for comprehensive output
        top_p: 0.9,
      },
      "deepseek-r1-distill-llama-70b": {
        temperature: 0.2, // Lower temperature for more consistent output
        max_tokens: 65536, // Conservative to avoid rate limits
        top_p: 0.9,
      },
    };

    const settings = modelSettings[this.currentModel] || {
      temperature: 0.1,
      max_tokens: 65536, // Default based on GPT-OSS limit
    };

    const completion = await this.groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a professional web developer creating HTML pages based on design specifications. Generate complete, functional HTML documents with embedded CSS that match the provided design requirements. Always respond with valid HTML code. Focus on creating clean, modern, responsive web pages.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: this.currentModel,
      ...settings,
    });

    let htmlContent = completion.choices[0].message.content.trim();
    console.log(
      `✅ Received ${this.currentModel} response, length:`,
      htmlContent.length
    );

    // Clean up reasoning tokens and markdown formatting
    htmlContent = htmlContent.replace(/<think>[\s\S]*?<\/think>/g, "");
    htmlContent = htmlContent.replace(/```html\s*/g, "");
    htmlContent = htmlContent.replace(/```\s*$/g, "");
    htmlContent = htmlContent.replace(/^html\s*/g, "");
    htmlContent = htmlContent.replace(/^```\s*/g, "");
    htmlContent = htmlContent.replace(/```\s*$/g, "");

    // Remove AI explanations and comments at the end
    htmlContent = htmlContent.replace(/\n\s*This clone includes:[\s\S]*$/, "");
    htmlContent = htmlContent.replace(/\n\s*The design[\s\S]*$/, "");
    htmlContent = htmlContent.replace(/\n\s*Here's a[\s\S]*$/, "");
    htmlContent = htmlContent.replace(/\n\s*\*\*[\s\S]*$/, "");

    // Remove any trailing explanatory text after </html>
    const htmlEndIndex = htmlContent.lastIndexOf("</html>");
    if (htmlEndIndex !== -1) {
      htmlContent = htmlContent.substring(0, htmlEndIndex + 7);
    }

    // Ensure it starts with DOCTYPE if not present
    if (!htmlContent.toLowerCase().startsWith("<!doctype")) {
      htmlContent = "<!DOCTYPE html>\n" + htmlContent;
    }

    console.log("🎯 Final HTML length:", htmlContent.length);
    return htmlContent;
  }

  formatExtractedContent(content) {
    const formatArray = (arr, label) =>
      arr.length > 0
        ? `${label}: ${arr
            .slice(0, 3)
            .map((item) => item.replace(/<[^>]*>/g, "").trim())
            .filter((item) => item && item.length < 50)
            .join(" | ")}`
        : "";

    return [
      `URL: ${content.url}`,
      `Title: ${content.title}`,
      formatArray(content.headings, "Headings"),
      formatArray(content.navigation, "Navigation"),
      formatArray(content.buttons, "Buttons"),
      formatArray(content.links.slice(0, 5), "Links"),
    ]
      .filter((line) => line && !line.includes("undefined"))
      .join("\n");
  }

  formatVisualElements(elements) {
    return [
      elements.layout.flex || elements.layout.grid
        ? `Layout: ${elements.layout.flex ? "Flexbox" : ""} ${
            elements.layout.grid ? "Grid" : ""
          }`
        : "",
      elements.colors.length > 0
        ? `Colors: ${elements.colors.slice(0, 3).join(" | ")}`
        : "",
      elements.typography.length > 0
        ? `Typography: ${elements.typography.slice(0, 2).join(" | ")}`
        : "",
      elements.responsive.mobile || elements.responsive.tablet
        ? "Responsive: Mobile/Tablet optimized"
        : "",
    ]
      .filter((line) => line)
      .join("\n");
  }

  extractKeyContent(html, url) {
    // Extract key information from the HTML
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Website";

    const descMatch = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
    );
    const description = descMatch ? descMatch[1] : "";

    // Extract all heading levels
    const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const h3Matches = html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
    const h4Matches = html.match(/<h4[^>]*>(.*?)<\/h4>/gi) || [];

    // Extract navigation and menu items with more detail
    const navMatches = html.match(/<nav[^>]*>(.*?)<\/nav>/gis) || [];
    const menuMatches =
      html.match(/<ul[^>]*class="[^"]*menu[^"]*"[^>]*>(.*?)<\/ul>/gis) || [];
    const headerMatches = html.match(/<header[^>]*>(.*?)<\/header>/gis) || [];

    // Extract buttons and CTAs with more context
    const buttonMatches = html.match(/<button[^>]*>(.*?)<\/button>/gi) || [];
    const ctaMatches =
      html.match(/<a[^>]*class="[^"]*btn[^"]*"[^>]*>(.*?)<\/a>/gi) || [];
    const submitMatches = html.match(/<input[^>]*type="submit"[^>]*>/gi) || [];

    // Extract links with href attributes
    const linkMatches =
      html.match(/<a[^>]*href="[^"]*"[^>]*>(.*?)<\/a>/gi) || [];

    // Extract form elements with more detail
    const formMatches = html.match(/<form[^>]*>(.*?)<\/form>/gis) || [];
    const inputMatches = html.match(/<input[^>]*>/gi) || [];
    const textareaMatches =
      html.match(/<textarea[^>]*>(.*?)<\/textarea>/gi) || [];
    const selectMatches = html.match(/<select[^>]*>(.*?)<\/select>/gis) || [];

    // Extract main content areas with more specificity
    const paragraphMatches = html.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
    const sectionMatches =
      html.match(/<section[^>]*>(.*?)<\/section>/gis) || [];
    const articleMatches =
      html.match(/<article[^>]*>(.*?)<\/article>/gis) || [];
    const mainMatches = html.match(/<main[^>]*>(.*?)<\/main>/gis) || [];

    // Extract brand/logo information with more detail
    const logoMatches =
      html.match(/<img[^>]*alt="[^"]*logo[^"]*"[^>]*>/gi) || [];
    const brandMatches =
      html.match(/<[^>]*class="[^"]*brand[^"]*"[^>]*>(.*?)<\/[^>]*>/gi) || [];
    const titleMatches =
      html.match(/<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/gi) || [];

    // Extract images for layout reference
    const imageMatches = html.match(/<img[^>]*src="[^"]*"[^>]*>/gi) || [];

    // Extract footer information
    const footerMatches = html.match(/<footer[^>]*>(.*?)<\/footer>/gis) || [];

    return {
      title,
      description,
      headings: [...h1Matches, ...h2Matches, ...h3Matches, ...h4Matches].slice(
        0,
        15
      ),
      navigation: [...navMatches, ...menuMatches, ...headerMatches].slice(0, 5),
      buttons: [...buttonMatches, ...ctaMatches, ...submitMatches].slice(0, 10),
      links: linkMatches.slice(0, 25),
      forms: [
        ...formMatches,
        ...inputMatches,
        ...textareaMatches,
        ...selectMatches,
      ].slice(0, 8),
      inputs: inputMatches.slice(0, 8),
      paragraphs: paragraphMatches.slice(0, 12),
      sections: [...sectionMatches, ...articleMatches, ...mainMatches].slice(
        0,
        8
      ),
      branding: [...logoMatches, ...brandMatches, ...titleMatches].slice(0, 5),
      images: imageMatches.slice(0, 10),
      footer: footerMatches.slice(0, 2),
      url,
    };
  }

  analyzeVisualElements(html) {
    // Extract color information with more detail
    const colorMatches = html.match(/color:\s*([^;]+)/gi) || [];
    const backgroundMatches =
      html.match(/background(-color)?:\s*([^;]+)/gi) || [];
    const borderMatches = html.match(/border(-color)?:\s*([^;]+)/gi) || [];

    // Extract layout patterns with more specificity
    const flexMatches = html.match(/display:\s*flex/gi) || [];
    const gridMatches = html.match(/display:\s*grid/gi) || [];
    const containerMatches = html.match(/class="[^"]*container[^"]*"/gi) || [];
    const wrapperMatches = html.match(/class="[^"]*wrapper[^"]*"/gi) || [];

    // Extract spacing patterns with more detail
    const marginMatches = html.match(/margin[^:]*:\s*([^;]+)/gi) || [];
    const paddingMatches = html.match(/padding[^:]*:\s*([^;]+)/gi) || [];
    const gapMatches = html.match(/gap:\s*([^;]+)/gi) || [];

    // Extract typography with more specificity
    const fontMatches = html.match(/font-family:\s*([^;]+)/gi) || [];
    const fontSizeMatches = html.match(/font-size:\s*([^;]+)/gi) || [];
    const fontWeightMatches = html.match(/font-weight:\s*([^;]+)/gi) || [];
    const lineHeightMatches = html.match(/line-height:\s*([^;]+)/gi) || [];

    // Extract common UI components with more variety
    const cardMatches = html.match(/class="[^"]*card[^"]*"/gi) || [];
    const modalMatches = html.match(/class="[^"]*modal[^"]*"/gi) || [];
    const alertMatches = html.match(/class="[^"]*alert[^"]*"/gi) || [];
    const badgeMatches = html.match(/class="[^"]*badge[^"]*"/gi) || [];
    const navbarMatches = html.match(/class="[^"]*navbar[^"]*"/gi) || [];
    const sidebarMatches = html.match(/class="[^"]*sidebar[^"]*"/gi) || [];

    // Extract responsive patterns with more detail
    const mobileMatches =
      html.match(/@media[^{]*mobile|@media[^{]*max-width[^{]*768px/gi) || [];
    const tabletMatches =
      html.match(/@media[^{]*tablet|@media[^{]*max-width[^{]*1024px/gi) || [];
    const desktopMatches =
      html.match(/@media[^{]*desktop|@media[^{]*min-width[^{]*1200px/gi) || [];

    // Extract animations and transitions
    const transitionMatches = html.match(/transition[^:]*:\s*([^;]+)/gi) || [];
    const animationMatches = html.match(/animation[^:]*:\s*([^;]+)/gi) || [];
    const transformMatches = html.match(/transform:\s*([^;]+)/gi) || [];

    // Extract positioning patterns
    const positionMatches = html.match(/position:\s*([^;]+)/gi) || [];
    const zIndexMatches = html.match(/z-index:\s*([^;]+)/gi) || [];

    return {
      colors: [...colorMatches, ...backgroundMatches, ...borderMatches].slice(
        0,
        15
      ),
      layout: {
        flex: flexMatches.length > 0,
        grid: gridMatches.length > 0,
        containers: [...containerMatches, ...wrapperMatches].slice(0, 8),
      },
      spacing: [...marginMatches, ...paddingMatches, ...gapMatches].slice(
        0,
        12
      ),
      typography: [
        ...fontMatches,
        ...fontSizeMatches,
        ...fontWeightMatches,
        ...lineHeightMatches,
      ].slice(0, 12),
      components: [
        ...cardMatches,
        ...modalMatches,
        ...alertMatches,
        ...badgeMatches,
        ...navbarMatches,
        ...sidebarMatches,
      ].slice(0, 12),
      responsive: {
        mobile: mobileMatches.length > 0,
        tablet: tabletMatches.length > 0,
        desktop: desktopMatches.length > 0,
      },
      animations: [
        ...transitionMatches,
        ...animationMatches,
        ...transformMatches,
      ].slice(0, 8),
      positioning: [...positionMatches, ...zIndexMatches].slice(0, 8),
    };
  }

  async processCommand(input, options = {}) {
    const { conversationHistory = [], context = "general" } = options;
    const systemPrompt = this.getSystemPrompt(context);

    try {
      const completion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationHistory.map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          })),
          {
            role: "user",
            content: input,
          },
        ],
        model: this.currentModel,
        temperature: 0.3,
        max_tokens: 4096,
      });

      const response = completion.choices[0].message.content;
      return this.parseResponse(response);
    } catch (error) {
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  getSystemPrompt(context) {
    const basePrompt = `You are an expert UI/UX developer and website cloning specialist powered by Groq with DeepSeek-R1 and GPT-OSS models. You help users clone website UIs perfectly and provide development assistance.

CAPABILITIES:
1. 🎨 UI CLONING: Analyze and replicate website designs with pixel-perfect accuracy
2. 💻 CODE GENERATION: Create clean, production-ready HTML, CSS, and JavaScript
3. 🔧 DEVELOPMENT: Help with coding, debugging, optimization, and best practices
4. 🌐 WEB TECHNOLOGIES: Expert in modern web development frameworks and tools
5. 🚀 AI-POWERED: Leveraging Groq's fast inference with DeepSeek-R1 and GPT-OSS for superior results

SUPPORTED WEBSITES (clone these perfectly):
- code.visualstudio.com (VS Code landing page with modern developer interface)
- google.com (Clean, minimalist search interface)
- github.com (Professional developer platform with dark themes)
- Any modern website with responsive design

RESPONSE FORMAT:
Provide helpful responses and include commands when needed:
<COMMAND>
{
  "action": "clone_website|create_file|open_file",
  "description": "What this command does",
  "url": "website_url",
  "path": "file_path",
  "content": "file_content",
  "options": {}
}
</COMMAND>

Be conversational, helpful, and focus on UI cloning and web development excellence.`;

    if (context === "ui-cloning-chat") {
      return (
        basePrompt +
        `

CURRENT CONTEXT: UI Cloning Chat Mode
- User can ask to clone websites by saying "clone <url>"
- Provide guidance on UI cloning, web development best practices
- Suggest improvements and optimizations
- Help with code generation and debugging
- Focus on creating production-ready, visually perfect clones`
      );
    }

    return basePrompt;
  }

  parseResponse(responseText) {
    // Extract commands from response
    const commandRegex = /<COMMAND>([\s\S]*?)<\/COMMAND>/g;
    const commands = [];
    let match;

    while ((match = commandRegex.exec(responseText)) !== null) {
      try {
        const command = JSON.parse(match[1]);
        commands.push(command);
      } catch (error) {
        console.warn("Failed to parse command:", error.message);
      }
    }

    // Remove command blocks from text
    const text = responseText.replace(commandRegex, "").trim();

    return {
      text,
      commands,
    };
  }
}
