"use client";

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
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
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Getting Forecast..." : "Get Forecast"}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}

export function StockForecast() {
  const [state, formAction] = useActionState(getForecastAction, initialState);
  const { pending } = useFormStatus();
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
    if (state.ticker) {
      form.reset({ ticker: state.ticker || "" });
    }
  }, [state, toast, form]);
  
  const renderContent = () => {
    if (pending) {
      return <ForecastTableSkeleton />;
    }

    if (state.forecast) {
      return (
        <div className="animate-in fade-in-50 duration-500">
          <h2 className="text-2xl font-bold mb-4 font-headline">5-Day Forecast for {state.ticker}</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Opening Price</TableHead>
                        <TableHead className="text-right">Closing Price</TableHead>
                        <TableHead className="text-right">Gain/Loss</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {state.forecast.forecast.map((day) => (
                        <TableRow key={day.date}>
                            <TableCell className="font-medium">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</TableCell>
                            <TableCell className="text-right">${day.openingPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${day.closingPrice.toFixed(2)}</TableCell>
                            <TableCell className={cn(
                                "text-right flex items-center justify-end gap-2",
                                day.projectedGainLoss >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                                {day.projectedGainLoss >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                ${Math.abs(day.projectedGainLoss).toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      );
    }

    return (
      <div className="text-center py-10">
        <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Ready for your stock forecast?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a stock ticker above to get started.
        </p>
      </div>
    );
  };

  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>AI Stock Forecast</CardTitle>
        <CardDescription>
          Get a 5-day AI-powered stock forecast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form action={formAction} className="flex flex-col sm:flex-row items-end gap-4 mb-8">
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
            <SubmitButton />
          </form>
        </Form>
        
        <div className="mt-4 min-h-[280px]">
          {renderContent()}
        </div>
      </CardContent>
    </Card>
  );
}

function ForecastTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/2 mb-4" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead><Skeleton className="h-6 w-24" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-6 w-32" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-6 w-32" /></TableHead>
            <TableHead className="text-right"><Skeleton className="h-6 w-24" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell><Skeleton className="h-6 w-24" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-6 w-32" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-6 w-32" /></TableCell>
              <TableCell className="text-right"><Skeleton className="h-6 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
