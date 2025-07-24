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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
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
import { ArrowRight, TrendingUp, ChevronsUpDown } from 'lucide-react';
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
  logs: [],
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Getting Dates..." : "Get Dates"}
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
      ticker: "GOOGL",
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

    // This is the new debug view. It just shows the dates.
    if (state.forecast) {
      return (
        <div className="animate-in fade-in-50 duration-500">
          <h2 className="text-2xl font-bold mb-4 font-headline">Calculated Dates for {state.ticker}</h2>
          <div className="p-4 bg-muted rounded-md">
            <ul className="space-y-2">
              {state.forecast.forecast.map(day => (
                <li key={day.date} className="font-mono text-lg">{day.date}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-10">
        <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Ready to test the date logic?</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a stock ticker above to get started.
        </p>
      </div>
    );
  };

  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle>Get Stock Dates (Debug Mode)</CardTitle>
        <CardDescription>
          This is a debug view to test the date calculation logic from the server.
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
      {state.logs && state.logs.length > 0 && (
        <CardFooter>
            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <ChevronsUpDown className="h-4 w-4" />
                    Debug Logs
                  </div>
                  </AccordionTrigger>
                <AccordionContent>
                  <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                    <code className="text-white text-sm">
                      {state.logs.join('\n')}
                    </code>
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        </CardFooter>
      )}
    </Card>
  );
}

function ForecastTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/2 mb-4" />
      <div className="p-4 bg-muted rounded-md space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
           <Skeleton key={index} className="h-7 w-32" />
        ))}
      </div>
    </div>
  );
}
