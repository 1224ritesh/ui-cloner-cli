import puppeteer from "puppeteer";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { load } from "cheerio";
import { lookup, extension } from "mime-types";
import chalk from "chalk";
import ora from "ora";

export class WebsiteCloner {
  constructor() {
    this.downloadedAssets = new Set();
    this.assetMap = new Map();
  }

  async clone(url, options = {}) {
    const {
      outputDir = "./cloned-ui",
      outputType = "html",
      aiProcessor,
    } = options;

    console.log(chalk.blue(`🎯 Cloning: ${url}`));
    console.log(chalk.blue(`📁 Output: ${outputDir}`));
    console.log(chalk.blue(`🎨 Type: ${outputType}`));

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Navigate to the website
      console.log(chalk.gray("🌐 Loading website..."));
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Get page content and metadata
      const [html, pageInfo] = await Promise.all([
        page.content(),
        this.extractPageInfo(page, url),
      ]);

      console.log(chalk.gray("📊 Analyzing page structure..."));

      // Process with AI for better cleaning and optimization
      let finalHTML = html;
      if (aiProcessor && options.useAI !== false) {
        console.log(chalk.gray("🤖 AI processing..."));
        try {
          // Use AI to clean and optimize the HTML structure
          finalHTML = await aiProcessor.cleanWithAI(html);
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ AI processing failed, using original HTML: ${error.message}`));
          finalHTML = html;
        }
      }

      // Download and consolidate assets from the original HTML
      console.log(chalk.gray("📥 Downloading assets..."));
      const assetsResult = await this.downloadAssets(
        finalHTML, // Process the AI-cleaned HTML for assets
        url,
        outputDir
      );

      // The downloadAssets method now handles consolidation and returns updated HTML
      finalHTML = assetsResult.html;

      // Generate HTML output
      const result = await this.generateHTMLOutput(
        finalHTML,
        outputDir,
        pageInfo
      );

      return {
        outputPath: outputDir,
        outputType,
        assetsCount: assetsResult.count,
        pageInfo,
        ...result,
      };
    } finally {
      await browser.close();
    }
  }

  async extractPageInfo(page, url) {
    return await page.evaluate((baseUrl) => {
      const title = document.title || "Cloned Website";
      const description =
        document.querySelector('meta[name="description"]')?.content || "";
      const favicon =
        document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')
          ?.href || "";
      const viewport =
        document.querySelector('meta[name="viewport"]')?.content ||
        "width=device-width, initial-scale=1.0";

      // Extract color scheme
      const bodyStyles = window.getComputedStyle(document.body);
      const primaryColor = bodyStyles.backgroundColor || "#ffffff";

      return {
        title,
        description,
        favicon,
        viewport,
        primaryColor,
        baseUrl,
      };
    }, url);
  }

  async downloadAssets(html, baseUrl, outputDir) {
    const $ = load(html);
    const downloads = [];
    const assetsDir = path.join(outputDir, "assets");

    // Ensure assets directories exist
    await Promise.all([
      fs.ensureDir(path.join(assetsDir, "css")),
      fs.ensureDir(path.join(assetsDir, "js")),
      fs.ensureDir(path.join(assetsDir, "images")),
    ]);

    // Consolidate CSS: Extract and combine all CSS
    let combinedCSS = "";
    const cssPath = path.join(outputDir, "style.css");

    // 1. Extract inline <style> blocks
    $("style").each((_, el) => {
      combinedCSS += $(el).html() + "\n";
      $(el).remove();
    });

    // 2. Download and combine linked CSS
    const linkTags = $("link[rel='stylesheet']");
    for (const el of linkTags.toArray()) {
      const href = $(el).attr("href");
      if (!href) continue;
      try {
        const absolute = this.resolveUrl(href, baseUrl);
        if (absolute) {
          const response = await axios.get(absolute, { timeout: 10000 });
          combinedCSS += response.data + "\n";
          $(el).remove();
        }
      } catch (error) {
        console.warn(chalk.yellow(`❌ Failed CSS: ${href}`));
      }
    }

    // Write combined CSS file
    if (combinedCSS.trim()) {
      await fs.writeFile(cssPath, combinedCSS);
      $("head").append(`<link rel="stylesheet" href="style.css">`);
    }

    // Consolidate JavaScript: Extract and combine all JS
    let combinedJS = "";
    const jsPath = path.join(outputDir, "script.js");

    // 3. Extract inline <script> blocks (non-src scripts)
    $("script").each((_, el) => {
      if (!$(el).attr("src") && !this.isTrackingScriptContent($(el).html())) {
        combinedJS += $(el).html() + "\n";
        $(el).remove();
      }
    });

    // 4. Download and combine linked JS (excluding tracking scripts)
    const scriptTags = $("script[src]");
    for (const el of scriptTags.toArray()) {
      const src = $(el).attr("src");
      if (!src || this.isTrackingScript(src)) {
        $(el).remove();
        continue;
      }
      try {
        const absolute = this.resolveUrl(src, baseUrl);
        if (absolute) {
          const response = await axios.get(absolute, { timeout: 10000 });
          combinedJS += response.data + "\n";
          $(el).remove();
        }
      } catch (error) {
        console.warn(chalk.yellow(`❌ Failed JS: ${src}`));
      }
    }

    // Write combined JS file
    if (combinedJS.trim()) {
      await fs.writeFile(jsPath, combinedJS);
      $("body").append(`<script src="script.js"></script>`);
    }

    // 5. Download images (img + background images)
    const imageDownloads = [];

    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        const fullUrl = this.resolveUrl(src, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(src, "images");
          const localPath = fileName;
          imageDownloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(el).attr("src", localPath);
        }
      }
    });

    // Handle srcset for responsive images
    $("img[srcset]").each((_, el) => {
      const srcset = $(el).attr("srcset");
      if (srcset) {
        const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        for (const url of urls) {
          const fullUrl = this.resolveUrl(url, baseUrl);
          if (fullUrl) {
            const fileName = this.getFileName(url, "images");
            const localPath = fileName;
            imageDownloads.push(
              this.downloadAsset(fullUrl, path.join(outputDir, localPath))
            );
            // Update srcset to point to local file
            const newSrcset = srcset.replace(url, localPath);
            $(el).attr("srcset", newSrcset);
          }
        }
      }
    });

    // 6. Download CSS background images
    if (combinedCSS) {
      const urlRegex = /url\(["']?(.*?)["']?\)/g;
      let match;
      let updatedCSS = combinedCSS;

      while ((match = urlRegex.exec(combinedCSS)) !== null) {
        const imgUrl = match[1];
        if (imgUrl.startsWith("data:")) continue;

        try {
          const absolute = this.resolveUrl(imgUrl, baseUrl);
          if (absolute) {
            const fileName = this.getFileName(imgUrl, "images");
            const localPath = fileName;
            imageDownloads.push(
              this.downloadAsset(absolute, path.join(outputDir, localPath))
            );
            // Update CSS with local path
            updatedCSS = updatedCSS.replace(imgUrl, localPath);
          }
        } catch (error) {
          console.warn(chalk.yellow(`❌ Failed CSS image: ${imgUrl}`));
        }
      }

      if (updatedCSS !== combinedCSS) {
        await fs.writeFile(cssPath, updatedCSS);
      }
    }

    // 7. Download favicon and icons
    $(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    ).each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const fullUrl = this.resolveUrl(href, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(href, "images");
          const localPath = fileName;
          imageDownloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(el).attr("href", localPath);
        }
      }
    });

    // Execute all image downloads
    const results = await Promise.allSettled(imageDownloads);
    const successful = results.filter((r) => r.status === "fulfilled").length;

    console.log(
      chalk.gray(`📦 Downloaded ${successful}/${imageDownloads.length} assets`)
    );

    // Return consolidated result
    return {
      count: successful,
      html: $.html(),
      assetMap: {
        css: combinedCSS ? ["style.css"] : [],
        js: combinedJS ? ["script.js"] : [],
        images: successful
      },
    };
  }

  async downloadAsset(url, localPath) {
    if (this.downloadedAssets.has(url)) return;

    try {
      const response = await axios({
        method: "GET",
        url: url,
        responseType: "stream",
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      await fs.ensureDir(path.dirname(localPath));

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          this.downloadedAssets.add(url);
          resolve();
        });
        writer.on("error", reject);
      });
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to download: ${url}`));
    }
  }

  resolveUrl(url, baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }

  getFileName(url, type) {
    try {
      const urlObj = new URL(url);
      let fileName = path.basename(urlObj.pathname);

      // Handle empty or root paths
      if (!fileName || fileName === "/" || fileName === "") {
        // Use a simple naming convention like in your example
        fileName = type === "css" ? "style" : type === "js" ? "script" : "image";
      }

      // Clean up the filename and ensure it has an extension
      fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      
      if (!path.extname(fileName)) {
        const ext = type === "css" ? ".css" : type === "js" ? ".js" : ".png";
        fileName += ext;
      }

      // For images, keep original extension if valid
      if (type === "images") {
        const originalExt = path.extname(fileName);
        const validImageExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'];
        if (!validImageExts.includes(originalExt.toLowerCase())) {
          fileName = fileName.replace(/\.[^.]*$/, '.png'); // Default to .png
        }
      }

      return fileName;
    } catch {
      // Simple fallback naming like your example
      const timestamp = Date.now();
      if (type === "css") return "style.css";
      if (type === "js") return "script.js";
      return `image_${timestamp}.png`;
    }
  }

  isTrackingScript(src) {
    const trackingPatterns = [
      "google-analytics",
      "gtag",
      "googletagmanager",
      "facebook.net",
      "twitter.com",
      "linkedin.com",
      "hotjar",
      "mixpanel",
      "segment.com",
    ];
    return trackingPatterns.some((pattern) => src.includes(pattern));
  }

  async generateHTMLOutput(html, outputDir, pageInfo) {
    // Clean up and optimize HTML
    const $ = load(html);

    // Remove tracking scripts and unnecessary elements
    $("script").each((i, elem) => {
      const src = $(elem).attr("src");
      const content = $(elem).html();

      // Remove tracking scripts
      if (src && this.isTrackingScript(src)) {
        $(elem).remove();
        return;
      }

      // Remove inline tracking scripts
      if (content && this.isTrackingScriptContent(content)) {
        $(elem).remove();
      }
    });

    // Remove noscript tags and other unnecessary elements
    $("noscript").remove();
    $("iframe").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src && this.isTrackingScript(src)) {
        $(elem).remove();
      }
    });

    // Fix relative URLs to absolute for external links
    $("a").each((i, elem) => {
      const href = $(elem).attr("href");
      if (href && href.startsWith("/") && !href.startsWith("//")) {
        $(elem).attr("href", new URL(href, pageInfo.baseUrl).href);
        $(elem).attr("target", "_blank"); // Open external links in new tab
      }
    });

    // Enhance meta tags only if missing
    if (!$("meta[name='viewport']").length) {
      $("head").prepend(
        `<meta name="viewport" content="${pageInfo.viewport}">`
      );
    }
    if (!$("meta[name='description']").length && pageInfo.description) {
      $("head").append(
        `<meta name="description" content="${pageInfo.description}">`
      );
    }

    // Add minimal enhancement styles (avoid conflicts)
    const enhancementStyles = `
      <style>
        /* UI Clone Enhancement Styles - Minimal and Non-Conflicting */
        html { 
          scroll-behavior: smooth; 
        }
        
        /* Ensure images are responsive without breaking existing styles */
        img:not([style*="width"]):not([style*="max-width"]) { 
          max-width: 100%; 
          height: auto; 
        }
        
        /* Accessibility improvements */
        a:focus, button:focus, input:focus, select:focus, textarea:focus {
          outline: 2px solid #007acc;
          outline-offset: 2px;
        }
        
        /* Performance optimization for transitions */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      </style>
    `;

    // Only add enhancement styles if they don't conflict
    if (!$("style:contains('scroll-behavior')").length) {
      $("head").append(enhancementStyles);
    }

    // Save main HTML file
    await fs.writeFile(path.join(outputDir, "index.html"), $.html());

    // Create server script
    await this.createServerScript(outputDir);

    return { mainFile: "index.html" };
  }

  isTrackingScriptContent(content) {
    const trackingPatterns = [
      "gtag",
      "ga(",
      "GoogleAnalytics",
      "google-analytics",
      "fbq(",
      "facebook",
      "_gaq",
      "gtm",
      "dataLayer",
      "mixpanel",
      "hotjar",
      "segment",
      "_hj",
    ];
    return trackingPatterns.some((pattern) => content.includes(pattern));
  }

  async createServerScript(outputDir) {
    // Create Python server script
    const pythonServer = `#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
from pathlib import Path

PORT = 8000
DIRECTORY = Path(__file__).parent

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"🌐 Serving at http://localhost:{PORT}")
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        except:
            pass
        httpd.serve_forever()

if __name__ == "__main__":
    main()`;

    // Create Windows batch script
    const batchServer = `@echo off
echo Starting cloned website server...
cd /d "%~dp0"
python serve.py
pause`;

    // Write server files
    await fs.writeFile(path.join(outputDir, "serve.py"), pythonServer);
    await fs.writeFile(path.join(outputDir, "serve.bat"), batchServer);

    console.log(chalk.green("📄 Created server scripts: serve.py, serve.bat"));
  }
}
