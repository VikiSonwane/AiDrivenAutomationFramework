import { z } from 'zod';

// Schema for test step generation
export const TestStepSchema = z.object({
  action: z.enum(['navigate', 'click', 'fill', 'select', 'wait', 'verify', 'screenshot']),
  description: z.string(),
  parameters: z.record(z.any()),
  expectedOutcome: z.string().optional(),
});

export const TestPlanSchema = z.object({
  testName: z.string(),
  objective: z.string(),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(TestStepSchema),
  assertions: z.array(z.string()),
});

// Schema for self-healing selector resolution
export const SelectorResolutionSchema = z.object({
  element: z.string(),
  confidence: z.number().min(0).max(1),
  alternatives: z.array(z.object({
    selector: z.string(),
    type: z.enum(['role', 'label', 'text', 'css', 'xpath', 'testid']),
    confidence: z.number().min(0).max(1),
  })),
  reasoning: z.string(),
});

// Schema for failure analysis
export const FailureAnalysisSchema = z.object({
  errorType: z.enum(['element_not_found', 'timeout', 'assertion_failed', 'network_error', 'application_bug', 'test_issue']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  likelyRootCause: z.string(),
  suggestedFix: z.string(),
  canAutoHeal: z.boolean(),
  healingStrategy: z.string().optional(),
});

// Schema for test data generation
export const TestDataSchema = z.object({
  dataType: z.enum(['user', 'product', 'order', 'address', 'payment', 'custom']),
  fields: z.record(z.any()),
  context: z.string().optional(),
});

export type TestStep = z.infer<typeof TestStepSchema>;
export type TestPlan = z.infer<typeof TestPlanSchema>;
export type SelectorResolution = z.infer<typeof SelectorResolutionSchema>;
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;
export type TestData = z.infer<typeof TestDataSchema>;
