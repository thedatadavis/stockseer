# Stockseer

Like a weather forecast, but for stocks.

## Stock Forecasting Model

The stock forecasting model in Stockseer provides a 5-day outlook for a given stock ticker. It leverages an AI model that is informed by both current market data and historical performance analysis.

The process for generating a forecast involves the following:

1.  **Data Retrieval:** The model fetches the latest quote for the specified stock ticker to get the current price. It also retrieves 60 days of historical bar data to provide context.
2.  **Historical Analysis:** Key statistics are calculated from the historical data, including consecutive gain/loss streaks, recent performance (1-day, 5-day, and 30-day changes), 14-day Average True Range (a measure of volatility), the stock's position within its 52-week high/low range, and average day-of-week performance.
3.  **AI Prompting:** The collected current price, calculated historical context, and the dates for the next five business days are provided as input to a sophisticated financial analyst AI model.
4.  **Forecast Generation:** The AI model, using the provided information and its training as a financial analyst, generates a 5-day forecast. This forecast includes projected opening and closing prices for each of the next five business days.
5.  **Output Formatting:** The AI's output is formatted to include the projected gain or loss for each day (calculated as closing price minus opening price) and is returned as a structured JSON object.

This approach aims to provide users with a data-driven, AI-assisted perspective on potential short-term stock price movements, grounded in recent performance and historical tendencies.
