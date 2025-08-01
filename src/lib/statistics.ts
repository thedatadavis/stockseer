
import type { Bar } from '@/services/alpaca';

// Type definitions for the statistics object
export interface ConsecutiveGainLossStreak {
  direction: 'gain' | 'loss';
  days: number;
}

export interface RecentPerformance {
  change_1d: number;
  change_5d: number;
  change_30d: number;
}

export interface PricePosition52w {
  high: number;
  low: number;
  position: number;
}

export interface DayOfWeekPerformance {
  day: string;
  avgGain: number;
  avgLoss: number;
  winRate: number;
}

export interface HistoricalContext {
  consecutiveGainLossStreak: ConsecutiveGainLossStreak;
  recentPerformance: RecentPerformance;
  averageTrueRange_14d: number;
  pricePosition_52w: PricePosition52w;
  dayOfWeekPerformance: DayOfWeekPerformance[];
}

/**
 * Calculates a rich set of historical statistics from daily bar data.
 * @param bars An array of daily bar objects, sorted from oldest to newest.
 * @returns A HistoricalContext object with all calculated statistics.
 */
export function calculateHistoricalStatistics(bars: Bar[]): HistoricalContext {
  if (bars.length < 30) {
    throw new Error('Not enough historical data to calculate statistics. Need at least 30 days.');
  }

  const consecutiveGainLossStreak = calculateConsecutiveGainLossStreak(bars);
  const recentPerformance = calculateRecentPerformance(bars);
  const averageTrueRange_14d = calculateAverageTrueRange(bars, 14);
  const pricePosition_52w = calculate52WeekPricePosition(bars);
  const dayOfWeekPerformance = calculateDayOfWeekPerformance(bars);
  
  return {
    consecutiveGainLossStreak,
    recentPerformance,
    averageTrueRange_14d,
    pricePosition_52w,
    dayOfWeekPerformance,
  };
}

function calculateConsecutiveGainLossStreak(bars: Bar[]): ConsecutiveGainLossStreak {
  let streak = 0;
  const lastBar = bars[bars.length - 1];
  const direction = lastBar.c > lastBar.o ? 'gain' : 'loss';

  for (let i = bars.length - 1; i >= 0; i--) {
    const currentDirection = bars[i].c > bars[i].o ? 'gain' : 'loss';
    if (currentDirection === direction) {
      streak++;
    } else {
      break;
    }
  }
  return { direction, days: streak };
}

function calculateRecentPerformance(bars: Bar[]): RecentPerformance {
  const lastClose = bars[bars.length - 1].c;
  
  const getChange = (daysAgo: number) => {
    if (bars.length > daysAgo) {
      const pastClose = bars[bars.length - 1 - daysAgo].c;
      return (lastClose - pastClose) / pastClose;
    }
    return 0;
  };

  return {
    change_1d: getChange(1),
    change_5d: getChange(5),
    change_30d: getChange(30),
  };
}

function calculateAverageTrueRange(bars: Bar[], period: number): number {
  if (bars.length < period) return 0;
  
  let trueRanges = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].h;
    const low = bars[i].l;
    const prevClose = bars[i - 1].c;
    
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  const relevantTrueRanges = trueRanges.slice(-period);
  const sum = relevantTrueRanges.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

function calculate52WeekPricePosition(bars: Bar[]): PricePosition52w {
    if (bars.length === 0) {
        return { high: 0, low: 0, position: 0 };
    }

    const relevantBars = bars.slice(-252); // Use up to the last 52 weeks of data
    const high = Math.max(...relevantBars.map(b => b.h));
    const low = Math.min(...relevantBars.map(b => b.l));
    const currentPrice = relevantBars[relevantBars.length - 1].c;
    
    const position = (high - low) > 0 ? (currentPrice - low) / (high - low) : 0.5;

    return { high, low, position };
}


function calculateDayOfWeekPerformance(bars: Bar[]): DayOfWeekPerformance[] {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const performance: { [day: string]: { gains: number[], losses: number[], wins: number, total: number } } = {};

    for (const bar of bars) {
        const date = new Date(bar.t);
        const dayOfWeek = dayNames[date.getUTCDay()];

        if (!performance[dayOfWeek]) {
            performance[dayOfWeek] = { gains: [], losses: [], wins: 0, total: 0 };
        }

        const dailyChange = (bar.c - bar.o) / bar.o;
        performance[dayOfWeek].total++;
        if (dailyChange > 0) {
            performance[dayOfWeek].gains.push(dailyChange);
            performance[dayOfWeek].wins++;
        } else if (dailyChange < 0) {
            performance[dayOfWeek].losses.push(dailyChange);
        }
    }

    const result: DayOfWeekPerformance[] = [];
    Object.keys(performance).forEach(day => {
        const data = performance[day];
        const avgGain = data.gains.length > 0 ? data.gains.reduce((a, b) => a + b, 0) / data.gains.length : 0;
        const avgLoss = data.losses.length > 0 ? data.losses.reduce((a, b) => a + b, 0) / data.losses.length : 0;
        const winRate = data.total > 0 ? data.wins / data.total : 0;
        result.push({ day, avgGain, avgLoss, winRate });
    });

    return result;
}
