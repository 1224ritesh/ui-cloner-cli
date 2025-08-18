import { GoogleGenerativeAI } from "@google/generative-ai";

export class AIAgent {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.05, // Very low temperature for consistent, high-quality output
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
    });
  }

  async processHTML(html, url, options = {}) {
    // Extract key content from the original HTML first
    const extractedContent = this.extractKeyContent(html, url);

    const prompt = `You must create ONLY valid HTML code. No explanations, no markdown, no comments outside the HTML.

Create a complete HTML website that replicates ${url}.

Based on this content:
- Title: ${extractedContent.title}
- Description: ${extractedContent.description}
- Main headings: ${extractedContent.headings.slice(0, 3).join(", ")}

Sample structure:
${html.substring(0, 5000)}

Return ONLY the HTML code starting with <!DOCTYPE html> and ending with </html>. Include all CSS inside <style> tags. No other text.`;

    try {
      console.log("🔄 Making API call to Gemini 2.5 Flash...");
      const result = await this.model.generateContent(prompt);
      let htmlContent = result.response.text().trim();

      console.log("✅ Received AI response, length:", htmlContent.length);

      // Clean up any markdown formatting that might be included
      htmlContent = htmlContent.replace(/```html\s*/g, "");
      htmlContent = htmlContent.replace(/```\s*$/g, "");
      htmlContent = htmlContent.replace(/^html\s*/g, "");

      // Ensure it starts with DOCTYPE if not present
      if (!htmlContent.toLowerCase().startsWith("<!doctype")) {
        htmlContent = "<!DOCTYPE html>\n" + htmlContent;
      }

      console.log("🎯 Final HTML length:", htmlContent.length);
      return htmlContent;
    } catch (error) {
      console.error("❌ AI Agent error:", error.message);
      throw new Error(`AI Agent HTML processing failed: ${error.message}`);
    }
  }

  extractKeyContent(html, url) {
    // Extract key information from the HTML
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : "Website";

    const descMatch = html.match(
      /<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i
    );
    const description = descMatch ? descMatch[1] : "";

    // Extract main headings and content
    const h1Matches = html.match(/<h1[^>]*>(.*?)<\/h1>/gi) || [];
    const h2Matches = html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const h3Matches = html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];

    // Extract navigation links
    const navMatches = html.match(/<nav[^>]*>(.*?)<\/nav>/gis) || [];

    // Extract button text
    const buttonMatches = html.match(/<button[^>]*>(.*?)<\/button>/gi) || [];

    // Extract link text
    const linkMatches = html.match(/<a[^>]*>(.*?)<\/a>/gi) || [];

    // Extract paragraph content (first few)
    const paragraphMatches = html.match(/<p[^>]*>(.*?)<\/p>/gi) || [];

    return {
      title,
      description,
      headings: [...h1Matches, ...h2Matches, ...h3Matches].slice(0, 8),
      navigation: navMatches.slice(0, 2),
      buttons: buttonMatches.slice(0, 5),
      links: linkMatches.slice(0, 10),
      paragraphs: paragraphMatches.slice(0, 5),
      url,
    };
  }

  async processCommand(input, options = {}) {
    const { conversationHistory = [], context = "general" } = options;
    const systemPrompt = this.getSystemPrompt(context);

    try {
      const response = await this.callGeminiAPI(
        systemPrompt,
        input,
        conversationHistory
      );
      return this.parseResponse(response);
    } catch (error) {
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  async callGeminiAPI(systemPrompt, userInput, history) {
    const messages = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: [{ text: userInput }] },
    ];

    const result = await this.model.generateContent({
      contents: messages,
    });

    return result.response.text();
  }

  getSystemPrompt(context) {
    const basePrompt = `You are an expert UI/UX developer and website cloning specialist powered by Gemini 2.5 Flash. You help users clone website UIs perfectly and provide development assistance.

CAPABILITIES:
1. 🎨 UI CLONING: Analyze and replicate website designs with pixel-perfect accuracy
2. 💻 CODE GENERATION: Create clean, production-ready HTML, CSS, and JavaScript
3. 🔧 DEVELOPMENT: Help with coding, debugging, optimization, and best practices
4. 🌐 WEB TECHNOLOGIES: Expert in modern web development frameworks and tools
5. 🤖 AI-POWERED: Leveraging advanced AI for superior code generation and analysis

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
