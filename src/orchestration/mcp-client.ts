import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, type ChildProcess } from 'child_process';
import { Logger } from '../utils/logger.js';

const logger = new Logger('MCPClient');

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class MCPClient {
  private client: Client | null = null;
  private serverProcess: ChildProcess | null = null;
  private transport: StdioClientTransport | null = null;
  private connected: boolean = false;

  async connect(): Promise<void> {
    if (this.connected) {
      logger.debug('Already connected to MCP server');
      return;
    }

    try {
      logger.info('Starting MCP server process');
      
      // Start the MCP server as a child process
      this.serverProcess = spawn('tsx', ['src/mcp-server/index.ts'], {
        stdio: ['pipe', 'pipe', 'inherit'],
        cwd: process.cwd(),
      });

      if (!this.serverProcess.stdin || !this.serverProcess.stdout) {
        throw new Error('Failed to get stdin/stdout from server process');
      }

      // Create transport
      this.transport = new StdioClientTransport({
        stdin: this.serverProcess.stdin,
        stdout: this.serverProcess.stdout,
      });

      // Create and connect client
      this.client = new Client(
        {
          name: 'agentic-qa-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      this.connected = true;
      
      logger.info('Successfully connected to MCP server');
    } catch (error) {
      logger.error('Failed to connect to MCP server', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      logger.info('Disconnecting from MCP server');
      
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }

      this.connected = false;
      logger.info('Disconnected from MCP server');
    } catch (error) {
      logger.error('Error during disconnect', error);
    }
  }

  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const response = await this.client.request(
        { method: 'tools/list' },
        { timeout: 5000 }
      );
      return response.tools || [];
    } catch (error) {
      logger.error('Failed to list tools', error);
      throw error;
    }
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      logger.debug(`Calling tool: ${toolCall.name}`, { arguments: toolCall.arguments });
      
      const response = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolCall.name,
            arguments: toolCall.arguments,
          },
        },
        { timeout: 30000 }
      );

      // Parse the response
      const content = response.content?.[0];
      if (!content || content.type !== 'text') {
        throw new Error('Invalid response from MCP server');
      }

      const result = JSON.parse(content.text);
      
      return {
        success: !response.isError && result.success !== false,
        data: result,
        error: result.error,
      };
    } catch (error: any) {
      logger.error(`Tool call failed: ${toolCall.name}`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async executeSequence(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]> {
    const results: MCPToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.callTool(toolCall);
      results.push(result);

      // Stop on first failure unless it's an assertion
      if (!result.success && !toolCall.name.startsWith('expect_')) {
        logger.warn(`Tool sequence stopped at ${toolCall.name} due to failure`);
        break;
      }
    }

    return results;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
