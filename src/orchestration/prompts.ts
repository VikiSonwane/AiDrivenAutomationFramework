import { PromptTemplate } from '@langchain/core/prompts';

export const TEST_PLAN_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert QA automation engineer. Convert the following natural language test description into a detailed, executable test plan.

Test Description:
{testDescription}

Current Page State (if available):
{pageState}

Generate a structured test plan with these requirements:
1. Break down the test into clear, atomic steps
2. Use semantic element descriptions (e.g., "Login button" not "#btn-login")
3. Include appropriate waits and assertions
4. Consider edge cases and error states
5. Make steps resilient to minor UI changes

Output a JSON object matching this schema:
{{
  "testName": "descriptive test name",
  "objective": "what this test validates",
  "preconditions": ["any required setup"],
  "steps": [
    {{
      "action": "navigate|click|fill|select|wait|verify|screenshot",
      "description": "human-readable step description",
      "parameters": {{}},
      "expectedOutcome": "what should happen"
    }}
  ],
  "assertions": ["list of things to verify"]
}}

Be specific and actionable. The test plan should be executable by an AI agent with access to Playwright.
`);

export const SELECTOR_HEALING_PROMPT = PromptTemplate.fromTemplate(`
You are an expert at understanding web page structure and finding elements that may have changed.

Original Element Description: {originalElement}
Error Encountered: {error}

Current Page Accessibility Tree:
{accessibilityTree}

Current Page URL: {url}

Your task:
1. Analyze why the original element couldn't be found
2. Find alternative ways to locate the same element based on the accessibility tree
3. Provide multiple selector options with confidence scores
4. Explain your reasoning

Consider:
- ARIA roles and labels
- Text content
- Semantic HTML structure
- Common UI patterns
- Element relationships (parent, sibling, child)

Output a JSON object matching this schema:
{{
  "element": "original element description",
  "confidence": 0.0-1.0,
  "alternatives": [
    {{
      "selector": "the selector to use",
      "type": "role|label|text|css|xpath|testid",
      "confidence": 0.0-1.0
    }}
  ],
  "reasoning": "explain your analysis and why these alternatives should work"
}}

Order alternatives by confidence score (highest first). Only suggest alternatives with >0.6 confidence.
`);

export const FAILURE_ANALYSIS_PROMPT = PromptTemplate.fromTemplate(`
You are an expert QA engineer analyzing test failures to determine root causes and suggest fixes.

Test Step That Failed: {failedStep}
Error Message: {errorMessage}
Stack Trace: {stackTrace}

Page State at Failure:
{pageState}

Screenshot Available: {hasScreenshot}

Previous Steps That Succeeded:
{previousSteps}

Analyze this failure and determine:
1. What type of error is this?
2. What is the severity?
3. What is the likely root cause?
4. Can this be automatically healed?
5. What is the suggested fix?

Consider:
- Is this a test issue (bad selector, timing) or application bug?
- Is the UI structure changed but functionality same?
- Is this a transient issue (network, timing)?
- Can we adapt the test to be more resilient?

Output a JSON object matching this schema:
{{
  "errorType": "element_not_found|timeout|assertion_failed|network_error|application_bug|test_issue",
  "severity": "low|medium|high|critical",
  "likelyRootCause": "detailed explanation",
  "suggestedFix": "specific actionable fix",
  "canAutoHeal": true|false,
  "healingStrategy": "if canAutoHeal is true, describe the strategy"
}}

Be conservative with auto-healing - only suggest it when you're confident it won't mask real bugs.
`);

export const TEST_DATA_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
You are an expert at generating realistic test data that fits the context of the application under test.

Data Type Needed: {dataType}
Context: {context}
Application Domain: {applicationDomain}

Requirements:
{requirements}

Generate realistic, contextually appropriate test data. 

For example:
- User data should have consistent names, emails, addresses
- Products should fit the application category
- Dates should be logical (order dates before delivery dates)
- Phone numbers and emails should be valid formats
- Addresses should be real-looking but not real

Output a JSON object with the generated data:
{{
  "dataType": "{dataType}",
  "fields": {{
    // generated fields here
  }},
  "context": "brief note about this data"
}}

Make the data feel authentic and appropriate for a professional test environment.
`);

export const VISUAL_ANALYSIS_PROMPT = PromptTemplate.fromTemplate(`
You are analyzing a screenshot from a test to determine if there are visual issues or unexpected UI states.

Test Context: {testContext}
Expected State: {expectedState}
Current Step: {currentStep}

Analyze the screenshot and determine:
1. Does the UI match the expected state?
2. Are there any visual anomalies (broken layout, missing elements, errors)?
3. Are all critical elements visible and properly rendered?
4. Is there any content that suggests an error or unexpected state?

Output a JSON object:
{{
  "matches_expected": true|false,
  "issues_found": [
    {{
      "type": "layout|content|styling|error|missing_element",
      "severity": "low|medium|high|critical",
      "description": "what's wrong"
    }}
  ],
  "analysis": "detailed explanation of what you see",
  "recommendation": "next steps or actions to take"
}}

Be thorough but pragmatic - minor styling variations are usually acceptable.
`);
