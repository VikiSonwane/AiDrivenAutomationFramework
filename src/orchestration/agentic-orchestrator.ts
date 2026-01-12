import { StateGraph, END } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { llmProvider } from './llm-provider.js';
import { MCPClient, type MCPToolCall } from './mcp-client.js';
import { Logger } from '../utils/logger.js';
import {
  TEST_PLAN_GENERATION_PROMPT,
  SELECTOR_HEALING_PROMPT,
  FAILURE_ANALYSIS_PROMPT,
} from './prompts.js';
import { TestPlanSchema, SelectorResolutionSchema, FailureAnalysisSchema } from './schemas.js';

const logger = new Logger('AgenticOrchestrator');

interface AgentState {
  messages: BaseMessage[];
  testDescription: string;
  testPlan?: any;
  currentStep: number;
  pageState?: any;
  toolCalls: MCPToolCall[];
  results: any[];
  errors: any[];
  healingAttempts: number;
  maxIterations: number;
  currentIteration: number;
  completed: boolean;
}

export class AgenticOrchestrator {
  private mcpClient: MCPClient;
  private graph: StateGraph<AgentState>;
  private testId: string;

  constructor(testId: string) {
    this.testId = testId;
    this.mcpClient = new MCPClient();
    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<AgentState> {
    const graph = new StateGraph<AgentState>({
      channels: {
        messages: {
          value: (left: BaseMessage[], right: BaseMessage[]) => left.concat(right),
          default: () => [],
        },
        testDescription: { default: () => '' },
        currentStep: { default: () => 0 },
        toolCalls: { default: () => [] },
        results: { default: () => [] },
        errors: { default: () => [] },
        healingAttempts: { default: () => 0 },
        maxIterations: { default: () => 20 },
        currentIteration: { default: () => 0 },
        completed: { default: () => false },
      },
    });

    // Define nodes
    graph.addNode('plan', this.planNode.bind(this));
    graph.addNode('execute', this.executeNode.bind(this));
    graph.addNode('observe', this.observeNode.bind(this));
    graph.addNode('heal', this.healNode.bind(this));
    graph.addNode('complete', this.completeNode.bind(this));

    // Define edges
    graph.setEntryPoint('plan');
    
    graph.addEdge('plan', 'execute');
    
    graph.addConditionalEdges('execute', (state: AgentState) => {
      if (state.errors.length > 0 && state.healingAttempts < 3) {
        return 'heal';
      }
      return 'observe';
    });

    graph.addConditionalEdges('observe', (state: AgentState) => {
      if (state.completed) {
        return 'complete';
      }
      if (state.currentIteration >= state.maxIterations) {
        logger.warn('Max iterations reached');
        return 'complete';
      }
      return 'execute';
    });

    graph.addEdge('heal', 'execute');
    graph.addEdge('complete', END);

    return graph;
  }

  private async planNode(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('Planning test execution');

    try {
      const llm = llmProvider.getModel('primary');
      
      const prompt = await TEST_PLAN_GENERATION_PROMPT.format({
        testDescription: state.testDescription,
        pageState: state.pageState ? JSON.stringify(state.pageState) : 'Not available yet',
      });

      const response = await llm.invoke([
        new SystemMessage('You are an expert QA automation engineer. Output valid JSON only.'),
        new HumanMessage(prompt),
      ]);

      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const testPlan = TestPlanSchema.parse(JSON.parse(jsonMatch[0]));
      
      logger.info(`Test plan generated: ${testPlan.steps.length} steps`);

      return {
        testPlan,
        messages: [new AIMessage(`Test plan created with ${testPlan.steps.length} steps`)],
      };
    } catch (error) {
      logger.error('Failed to generate test plan', error);
      return {
        errors: [...state.errors, { node: 'plan', error }],
        completed: true,
      };
    }
  }

  private async executeNode(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.testPlan) {
      return { completed: true, errors: [...state.errors, { node: 'execute', error: 'No test plan' }] };
    }

    const step = state.testPlan.steps[state.currentStep];
    if (!step) {
      logger.info('All steps completed');
      return { completed: true };
    }

    logger.info(`Executing step ${state.currentStep + 1}: ${step.description}`);

    try {
      // Connect to MCP if not connected
      if (!this.mcpClient.isConnected()) {
        await this.mcpClient.connect();
      }

      // Map test step to MCP tool call
      const toolCall = this.mapStepToToolCall(step);
      
      // Execute the tool call
      const result = await this.mcpClient.callTool(toolCall);

      if (!result.success) {
        logger.warn(`Step failed: ${step.description}`, { error: result.error });
        return {
          errors: [...state.errors, { step: state.currentStep, error: result.error, step: step }],
          currentIteration: state.currentIteration + 1,
        };
      }

      logger.info(`Step completed successfully: ${step.description}`);

      return {
        results: [...state.results, result],
        currentStep: state.currentStep + 1,
        currentIteration: state.currentIteration + 1,
        errors: [], // Clear errors on success
        healingAttempts: 0, // Reset healing attempts
      };
    } catch (error) {
      logger.error(`Error executing step ${state.currentStep}`, error);
      return {
        errors: [...state.errors, { step: state.currentStep, error, stepData: step }],
        currentIteration: state.currentIteration + 1,
      };
    }
  }

  private async observeNode(state: AgentState): Promise<Partial<AgentState>> {
    logger.debug('Observing page state');

    try {
      // Get current page state via MCP
      const result = await this.mcpClient.callTool({
        name: 'get_page_state',
        arguments: {},
      });

      if (result.success) {
        return {
          pageState: result.data,
          messages: [new AIMessage('Page state updated')],
        };
      }

      return {};
    } catch (error) {
      logger.error('Failed to observe page state', error);
      return {};
    }
  }

  private async healNode(state: AgentState): Promise<Partial<AgentState>> {
    const lastError = state.errors[state.errors.length - 1];
    if (!lastError) {
      return {};
    }

    logger.info(`Attempting to heal failure (attempt ${state.healingAttempts + 1}/3)`);

    try {
      const llm = llmProvider.getModel('primary');

      const prompt = await SELECTOR_HEALING_PROMPT.format({
        originalElement: lastError.stepData?.parameters?.element || 'unknown',
        error: lastError.error?.toString() || 'unknown error',
        accessibilityTree: JSON.stringify(state.pageState?.accessibilityTree || {}, null, 2),
        url: state.pageState?.url || 'unknown',
      });

      const response = await llm.invoke([
        new SystemMessage('You are an expert at finding elements on web pages. Output valid JSON only.'),
        new HumanMessage(prompt),
      ]);

      const content = response.content as string;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const resolution = SelectorResolutionSchema.parse(JSON.parse(jsonMatch[0]));

      logger.info(`Healing suggestion: ${resolution.alternatives[0]?.selector} (confidence: ${resolution.alternatives[0]?.confidence})`);

      // Update the test plan with healed selector
      if (resolution.alternatives.length > 0 && resolution.alternatives[0].confidence > 0.7) {
        const updatedPlan = { ...state.testPlan };
        const step = updatedPlan.steps[state.currentStep];
        step.parameters.element = resolution.alternatives[0].selector;
        step.parameters.ref = resolution.alternatives[0].selector;

        logger.info('Test plan updated with healed selector');

        return {
          testPlan: updatedPlan,
          healingAttempts: state.healingAttempts + 1,
          errors: [], // Clear errors to retry
          messages: [new AIMessage(`Healed selector: ${resolution.reasoning}`)],
        };
      }

      logger.warn('No confident healing alternative found');
      return {
        healingAttempts: state.healingAttempts + 1,
        completed: true, // Give up if healing can't find good alternative
      };
    } catch (error) {
      logger.error('Healing attempt failed', error);
      return {
        healingAttempts: state.healingAttempts + 1,
        completed: state.healingAttempts >= 2, // Give up after 3 attempts
      };
    }
  }

  private async completeNode(state: AgentState): Promise<Partial<AgentState>> {
    logger.info('Test execution completed');

    // Cleanup
    try {
      await this.mcpClient.disconnect();
    } catch (error) {
      logger.error('Error during cleanup', error);
    }

    const successfulSteps = state.results.length;
    const totalSteps = state.testPlan?.steps.length || 0;
    const hasErrors = state.errors.length > 0;

    logger.info(`Results: ${successfulSteps}/${totalSteps} steps completed, ${state.errors.length} errors`);

    return {
      completed: true,
      messages: [
        new AIMessage(
          `Test ${hasErrors ? 'FAILED' : 'PASSED'}: ${successfulSteps}/${totalSteps} steps completed`
        ),
      ],
    };
  }

  private mapStepToToolCall(step: any): MCPToolCall {
    const actionMap: Record<string, string> = {
      navigate: 'navigate',
      click: 'click',
      fill: 'fill',
      select: 'select_option',
      verify: 'expect_visible',
      screenshot: 'take_screenshot',
    };

    const toolName = actionMap[step.action] || step.action;

    return {
      name: toolName,
      arguments: step.parameters,
    };
  }

  async execute(testDescription: string): Promise<any> {
    logger.info(`Starting test execution: ${this.testId}`);

    const initialState: AgentState = {
      messages: [],
      testDescription,
      currentStep: 0,
      toolCalls: [],
      results: [],
      errors: [],
      healingAttempts: 0,
      maxIterations: 20,
      currentIteration: 0,
      completed: false,
    };

    try {
      const compiledGraph = this.graph.compile();
      const result = await compiledGraph.invoke(initialState);

      return {
        testId: this.testId,
        success: result.errors.length === 0,
        steps: result.results.length,
        errors: result.errors,
        healingAttempts: result.healingAttempts,
        messages: result.messages,
      };
    } catch (error) {
      logger.error('Test execution failed', error);
      throw error;
    }
  }
}
