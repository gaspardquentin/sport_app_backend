import { db } from '../../db/index.js';
import { aiUsage } from '../../db/ai_assistant.js';
import { eq } from 'drizzle-orm';
import "dotenv/config";

const MAX_COST_USD = 5.0;

/**
 * Wrapper for OpenAI API calls with quota enforcement.
 * Note: GPT-5-2 is a placeholder for the requested model.
 */
export async function callAIAssistant(prompt: string, systemPrompt?: string): Promise<string> {
  // 1. Check current usage
  const [usage] = await db.select().from(aiUsage).where(eq(aiUsage.id, 'global'));
  const currentCost = usage ? parseFloat(usage.totalCostUsd) : 0;

  if (currentCost >= MAX_COST_USD) {
    throw new Error("AI Budget exceeded ($5.00 cap reached).");
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is missing. Returning mocked response.");
    return JSON.stringify({ message: "Mocked AI response because API key is missing." });
  }

  // 2. Real call would go here
  // For now, we mock the call but track the "cost"
  console.log(`[OpenAI] Processing request... (Current Budget: $${currentCost.toFixed(4)} / $${MAX_COST_USD})`);
  
  const responseText = "{}"; // Mocked JSON response
  const estimatedTokens = prompt.length / 4; // Very rough estimate
  const estimatedCost = (estimatedTokens / 1000) * 0.03; // Mocked cost: $0.03 per 1k tokens

  // 3. Update usage (Atomic-like update)
  if (!usage) {
    await db.insert(aiUsage).values({
      id: 'global',
      totalTokens: Math.ceil(estimatedTokens),
      totalCostUsd: estimatedCost.toFixed(6),
    });
  } else {
    await db.update(aiUsage)
      .set({
        totalTokens: usage.totalTokens + Math.ceil(estimatedTokens),
        totalCostUsd: (currentCost + estimatedCost).toFixed(6),
        updatedAt: new Date(),
      })
      .where(eq(aiUsage.id, 'global'));
  }

  return responseText;
}
