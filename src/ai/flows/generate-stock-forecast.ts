'use server';

/**
 * @fileOverview Generates a 5-day stock forecast for a given ticker symbol.
 *
 * This version refactors date generation into a dedicated utility for reliability.
 *
 * - getNextFiveBusinessDays - A utility to get an array of the next 5 business days.
 * - generateStockForecast - The main function that handles the stock forecast generation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getLatestQuote } from '@/services/alpaca';

/**
 * Utility function to get an array of the next 5 business days.
 * It correctly handles weekends and market close times.
 * @returns {Date[]} An array of 5 Date objects.
 */
function getNextFiveBusinessDays(logs: string[]): Date[] {
    const dates: Date[] = [];
    const etTimeZone = 'America/New_York';

    // Get the current date and time parts in the US Eastern timezone.
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: etTimeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    
    const year = getPart('year');
    const month = getPart('month') - 1; // month is 0-indexed in JS Date
    const day = getPart('day');
    const hour = getPart('hour');
    
    // Construct a date that represents the current day in ET.
    // Use UTC functions to avoid local timezone interference.
    let currentDate = new Date(Date.UTC(year, month, day));
    logs.push(`[Date Util] Starting with ET date: ${currentDate.toUTCString()}`);

    const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 6 = Saturday

    // If it's after 4 PM ET on a weekday, or if it's a weekend, advance to the next business day.
    if ((dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 16) || dayOfWeek === 6 || dayOfWeek === 0) {
        logs.push(`[Date Util] After hours or weekend. Advancing to next business day.`);
        // Advance to the next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        // Skip weekend
        if (currentDate.getUTCDay() === 6) { // If it's now Saturday...
            currentDate.setUTCDate(currentDate.getUTCDate() + 2); // ...move to Monday.
        }
        if (currentDate.getUTCDay() === 0) { // If it's now Sunday...
            currentDate.setUTCDate(currentDate.getUTCDate() + 1); // ...move to Monday.
        }
    }
    
    logs.push(`[Date Util] First forecast day determined as: ${currentDate.toUTCString()}`);

    // Loop until we have 5 business days
    while (dates.length < 5) {
        const currentDayOfWeek = currentDate.getUTCDay();
        if (currentDayOfWeek !== 0 && currentDayOfWeek !== 6) {
            dates.push(new Date(currentDate.getTime()));
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    
    logs.push(`[Date Util] Found 5 business days: ${dates.map(d => d.toISOString().split('T')[0]).join(', ')}`);
    return dates;
}


const GenerateStockForecastInputSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol (e.g., AAPL, MSFT, GOOGL).'),
  currentPrice: z.number().optional().describe('The current price of the stock.'),
});
export type GenerateStockForecastInput = z.infer<typeof GenerateStockForecastInputSchema>;

const ForecastDaySchema = z.object({
  date: z.string().describe('The date of the forecast (YYYY-MM-DD).'),
  openingPrice: z.number().describe('The projected opening price for the day.'),
  closingPrice: z.number().describe('The projected closing price for the day.'),
  projectedGainLoss: z.number().describe('The projected gain or loss for the day.'),
});

const GenerateStockForecastOutputSchema = z.object({
  forecast: z.array(ForecastDaySchema).describe('An array of 5-day stock forecast data.'),
  logs: z.array(z.string()).optional().describe('An array of debug log messages.'),
});
export type GenerateStockForecastOutput = z.infer<typeof GenerateStockForecastOutputSchema>;

export async function generateStockForecast(input: GenerateStockForecastInput): Promise<GenerateStockForecastOutput> {
  return generateStockForecastFlow(input);
}

const getStockForecastTool = ai.defineTool(
  {
    name: 'getStockForecast',
    description: 'Returns a 5-day stock forecast, including projected daily gains/losses for a given stock ticker.',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async ({ ticker, currentPrice }) => {
    if (currentPrice === undefined) {
      throw new Error('Current price is required to generate a forecast.');
    }

    const logs: string[] = [];
    const forecastDates = getNextFiveBusinessDays(logs);

    const forecast: z.infer<typeof ForecastDaySchema>[] = [];
    let lastClosingPrice = currentPrice;

    for (const date of forecastDates) {
        const openingPrice = lastClosingPrice * (1 + (Math.random() - 0.49) * 0.01);
        const closingPrice = openingPrice * (1 + (Math.random() - 0.5) * 0.02);
        const projectedGainLoss = closingPrice - openingPrice;

        const formattedDate = date.toISOString().split('T')[0];

        forecast.push({
            date: formattedDate,
            openingPrice: parseFloat(openingPrice.toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
        });

        lastClosingPrice = closingPrice;
    }
    
    return { forecast, logs };
  }
);


const generateStockForecastPrompt = ai.definePrompt({
  name: 'generateStockForecastPrompt',
  tools: [getStockForecastTool],
  input: {schema: GenerateStockForecastInputSchema},
  output: {schema: GenerateStockForecastOutputSchema},
  prompt: `You are a financial analyst. The user will provide you with a stock ticker.
  Your task is to provide a 5-day forecast.
  Use the getStockForecast tool to get the forecast.

  The user is asking about: {{{ticker}}}
  The current price is: {{{currentPrice}}}`,
});

const generateStockForecastFlow = ai.defineFlow(
  {
    name: 'generateStockForecastFlow',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async ({ ticker }) => {
    const quote = await getLatestQuote(ticker);
    if (!quote) {
      throw new Error(`Could not retrieve quote for ${ticker}`);
    }

    const {output} = await generateStockForecastPrompt({ ticker, currentPrice: quote.AskPrice });
    
    return output!;
  }
);
