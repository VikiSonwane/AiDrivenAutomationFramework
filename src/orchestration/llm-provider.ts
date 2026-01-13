
import { Logger } from '../utils/logger.js';

const logger = new Logger('LLMProvider');

export async function queryOllama(prompt: string, model: string = 'llama3:8b-instruct'): Promise<string> {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });
    const data = await response.json() as { response: string };
    return data.response;
  } catch (error) {
    logger.error('Failed to query Ollama', error);
    throw error;
  }
}
