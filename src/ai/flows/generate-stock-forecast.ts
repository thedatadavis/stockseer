'use server';

/**
 * @fileOverview Generates a 5-day stock forecast for a given ticker symbol.
 *
 * - generateStockForecast - A function that handles the stock forecast generation.
 * - GenerateStockForecastInput - The input type for the generateStockForecast function.
 * - GenerateStockForecastOutput - The return type for the generateStockForecast function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getLatestQuote } from '@/services/alpaca';

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

    // Use Intl.DateTimeFormat to reliably get parts of the date in a specific timezone.
    const etTimeZone = 'America/New_York';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: etTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const partValues: { [key: string]: string } = {};
    for (const part of parts) {
        partValues[part.type] = part.value;
    }

    const year = parseInt(partValues.year);
    const month = parseInt(partValues.month) - 1; // Month is 0-indexed
    const day = parseInt(partValues.day);
    const hourET = parseInt(partValues.hour);
    const dayOfWeekET = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partValues.weekday);

    let currentDate = new Date(Date.UTC(year, month, day));
    logs.push(`Current ET Date: ${currentDate.toUTCString()}, Hour: ${hourET}, Day: ${dayOfWeekET}`);

    // Adjust start date based on market hours
    if (dayOfWeekET === 6) { // Saturday
      currentDate.setUTCDate(currentDate.getUTCDate() + 2);
    } else if (dayOfWeekET === 0) { // Sunday
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    } else if (hourET >= 16) { // Weekday after 4 PM ET
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      // If it was a Friday, advance to Monday
      if (currentDate.getUTCDay() === 6) { 
        currentDate.setUTCDate(currentDate.getUTCDate() + 2);
      }
    }

    logs.push(`Calculated forecast start date: ${currentDate.toUTCString()}`);

    const forecast: z.infer<typeof ForecastDaySchema>[] = [];
    let lastClosingPrice = currentPrice;

    for (let i = 0; i < 5; i++) {
        // Skip weekends
        while (currentDate.getUTCDay() === 6 || currentDate.getUTCDay() === 0) {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        logs.push(`Loop ${i}: Processing date ${currentDate.toUTCString()}`);

        const openingPrice = lastClosingPrice * (1 + (Math.random() - 0.5) * 0.01);
        const closingPrice = openingPrice * (1 + (Math.random() - 0.5) * 0.02);
        const projectedGainLoss = closingPrice - openingPrice;

        const formattedDate = currentDate.toISOString().split('T')[0];

        forecast.push({
            date: formattedDate,
            openingPrice: parseFloat(openingPrice.toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
        });

        lastClosingPrice = closingPrice;
        // Advance to the next calendar day for the next loop iteration
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
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
