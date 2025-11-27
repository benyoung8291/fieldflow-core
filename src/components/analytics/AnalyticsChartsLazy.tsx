import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load recharts components
const BarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })));
const Bar = lazy(() => import('recharts').then(m => ({ default: m.Bar })));
const LineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })));
const Line = lazy(() => import('recharts').then(m => ({ default: m.Line })));
const PieChart = lazy(() => import('recharts').then(m => ({ default: m.PieChart })));
const Pie = lazy(() => import('recharts').then(m => ({ default: m.Pie })));
const Cell = lazy(() => import('recharts').then(m => ({ default: m.Cell })));
const XAxis = lazy(() => import('recharts').then(m => ({ default: m.XAxis })));
const YAxis = lazy(() => import('recharts').then(m => ({ default: m.YAxis })));
const CartesianGrid = lazy(() => import('recharts').then(m => ({ default: m.CartesianGrid })));
const Tooltip = lazy(() => import('recharts').then(m => ({ default: m.Tooltip })));
const Legend = lazy(() => import('recharts').then(m => ({ default: m.Legend })));
const ResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));

const ChartLoadingFallback = () => (
  <Card>
    <CardContent className="p-6">
      <Skeleton className="h-[300px] w-full" />
    </CardContent>
  </Card>
);

interface BarChartLazyProps {
  data: any[];
  dataKey: string;
  xKey: string;
  colors?: string[];
  height?: number;
}

export const BarChartLazy = ({ data, dataKey, xKey, colors = ['#0891B2'], height = 300 }: BarChartLazyProps) => {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={dataKey} fill={colors[0]} />
        </BarChart>
      </ResponsiveContainer>
    </Suspense>
  );
};

interface LineChartLazyProps {
  data: any[];
  dataKey: string;
  xKey: string;
  color?: string;
  height?: number;
}

export const LineChartLazy = ({ data, dataKey, xKey, color = '#0891B2', height = 300 }: LineChartLazyProps) => {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={dataKey} stroke={color} />
        </LineChart>
      </ResponsiveContainer>
    </Suspense>
  );
};

interface PieChartLazyProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  colors: string[];
  height?: number;
}

export const PieChartLazy = ({ data, dataKey, nameKey, colors, height = 300 }: PieChartLazyProps) => {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label
            outerRadius={80}
            fill="#8884d8"
            dataKey={dataKey}
            nameKey={nameKey}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Suspense>
  );
};

// Export all chart components for use
export {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
};
