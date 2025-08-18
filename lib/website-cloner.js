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

      // Process with AI if available and enabled
      let processedHTML = html;
      if (aiProcessor && options.useAI === true) {
        console.log(chalk.gray("🤖 AI processing..."));
        try {
          processedHTML = await aiProcessor.processHTML(html, url);
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ AI processing failed, using original HTML: ${error.message}`));
          processedHTML = html;
        }
      } else if (options.useAI === false) {
        console.log(chalk.gray("ℹ️ Using original HTML structure (AI processing disabled)"));
      }

      // Download assets from ORIGINAL HTML (not AI-processed) to preserve asset URLs
      console.log(chalk.gray("📥 Downloading assets..."));
      const assetsResult = await this.downloadAssets(
        html, // Use original HTML to find assets
        url,
        outputDir
      );
      const assetsCount = assetsResult.count;
      
      // Use AI-processed HTML as the final output (with asset injection if needed)
      let finalHTML = processedHTML;
      
      // If AI processing was used, we need to inject asset references
      if (aiProcessor && options.useAI === true && assetsCount > 0) {
        finalHTML = this.injectAssetsIntoHTML(processedHTML, assetsResult.assetMap);
      } else {
        finalHTML = assetsResult.html; // Use original with updated asset paths
      }

      // Generate HTML output
      const result = await this.generateHTMLOutput(
        finalHTML,
        outputDir,
        pageInfo
      );

      return {
        outputPath: outputDir,
        outputType,
        assetsCount,
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
    const assetMap = { css: [], js: [], images: [] }; // Track downloaded assets

    // Ensure assets directories exist
    await Promise.all([
      fs.ensureDir(path.join(assetsDir, "css")),
      fs.ensureDir(path.join(assetsDir, "js")),
      fs.ensureDir(path.join(assetsDir, "images")),
      fs.ensureDir(path.join(assetsDir, "fonts")),
    ]);

    // Download stylesheets
    $('link[rel="stylesheet"]').each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        const fullUrl = this.resolveUrl(href, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(href, "css");
          const localPath = path.join("assets", "css", fileName);
          downloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(elem).attr("href", localPath);
          assetMap.css.push(localPath); // Track CSS asset
        }
      }
    });

    // Download scripts
    $("script[src]").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src && !this.isTrackingScript(src)) {
        const fullUrl = this.resolveUrl(src, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(src, "js");
          const localPath = path.join("assets", "js", fileName);
          downloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(elem).attr("src", localPath);
          assetMap.js.push(localPath); // Track JS asset
        }
      }
    });

    // Download images (more comprehensive)
    $("img").each((i, elem) => {
      const src = $(elem).attr("src");
      if (src) {
        const fullUrl = this.resolveUrl(src, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(src, "images");
          const localPath = path.join("assets", "images", fileName);
          downloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(elem).attr("src", localPath);
          assetMap.images.push(localPath); // Track image asset
        }
      }
    });

    // Download background images from inline styles
    $("*").each((i, elem) => {
      const style = $(elem).attr("style");
      if (style && style.includes("background-image")) {
        const urlMatch = style.match(
          /background-image:\s*url\(['"]?([^'")]+)['"]?\)/
        );
        if (urlMatch) {
          const imgUrl = urlMatch[1];
          const fullUrl = this.resolveUrl(imgUrl, baseUrl);
          if (fullUrl) {
            const fileName = this.getFileName(imgUrl, "images");
            const localPath = path.join("assets", "images", fileName);
            downloads.push(
              this.downloadAsset(fullUrl, path.join(outputDir, localPath))
            );
            // Update the style attribute
            const newStyle = style.replace(
              urlMatch[0],
              `background-image: url(${localPath})`
            );
            $(elem).attr("style", newStyle);
            assetMap.images.push(localPath); // Track background image asset
          }
        }
      }
    });

    // Download favicon and other link assets
    $(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    ).each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        const fullUrl = this.resolveUrl(href, baseUrl);
        if (fullUrl) {
          const fileName = this.getFileName(href, "images");
          const localPath = path.join("assets", "images", fileName);
          downloads.push(
            this.downloadAsset(fullUrl, path.join(outputDir, localPath))
          );
          $(elem).attr("href", localPath);
        }
      }
    });

    // Download background images from CSS
    await this.downloadCSSAssets($, baseUrl, outputDir);

    // Execute downloads
    const results = await Promise.allSettled(downloads);
    const successful = results.filter((r) => r.status === "fulfilled").length;

    console.log(
      chalk.gray(`📦 Downloaded ${successful}/${downloads.length} assets`)
    );

    // Return both count, updated HTML, and asset map
    return {
      count: successful,
      html: $.html(),
      assetMap: assetMap,
    };
  }

  async downloadCSSAssets($, baseUrl, outputDir) {
    // This would process CSS files and download referenced assets
    // Implementation for downloading fonts, background images, etc.
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
        // Try to extract a meaningful name from the URL path or domain
        const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
        if (pathParts.length > 0) {
          fileName = pathParts[pathParts.length - 1];
        } else {
          // Use domain name as fallback
          fileName = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '-');
        }
      }

      // Clean up the filename and ensure it has an extension
      fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      
      if (!path.extname(fileName)) {
        const ext = type === "css" ? ".css" : type === "js" ? ".js" : ".png";
        fileName += ext;
      }

      return fileName;
    } catch {
      const fallbackName = type === "css" ? "style" : type === "js" ? "script" : "image";
      return `${fallbackName}-${Date.now()}.${type === "css" ? "css" : type === "js" ? "js" : "png"}`;
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

  injectAssetsIntoHTML(aiHTML, assetMap) {
    // Inject downloaded assets into AI-generated HTML
    const $ = load(aiHTML);
    
    // If there's no head tag, create one
    if (!$('head').length) {
      $('html').prepend('<head></head>');
    }
    
    // Inject CSS assets
    if (assetMap && assetMap.css && assetMap.css.length > 0) {
      assetMap.css.forEach(cssPath => {
        $('head').append(`<link rel="stylesheet" href="${cssPath}">`);
      });
    }
    
    // Inject JS assets at the end of body
    if (assetMap && assetMap.js && assetMap.js.length > 0) {
      assetMap.js.forEach(jsPath => {
        $('body').append(`<script src="${jsPath}"></script>`);
      });
    }
    
    return $.html();
  }
}
