import { StockForecast } from '@/components/stock-forecast';
import { Icons } from '@/components/icons';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-8 md:mb-12">
        <div className="inline-flex items-center gap-3 mb-4">
          <Icons.Logo className="w-10 h-10 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-headline">
            Stockseer
          </h1>
        </div>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
          Enter a stock ticker to get an AI-powered 5-day forecast. Projections include opening price, closing price, and daily gain/loss.
        </p>
      </header>
      <main>
        <StockForecast />
      </main>
      <footer className="text-center mt-12">
        <p className="text-sm text-muted-foreground">
          Powered by GenAI. Forecasts are projections and not financial advice.
        </p>
      </footer>
    </div>
  );
}
