
'use server';

/**
 * @fileOverview Generates a 5-day stock forecast for a given ticker symbol,
 * enriched with historical context and statistical analysis.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getLatestQuote, getHistoricalBars } from '@/services/alpaca';
import { calculateHistoricalStatistics, type HistoricalContext } from '@/lib/statistics';

// Define Handlebars helpers
const handlebarsHelpers = {
    displayPercent: function (value: number) {
        if (typeof value !== 'number') return 'N/A';
        return `${(value * 100).toFixed(2)}%`;
    },
    toFixed: function (value: number, digits: number) {
        if (typeof value !== 'number') return 'N/A';
        return value.toFixed(digits);
    },
    gt: function (a: number, b: number) {
        return a > b;
    }
};


function getNextFiveBusinessDays(): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    
    // Start with today, but adjust if it's a weekend or after 4 PM ET
    let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Simple check: if it's Saturday (6) or Sunday (0), move to next Monday.
    if (currentDate.getDay() === 6) {
        currentDate.setDate(currentDate.getDate() + 2);
    } else if (currentDate.getDay() === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
    }

    while (dates.length < 5) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday and Saturday
            dates.push(new Date(currentDate.getTime()));
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
}

const GenerateStockForecastInputSchema = z.object({
  ticker: z.string().describe('The stock ticker symbol (e.g., AAPL, MSFT, GOOGL).'),
});
export type GenerateStockForecastInput = z.infer<typeof GenerateStockForecastInputSchema>;

const ForecastDaySchema = z.object({
  date: z.string().describe('The date of the forecast (YYYY-MM-DD).'),
  openingPrice: z.number().describe('The projected opening price for the day.'),
  closingPrice: z.number().describe('The projected closing price for the day.'),
  projectedGainLoss: z.number().describe('The projected gain or loss for the day, calculated as Closing Price - Opening Price.'),
});

const GenerateStockForecastOutputSchema = z.object({
  forecast: z.array(ForecastDaySchema).describe('An array of 5-day stock forecast data.'),
});
export type GenerateStockForecastOutput = z.infer<typeof GenerateStockForecastOutputSchema>;

const HistoricalContextSchema = z.object({
    consecutiveGainLossStreak: z.object({
        direction: z.enum(['gain', 'loss']),
        days: z.number()
    }),
    recentPerformance: z.object({
        change_1d: z.number(),
        change_5d: z.number(),
        change_30d: z.number()
    }),
    averageTrueRange_14d: z.number(),
    pricePosition_52w: z.object({
        high: z.number(),
        low: z.number(),
        position: z.number()
    }),
    dayOfWeekPerformance: z.array(z.object({
        day: z.string(),
        avgGain: z.number(),
        avgLoss: z.number(),
        winRate: z.number()
    }))
}).optional().describe('Calculated historical statistics to improve forecast accuracy.');


export async function generateStockForecast(input: GenerateStockForecastInput): Promise<GenerateStockForecastOutput> {
  return generateStockForecastFlow(input);
}


const forecastPrompt = ai.definePrompt({
    name: 'stockForecastPrompt',
    input: {
      schema: z.object({
        ticker: z.string(),
        currentPrice: z.number(),
        dates: z.array(z.string()),
        historicalContext: HistoricalContextSchema,
      }),
    },
    output: { schema: GenerateStockForecastOutputSchema },
    prompt: `You are a sophisticated financial analyst AI. Your task is to provide a 5-day stock forecast.

You have been provided with the current price and a set of key historical statistics for the stock: {{{ticker}}}.

- Current Price: \${{{currentPrice}}}
- Consecutive Up/Down Days: {{{historicalContext.consecutiveGainLossStreak.days}}} days of {{{historicalContext.consecutiveGainLossStreak.direction}}}
- Recent Performance: 1-day: {{#if (gt historicalContext.recentPerformance.change_1d 0)}}+{{/if}}{{{displayPercent historicalContext.recentPerformance.change_1d}}}, 5-day: {{#if (gt historicalContext.recentPerformance.change_5d 0)}}+{{/if}}{{{displayPercent historicalContext.recentPerformance.change_5d}}}, 30-day: {{#if (gt historicalContext.recentPerformance.change_30d 0)}}+{{/if}}{{{displayPercent historicalContext.recentPerformance.change_30d}}}
- 14-Day Average Volatility (ATR): \${{{toFixed historicalContext.averageTrueRange_14d 2}}}
- Position in 52-Week Range: Currently at {{{displayPercent historicalContext.pricePosition_52w.position}}} (Low: \${{{historicalContext.pricePosition_52w.low}}}, High: \${{{historicalContext.pricePosition_52w.high}}})
- Day-of-Week Tendencies:
{{#each historicalContext.dayOfWeekPerformance}}
  - {{this.day}}: Tends to gain {{displayPercent this.avgGain}} vs lose {{displayPercent this.avgLoss}}, with a {{displayPercent this.winRate}} win rate.
{{/each}}
- Forecast for the next 5 trading days:
{{#each dates}}
- {{this}}
{{/each}}

Use this historical context to generate a realistic but fictional 5-day forecast. Your analysis should be heavily influenced by these historical patterns. For example, if a stock has a strong tendency to perform well on Mondays, this should be reflected in your projection for the upcoming Monday.

Generate a JSON object that conforms to the output schema.
For each day, provide a projected opening price, closing price, and the projected gain or loss (closing - opening).
Ensure the 'projectedGainLoss' is correctly calculated.
Ensure the forecast array in the JSON output contains exactly 5 days. Do not include logs in the output.`,
    template: {
      helpers: handlebarsHelpers,
    }
  });
  
const generateStockForecastFlow = ai.defineFlow(
  {
    name: 'generateStockForecastFlow',
    inputSchema: GenerateStockForecastInputSchema,
    outputSchema: GenerateStockForecastOutputSchema,
  },
  async ({ ticker }) => {
    const quote = await getLatestQuote(ticker);
    const currentPrice = quote.ap; // Ask Price from quote
    
    const historicalBars = await getHistoricalBars(ticker, 60);
    const historicalContext = calculateHistoricalStatistics(historicalBars);

    const forecastDates = getNextFiveBusinessDays();
    const formattedDates = forecastDates.map(d => d.toISOString().split('T')[0]);

    const { output } = await forecastPrompt({
      ticker,
      currentPrice,
      dates: formattedDates,
      historicalContext,
    });
    
    if (!output) {
      throw new Error("Failed to get forecast from AI.");
    }

    // Ensure projectedGainLoss is correctly calculated as a fallback
    const validatedForecast = output.forecast.map(day => ({
        ...day,
        projectedGainLoss: day.closingPrice - day.openingPrice,
    }));
    
    return {
        forecast: validatedForecast,
    };
  }
);
