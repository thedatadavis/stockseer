"use client";

import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type GenerateStockForecastOutput } from "@/ai/flows/generate-stock-forecast";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getForecastAction, type ForecastState } from '@/app/actions/get-forecast-action';

const formSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10, 'Ticker is too long').toUpperCase(),
});

type FormValues = z.infer<typeof formSchema>;

const initialState: ForecastState = {
  forecast: null,
  message: null,
  ticker: null,
};

export function StockForecast() {
  const [state, formAction] = useFormState(getForecastAction, initialState);
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
    },
  });

  useEffect(() => {
    if (state.message) {
      toast({
        title: "Error",
        description: state.message,
        variant: "destructive",
      });
    }
    setIsPending(false);
    form.reset({ ticker: state.ticker || "" });
  }, [state, toast, form]);

  const onSubmit = (data: FormValues) => {
    setIsPending(true);
    const formData = new FormData();
    formData.append('ticker', data.ticker);
    formAction(formData);
  };
  
  const renderTable = () => {
    if (isPending) {
      return <ForecastTableSkeleton />;
    }

    if (state.forecast) {
      return (
        <div className="animate-in fade-in-50 duration-500">
          <h2 className="text-2xl font-bold mb-4 font-headline">5-Day Forecast for {state.ticker}</h2>
          <ForecastTable forecastData={state.forecast} />
        </div>
      );
    }

    return (
      <div className="text-center py-10">
        <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Ready to see the future?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a stock ticker above to get started.
        </p>
      </div>
    );
  };

  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Get Stock Forecast</CardTitle>
        <CardDescription>
          Enter a ticker symbol (e.g., AAPL, MSFT) to get an AI-generated 5-day forecast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-start gap-4 mb-8">
            <FormField
              control={form.control}
              name="ticker"
              render={({ field }) => (
                <FormItem className="w-full sm:w-auto flex-grow">
                  <FormLabel className="sr-only">Stock Ticker</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., GOOGL" {...field} className="text-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? "Getting Forecast..." : "Get Forecast"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </Form>
        
        <div className="mt-4 min-h-[280px]">
          {renderTable()}
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastTable({ forecastData }: { forecastData: GenerateStockForecastOutput }) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Opening Price</TableHead>
          <TableHead className="text-right">Closing Price</TableHead>
          <TableHead className="text-right">Projected Gain/Loss</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {forecastData.forecast.map((day) => (
          <TableRow key={day.date}>
            <TableCell className="font-medium">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</TableCell>
            <TableCell className="text-right">{formatCurrency(day.openingPrice)}</TableCell>
            <TableCell className="text-right">{formatCurrency(day.closingPrice)}</TableCell>
            <TableCell
              className={cn("text-right font-semibold", {
                'text-emerald-600': day.projectedGainLoss >= 0,
                'text-destructive': day.projectedGainLoss < 0,
              })}
            >
              {day.projectedGainLoss >= 0 ? '+' : ''}{formatCurrency(day.projectedGainLoss)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ForecastTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/2 mb-4" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className="h-5 w-20" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-5 w-32 ml-auto" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
