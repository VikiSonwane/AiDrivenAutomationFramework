import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserManager } from './browser-manager.js';
import { PlaywrightTools } from './playwright-tools.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { Page } from 'playwright';

const logger = new Logger('MCPServer');

export class MCPServer {
  private server: Server;
  private browserManager: BrowserManager;
  private activeSessions: Map<string, { page: Page; tools: PlaywrightTools }> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'agentic-qa-playwright',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.browserManager = new BrowserManager(config.browser);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');
      return {
        tools: [
          {
            name: 'navigate',
            description: 'Navigate to a URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'The URL to navigate to' },
                waitUntil: {
                  type: 'string',
                  enum: ['load', 'domcontentloaded', 'networkidle'],
                  description: 'Wait until this event before considering navigation done',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'click',
            description: 'Click on an element',
            inputSchema: {
              type: 'object',
              properties: {
                element: { type: 'string', description: 'Human-readable element description' },
                ref: { type: 'string', description: 'Exact element reference (data-testid)' },
                button: {
                  type: 'string',
                  enum: ['left', 'right', 'middle'],
                  description: 'Mouse button to click',
                },
              },
              required: ['element'],
            },
          },
          {
            name: 'fill',
            description: 'Fill an input element with text',
            inputSchema: {
              type: 'object',
              properties: {
                element: { type: 'string', description: 'Human-readable element description' },
                ref: { type: 'string', description: 'Exact element reference (data-testid)' },
                text: { type: 'string', description: 'Text to fill in' },
              },
              required: ['element', 'text'],
            },
          },
          {
            name: 'select_option',
            description: 'Select option(s) in a dropdown',
            inputSchema: {
              type: 'object',
              properties: {
                element: { type: 'string', description: 'Human-readable element description' },
                ref: { type: 'string', description: 'Exact element reference (data-testid)' },
                values: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Option values to select',
                },
              },
              required: ['element', 'values'],
            },
          },
          {
            name: 'take_screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                fullPage: { type: 'boolean', description: 'Capture full scrollable page' },
                path: { type: 'string', description: 'File path to save screenshot' },
              },
            },
          },
          {
            name: 'get_accessibility_tree',
            description: 'Get the accessibility tree of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                includeHidden: { type: 'boolean', description: 'Include hidden elements' },
              },
            },
          },
          {
            name: 'get_page_state',
            description: 'Get current page state (URL, title, accessibility tree)',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'expect_visible',
            description: 'Assert that an element is visible',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'Element selector or description' },
              },
              required: ['selector'],
            },
          },
          {
            name: 'expect_text',
            description: 'Assert that an element contains specific text',
            inputSchema: {
              type: 'object',
              properties: {
                selector: { type: 'string', description: 'Element selector or description' },
                expectedText: { type: 'string', description: 'Expected text content' },
              },
              required: ['selector', 'expectedText'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      logger.info(`Tool called: ${request.params.name}`);
      
      try {
        // Ensure we have an active session
        let session = this.activeSessions.get('default');
        if (!session) {
          logger.info('Creating new browser session');
          const browser = await this.browserManager.launchBrowser();
          const context = await this.browserManager.createContext(browser, 'default');
          const page = await context.newPage();
          const tools = new PlaywrightTools(page);
          session = { page, tools };
          this.activeSessions.set('default', session);
        }

        const { tools } = session;
        const { name, arguments: args } = request.params;

        let result: any;

        switch (name) {
          case 'navigate':
            result = await tools.navigate(args as any);
            break;
          case 'click':
            result = await tools.click(args as any);
            break;
          case 'fill':
            result = await tools.fill(args as any);
            break;
          case 'select_option':
            result = await tools.selectOption(args as any);
            break;
          case 'take_screenshot':
            result = await tools.takeScreenshot(args as any);
            break;
          case 'get_accessibility_tree':
            result = await tools.getAccessibilityTree(args as any);
            break;
          case 'get_page_state':
            result = await tools.getPageState();
            break;
          case 'expect_visible':
            result = await tools.expectVisible(args?.selector as string);
            break;
          case 'expect_text':
            result = await tools.expectText(args?.selector as string, args?.expectedText as string);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        logger.error(`Tool execution failed: ${request.params.name}`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack,
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Server started and listening on stdio');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Server');
    await this.browserManager.closeAll();
    await this.server.close();
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPServer();
  
  server.start().catch((error) => {
    logger.error('Failed to start server', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });
}
