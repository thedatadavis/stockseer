"use server";

import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_API_SECRET,
  paper: true, // Use paper trading environment
});

/**
 * Fetches the latest quote for a given stock ticker.
 * @param ticker The stock ticker symbol.
 * @returns The latest quote data, or null if an error occurs.
 */
export async function getLatestQuote(ticker: string) {
  try {
    const quote = await alpaca.getLatestQuote(ticker);
    return quote;
  } catch (error) {
    console.error(`Error fetching quote for ${ticker} from Alpaca:`, error);
    if (error instanceof Error) {
        // More detailed error checking can be done here based on Alpaca's error responses
        if (error.message.includes('HTTP 404')) {
            throw new Error(`Ticker symbol '${ticker}' not found.`);
        }
        if (error.message.includes('HTTP 401')) {
            throw new Error('Authentication with Alpaca failed. Please check your API keys.');
        }
    }
    throw new Error(`Could not retrieve quote for ${ticker}.`);
  }
}
