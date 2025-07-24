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

const GenerateStockForecastInputSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol (e.g., AAPL, MSFT, GOOGL).'),
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

const getStockForecast = ai.defineTool(
  {
    name: 'getStockForecast',
    description: 'Returns a 5-day stock forecast, including projected daily gains/losses for a given stock ticker.',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async (input) => {
    // This is a placeholder implementation.
    // In a real application, this would call an external API or service to get the stock forecast.
    
    const getNextWeekday = (date: Date) => {
        const newDate = new Date(date);
        const day = newDate.getDay();
        if (day === 5 /* Friday */) {
            newDate.setDate(newDate.getDate() + 3);
        } else if (day === 6 /* Saturday */) {
            newDate.setDate(newDate.getDate() + 2);
        } else {
            newDate.setDate(newDate.getDate() + 1);
        }
        return newDate;
    };

    const isMarketOpen = (now: Date) => {
        const hours = now.getHours();
        const day = now.getDay();
        // Market is open 9:30 AM - 4 PM ET on weekdays
        return day >= 1 && day <= 5 && hours >= 9 && hours < 16;
    };

    let startDate = new Date();
    // If market is closed, start from the next day.
    if (!isMarketOpen(startDate)) {
        startDate.setDate(startDate.getDate() + 1);
    }

    const forecast = [];
    let currentDate = new Date(startDate);

    while (forecast.length < 5) {
        const day = currentDate.getDay();
        // Skip weekends
        if (day !== 0 && day !== 6) {
            const dateString = currentDate.toISOString().slice(0, 10);
            const openingPrice = Math.random() * 100 + 100; // Random price between 100 and 200
            const closingPrice = openingPrice + (Math.random() * 10 - 5); // Opening price plus or minus a random value between -5 and 5
            const projectedGainLoss = closingPrice - openingPrice;
            forecast.push({
                date: dateString,
                openingPrice: parseFloat(openingPrice.toFixed(2)),
                closingPrice: parseFloat(closingPrice.toFixed(2)),
                projectedGainLoss: parseFloat(projectedGainLoss.toFixed(2)),
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return {
      forecast: forecast,
    };
  }
);

const generateStockForecastPrompt = ai.definePrompt({
  name: 'generateStockForecastPrompt',
  tools: [getStockForecast],
  input: {schema: GenerateStockForecastInputSchema},
  output: {schema: GenerateStockForecastOutputSchema},
  prompt: `You are a financial analyst.  The user will provide you with a stock ticker, and you will provide a 5-day forecast using the getStockForecast tool.

  The ticker the user is asking about is: {{{ticker}}}`,
});

const generateStockForecastFlow = ai.defineFlow(
  {
    name: 'generateStockForecastFlow',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async input => {
    const {output} = await generateStockForecastPrompt(input);
    return output!;
  }
);
