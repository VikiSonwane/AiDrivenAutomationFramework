-- Test Results Table
CREATE TABLE IF NOT EXISTS test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id VARCHAR(255) UNIQUE NOT NULL,
  test_name VARCHAR(500),
  test_description TEXT,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  steps_completed INTEGER DEFAULT 0,
  steps_total INTEGER DEFAULT 0,
  healing_attempts INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Test Steps Table
CREATE TABLE IF NOT EXISTS test_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT,
  screenshot_path VARCHAR(500),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Self-Healing Records Table
CREATE TABLE IF NOT EXISTS healing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  original_selector TEXT NOT NULL,
  healed_selector TEXT NOT NULL,
  confidence DECIMAL(3, 2),
  reasoning TEXT,
  approved BOOLEAN DEFAULT FALSE,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  usage_count INTEGER DEFAULT 1,
  success_rate DECIMAL(5, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Token Usage Table
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  model_name VARCHAR(100) NOT NULL,
  operation_type VARCHAR(100),
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  estimated_cost DECIMAL(10, 6),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Test Data Cache Table
CREATE TABLE IF NOT EXISTS test_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type VARCHAR(100) NOT NULL,
  context VARCHAR(500),
  data_hash VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(data_type, data_hash)
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15, 4) NOT NULL,
  unit VARCHAR(50),
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_test_results_status ON test_results(status);
CREATE INDEX idx_test_results_created_at ON test_results(created_at DESC);
CREATE INDEX idx_test_steps_test_result_id ON test_steps(test_result_id);
CREATE INDEX idx_healing_records_approved ON healing_records(approved);
CREATE INDEX idx_token_usage_test_result_id ON token_usage(test_result_id);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at DESC);
CREATE INDEX idx_performance_metrics_test_result_id ON performance_metrics(test_result_id);

-- Create Views for Reporting
CREATE OR REPLACE VIEW test_summary AS
SELECT 
  DATE(created_at) as test_date,
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tests,
  AVG(duration_ms) as avg_duration_ms,
  SUM(healing_attempts) as total_healing_attempts,
  SUM(steps_completed) as total_steps_completed
FROM test_results
GROUP BY DATE(created_at)
ORDER BY test_date DESC;

CREATE OR REPLACE VIEW token_cost_summary AS
SELECT 
  DATE(created_at) as usage_date,
  model_name,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost,
  AVG(total_tokens) as avg_tokens_per_call
FROM token_usage
GROUP BY DATE(created_at), model_name
ORDER BY usage_date DESC, total_cost DESC;

CREATE OR REPLACE VIEW healing_effectiveness AS
SELECT 
  original_selector,
  healed_selector,
  COUNT(*) as usage_count,
  AVG(confidence) as avg_confidence,
  SUM(CASE WHEN approved THEN 1 ELSE 0 END) as approved_count,
  ROUND(AVG(CASE WHEN approved THEN 1.0 ELSE 0.0 END) * 100, 2) as approval_rate
FROM healing_records
GROUP BY original_selector, healed_selector
HAVING COUNT(*) > 1
ORDER BY usage_count DESC;
