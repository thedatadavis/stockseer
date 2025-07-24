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

    const getNextTradingDay = (date: Date): Date => {
      const newDate = new Date(date);
      newDate.setDate(newDate.getDate() + 1);
      const day = newDate.getDay();
      if (day === 6) { // Saturday
        newDate.setDate(newDate.getDate() + 2);
      } else if (day === 0) { // Sunday
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    };

    // Get the current date in ET
    const nowInET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    // Determine the starting date for the forecast
    let currentDate = new Date(nowInET);
    const dayOfWeekET = nowInET.getDay(); // Sunday - Saturday : 0 - 6
    const hourET = nowInET.getHours();

    // If it's a weekday after 4 PM ET, or if it's a weekend, start forecast from the next trading day.
    if ((dayOfWeekET >= 1 && dayOfWeekET <= 5 && hourET >= 16) || dayOfWeekET === 6 || dayOfWeekET === 0) {
      currentDate = getNextTradingDay(nowInET);
    }

    const forecast: z.infer<typeof ForecastDaySchema>[] = [];
    let lastClosingPrice = currentPrice;

    for (let i = 0; i < 5; i++) {
        // If the loop starts on a non-trading day, advance it to the next trading day.
        const day = currentDate.getDay();
        if (day === 6) { // Saturday
          currentDate.setDate(currentDate.getDate() + 2);
        } else if (day === 0) { // Sunday
          currentDate.setDate(currentDate.getDate() + 1);
        }

        const openingPrice = lastClosingPrice * (1 + (Math.random() - 0.5) * 0.02); // +/- 1%
        const closingPrice = openingPrice * (1 + (Math.random() - 0.5) * 0.04); // +/- 2%
        const projectedGainLoss = closingPrice - openingPrice;
        
        forecast.push({
            date: currentDate.toISOString().slice(0, 10),
            openingPrice: parseFloat(openingPrice.toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
        });

        lastClosingPrice = closingPrice;
        currentDate = getNextTradingDay(currentDate);
    }
    
    return { forecast };
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
