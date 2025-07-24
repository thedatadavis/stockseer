
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { traceAction, type TraceState } from './trace-action';

const formSchema = z.object({
  ticker: z.string().min(1, 'Ticker is required').max(10, 'Ticker is too long').toUpperCase(),
});

type FormValues = z.infer<typeof formSchema>;

const initialState: TraceState = {
  trace: null,
  message: null,
  ticker: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Tracing...' : 'Run Trace'}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}

export default function AdminTracePage() {
  const [state, formAction] = useActionState(traceAction, initialState);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Admin Request Tracer</CardTitle>
          <CardDescription>
            Enter a stock ticker to trace the forecast generation process step-by-step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col sm:flex-row items-end gap-4 mb-8">
            <div className="w-full sm:w-auto flex-grow">
              <label htmlFor="ticker" className="sr-only">Stock Ticker</label>
              <Input id="ticker" name="ticker" placeholder="e.g., GOOGL" className="text-lg" defaultValue={state.ticker ?? ''} />
            </div>
            <SubmitButton />
          </form>

          {state.message && (
            <div className="mb-4 text-red-600">
              <p>
                <strong>Error:</strong> {state.message}
              </p>
            </div>
          )}

          {state.trace && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">Trace for {state.ticker}</h2>
              {state.trace.trace.map((step, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader
                    className={cn(
                      'flex flex-row items-center justify-between',
                      step.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {step.status === 'success' ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                      <CardTitle className="text-lg">{step.name}</CardTitle>
                    </div>
                    <div className="text-sm text-muted-foreground">{step.duration}ms</div>
                  </CardHeader>
                  <CardContent className="p-4 text-sm">
                    <div>
                      <h4 className="font-semibold">Input:</h4>
                      <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto">
                        {JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                    {step.output && (
                       <div className="mt-2">
                        <h4 className="font-semibold">Output:</h4>
                        <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto">
                            {JSON.stringify(step.output, null, 2)}
                        </pre>
                       </div>
                    )}
                    {step.error && (
                      <div className="mt-2">
                        <h4 className="font-semibold text-red-600">Error:</h4>
                        <pre className="mt-1 p-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-xs overflow-auto">
                            {step.error}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
