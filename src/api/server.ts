import express, { type Request, type Response } from 'express';
import { Logger } from '../utils/logger.js';
import { AgenticOrchestrator } from '../orchestration/agentic-orchestrator.js';
import { v4 as uuidv4 } from 'uuid';

const logger = new Logger('APIServer');

export class APIServer {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3001) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Execute natural language test
    this.app.post('/api/tests/execute', async (req: Request, res: Response) => {
      try {
        const { testDescription } = req.body;

        if (!testDescription) {
          return res.status(400).json({ error: 'testDescription is required' });
        }

        const testId = uuidv4();
        logger.info(`Executing test: ${testId}`);

        const orchestrator = new AgenticOrchestrator(testId);
        const result = await orchestrator.execute(testDescription);

        res.json({
          testId,
          result,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Test execution failed', error);
        res.status(500).json({
          error: 'Test execution failed',
          message: error.message,
        });
      }
    });

    // Get test results
    this.app.get('/api/tests/:testId', (req: Request, res: Response) => {
      const { testId } = req.params;
      
      // TODO: Implement database query
      res.json({
        testId,
        status: 'completed',
        message: 'Test results retrieval not yet implemented',
      });
    });

    // List recent tests
    this.app.get('/api/tests', (req: Request, res: Response) => {
      // TODO: Implement database query
      res.json({
        tests: [],
        message: 'Test listing not yet implemented',
      });
    });

    // Submit test for approval (self-healed tests)
    this.app.post('/api/tests/:testId/approve', (req: Request, res: Response) => {
      const { testId } = req.params;
      const { approved } = req.body;

      logger.info(`Test ${testId} ${approved ? 'approved' : 'rejected'}`);

      // TODO: Implement approval workflow
      res.json({
        testId,
        approved,
        message: 'Approval recorded',
      });
    });

    // Get token usage statistics
    this.app.get('/api/stats/tokens', (req: Request, res: Response) => {
      // TODO: Implement token usage tracking
      res.json({
        totalTokens: 0,
        costEstimate: 0,
        byModel: {},
      });
    });
  }

  start(): void {
    this.app.listen(this.port, () => {
      logger.info(`API Server started on port ${this.port}`);
      logger.info(`Health check: http://localhost:${this.port}/health`);
      logger.info(`API endpoint: http://localhost:${this.port}/api/tests/execute`);
    });
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new APIServer(3001);
  server.start();
}
