
"use server";

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_DATA_URL = "https://data.alpaca.markets/v2";

export interface Bar {
  t: string; // Timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
}

export interface Quote {
    t: string; // Timestamp
    ax: string; // Ask Exchange
    ap: number; // Ask Price
    as: number; // Ask Size
    bx: string; // Bid Exchange
    bp: number; // Bid Price
    bs: number; // Bid Size
    c: string[]; // Condition
    z: string; // Tape
}

async function handleAlpacaError(response: Response, ticker: string) {
    if (response.status === 401) {
        throw new Error('Authentication with Alpaca failed. Please check your API keys in the .env file.');
    }
    if (response.status === 404) {
        throw new Error(`Ticker symbol '${ticker}' not found.`);
    }
    const errorBody = await response.text();
    console.error(`Error fetching from Alpaca for ${ticker}:`, response.status, errorBody);
    throw new Error(`Could not retrieve data for ${ticker}. Status: ${response.status}`);
}

/**
 * Fetches the latest quote for a given stock ticker.
 * @param ticker The stock ticker symbol.
 * @returns The latest quote data.
 */
export async function getLatestQuote(ticker: string): Promise<Quote> {
    const url = `${ALPACA_DATA_URL}/stocks/${ticker}/quotes/latest`;
    const options = {
        method: 'GET',
        headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY!,
            'APCA-API-SECRET-KEY': ALPACA_API_SECRET!,
        },
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            await handleAlpacaError(response, ticker);
        }
        const data = await response.json();
        return data.quote;
    } catch (error: any) {
        if (error.message.includes('Authentication')) throw error;
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

    const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        timeframe: '1Day',
        adjustment: 'split',
        limit: '1000', // Max limit to ensure we get all days
    });

    const url = `${ALPACA_DATA_URL}/stocks/${ticker}/bars?${params.toString()}`;
    const options = {
        method: 'GET',
        headers: {
            'APCA-API-KEY-ID': ALPACA_API_KEY!,
            'APCA-API-SECRET-KEY': ALPACA_API_SECRET!,
        },
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            await handleAlpacaError(response, ticker);
        }
        const data = await response.json();
        return data.bars;
    } catch (error: any) {
        if (error.message.includes('Authentication')) throw error;
        throw new Error(`Could not retrieve historical data for ${ticker}.`);
    }
}
