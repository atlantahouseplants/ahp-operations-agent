/**
 * AHP Operations Agent — Core Loop
 *
 * Runs a Claude agent with tool use to process a service visit end-to-end.
 *
 * The loop:
 *   1. Build the initial user message with form data
 *   2. Call Claude with system prompt + tools
 *   3. If Claude returns tool_use blocks → execute each tool, return results
 *   4. Repeat until Claude returns end_turn (no more tool calls)
 *   5. Extract the final text summary and return it
 *
 * Safety:
 *   - Max 30 iterations to prevent infinite loops
 *   - Tool call errors are returned to Claude (not thrown) so it can adapt
 *   - All tool calls and results are tracked for the response
 */

import Anthropic from '@anthropic-ai/sdk';
import { AGENT_SYSTEM_PROMPT } from '../prompts/agent-system.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { executeTool } from './tool-executor.js';

const MAX_ITERATIONS = 30;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS, 10) || 4096;
const TEMPERATURE = 0.3;

let _anthropic = null;
function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Runs the agent for a single service visit.
 *
 * @param {object} formData — The service form submission
 * @returns {{ summary: string, actions_taken: Array, iteration_count: number }}
 */
export async function runAgent(formData) {
  const client = getClient();

  // Initial user message: the form submission
  const messages = [
    {
      role: 'user',
      content: `Process this service visit:\n\n${JSON.stringify(formData, null, 2)}`,
    },
  ];

  const actions_taken = []; // track every tool call + result
  let iteration = 0;
  let summary = '';

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: AGENT_SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Add Claude's response to the conversation history
    messages.push({ role: 'assistant', content: response.content });

    // Extract any text blocks for the running summary
    const textBlocks = response.content.filter((b) => b.type === 'text');
    if (textBlocks.length > 0) {
      summary = textBlocks.map((b) => b.text).join('\n');
    }

    // Done — Claude has no more tool calls
    if (response.stop_reason === 'end_turn') {
      break;
    }

    // Process tool_use blocks
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];

      for (const block of toolUseBlocks) {
        const toolCall = { tool: block.name, input: block.input };
        let result;

        try {
          result = await executeTool(block.name, block.input);
          toolCall.result = result;
        } catch (err) {
          // Return error to Claude so it can adapt — don't crash the loop
          console.error(`[AHP Agent] Tool "${block.name}" threw:`, err.message);
          result = { error: err.message };
          toolCall.error = err.message;
        }

        actions_taken.push(toolCall);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      // Send tool results back to Claude
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason (max_tokens, etc.) — break and use what we have
    console.warn(`[AHP Agent] Unexpected stop_reason: ${response.stop_reason}`);
    break;
  }

  if (iteration >= MAX_ITERATIONS) {
    console.warn(`[AHP Agent] Hit max iterations (${MAX_ITERATIONS}) — agent may not have completed all steps`);
  }

  return {
    summary: summary || 'Agent completed (no summary text returned)',
    actions_taken,
    iteration_count: iteration,
  };
}
