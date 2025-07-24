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
      return newDate;
    };
    
    const nowInET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    console.log('Initial time in ET:', nowInET.toString());

    let currentDate = new Date(nowInET);
    const dayOfWeekET = nowInET.getDay();
    const hourET = nowInET.getHours();

    // If it's a weekend or after-hours on a weekday, move to the next trading day
    if (dayOfWeekET === 6) { // Saturday
        currentDate.setDate(currentDate.getDate() + 2);
    } else if (dayOfWeekET === 0) { // Sunday
        currentDate.setDate(currentDate.getDate() + 1);
    } else if (hourET >= 16) { // Weekday after 4 PM
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Ensure the adjusted start date is not a weekend
    const adjustedStartDay = currentDate.getDay();
    if (adjustedStartDay === 6) { // If it's now Saturday
        currentDate.setDate(currentDate.getDate() + 2);
    } else if (adjustedStartDay === 0) { // If it's now Sunday
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('Calculated forecast start date:', currentDate.toString());

    const forecast: z.infer<typeof ForecastDaySchema>[] = [];
    let lastClosingPrice = currentPrice;

    for (let i = 0; i < 5; i++) {
        let forecastDate = new Date(currentDate);
        let dayOfWeek = forecastDate.getDay();

        while (dayOfWeek === 0 || dayOfWeek === 6) {
            forecastDate.setDate(forecastDate.getDate() + 1);
            dayOfWeek = forecastDate.getDay();
        }

        console.log(`Loop ${i}: Processing date`, forecastDate.toString());

        const openingPrice = lastClosingPrice * (1 + (Math.random() - 0.5) * 0.01);
        const closingPrice = openingPrice * (1 + (Math.random() - 0.5) * 0.02);
        const projectedGainLoss = closingPrice - openingPrice;

        const year = forecastDate.getFullYear();
        const month = String(forecastDate.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(forecastDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${dayOfMonth}`;

        forecast.push({
            date: formattedDate,
            openingPrice: parseFloat(openingPrice.toFixed(2)),
            closingPrice: parseFloat(closingPrice.toFixed(2)),
            projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
        });

        lastClosingPrice = closingPrice;
        currentDate.setDate(currentDate.getDate() + 1);
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
