
'use server';

/**
 * @fileOverview Provides a step-by-step trace of the stock forecast generation process
 * for debugging purposes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getLatestQuote, getHistoricalBars } from '@/services/alpaca';
import { calculateHistoricalStatistics } from '@/lib/statistics';

// Define the output structure for a single trace step
const TraceStepSchema = z.object({
  name: z.string().describe("The name of the step being traced."),
  status: z.enum(['success', 'error']).describe("Whether the step succeeded or failed."),
  input: z.any().optional().describe("The input provided to the step."),
  output: z.any().optional().describe("The output from the step."),
  error: z.string().optional().describe("The error message if the step failed."),
  duration: z.number().describe("The time taken for the step in milliseconds."),
});
export type TraceStep = z.infer<typeof TraceStepSchema>;


// Define the overall output schema for the trace
const TraceStockForecastOutputSchema = z.object({
  trace: z.array(TraceStepSchema).describe("An array of trace steps."),
});
export type TraceStockForecastOutput = z.infer<typeof TraceStockForecastOutputSchema>;


const TraceStockForecastInputSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol to trace.'),
});
export type TraceStockForecastInput = z.infer<typeof TraceStockForecastInputSchema>;


/**
 * A helper function to execute and trace a given asynchronous operation.
 */
async function traceStep<T>(name: string, input: any, fn: () => Promise<T>): Promise<{ step: TraceStep; result: T | null }> {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    return {
      step: { name, status: 'success', input, output: result, duration },
      result,
    };
  } catch (e: any) {
    const duration = Date.now() - startTime;
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return {
      step: { name, status: 'error', input, error: errorMessage, duration },
      result: null,
    };
  }
}

export async function traceStockForecast(input: TraceStockForecastInput): Promise<TraceStockForecastOutput> {
  return traceStockForecastFlow(input);
}


const traceStockForecastFlow = ai.defineFlow(
  {
    name: 'traceStockForecastFlow',
    inputSchema: TraceStockForecastInputSchema,
    outputSchema: TraceStockForecastOutputSchema,
  },
  async ({ ticker }) => {
    const trace: TraceStep[] = [];
    let quote: any = null;
    let historicalBars: any[] = [];
    
    // Step 1: Get Latest Quote
    const quoteStep = await traceStep('Get Latest Quote', { ticker }, () => getLatestQuote(ticker));
    trace.push(quoteStep.step);
    if (quoteStep.result) {
      quote = quoteStep.result;
    } else {
      return { trace }; // Stop if this step fails
    }

    // Step 2: Get Historical Bars
    const barsStep = await traceStep('Get Historical Bars', { ticker, days: 60 }, () => getHistoricalBars(ticker, 60));
    trace.push(barsStep.step);
    if (barsStep.result) {
      historicalBars = barsStep.result;
    } else {
      return { trace }; // Stop if this step fails
    }
    
    // Step 3: Calculate Historical Statistics
    const statsStep = await traceStep('Calculate Historical Statistics', { barCount: historicalBars.length }, () => calculateHistoricalStatistics(historicalBars));
    trace.push(statsStep.step);
    if (!statsStep.result) {
        return { trace }; // Stop if this step fails
    }

    return { trace };
  }
);
