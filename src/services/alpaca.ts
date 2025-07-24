
"use server";

import Alpaca from '@alpacahq/alpaca-trade-api';
import { type Bar } from '@alpacahq/alpaca-trade-api/dist/resources/datav2/entityv2';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_API_SECRET,
  paper: true, // Use paper trading environment
});

/**
 * Fetches the latest quote for a given stock ticker.
 * @param ticker The stock ticker symbol.
 * @returns The latest quote data.
 */
export async function getLatestQuote(ticker: string) {
  try {
    const quote = await alpaca.getLatestQuote(ticker);
    return quote;
  } catch (error) {
    console.error(`Error fetching quote for ${ticker} from Alpaca:`, error);
    if (error instanceof Error) {
        if (error.message.includes('HTTP 404')) {
            throw new Error(`Ticker symbol '${ticker}' not found.`);
        }
        if (error.message.includes('HTTP 401') || error.message.includes('forbidden')) {
            throw new Error('Authentication with Alpaca failed. Please check your API keys in the .env file.');
        }
    }
    throw new Error(`Could not retrieve quote for ${ticker}.`);
  }
}

/**
 * Fetches historical daily bar data for a given stock ticker.
 * @param ticker The stock ticker symbol.
 * @param days The number of past calendar days to retrieve data for.
 * @returns An array of daily bar objects.
 */
export async function getHistoricalBars(ticker: string, days: number): Promise<Bar[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    try {
        const barsGenerator = alpaca.getBarsV2(ticker, {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0],
            timeframe: '1Day',
            adjustment: 'split'
        });

        const bars: Bar[] = [];
        for await (const bar of barsGenerator) {
            bars.push(bar);
        }
        return bars;
        
    } catch (error) {
        console.error(`Error fetching historical bars for ${ticker} from Alpaca:`, error);
        if (error instanceof Error) {
            if (error.message.includes('HTTP 404')) {
                throw new Error(`Ticker symbol '${ticker}' not found.`);
            }
            if (error.message.includes('HTTP 401') || error.message.includes('forbidden')) {
                throw new Error('Authentication with Alpaca failed. Please check your API keys in the .env file.');
            }
        }
        throw new Error(`Could not retrieve historical data for ${ticker}.`);
    }
}
