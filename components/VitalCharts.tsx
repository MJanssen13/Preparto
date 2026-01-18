import React from 'react';
import { Observation } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface VitalChartsProps {
  observations: Observation[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 border border-slate-200 shadow-lg rounded text-xs">
        <p className="font-bold mb-1">{new Date(label).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const VitalCharts: React.FC<VitalChartsProps> = ({ observations }) => {
  // Reverse observations for chronological order (Oldest -> Newest)
  const data = [...observations].reverse().map(obs => ({
    time: obs.timestamp,
    bcf: obs.obstetric.bcf,
    dilation: obs.obstetric.dilation,
    systolic: obs.vitals.paSystolic,
    diastolic: obs.vitals.paDiastolic
  }));

  if (data.length < 2) return <div className="text-center text-slate-400 text-sm py-8">Dados insuficientes para gráficos</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-obs-500"></span>
          BCF e Dilatação
        </h4>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10 }} 
                tickFormatter={(time) => new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                stroke="#94a3b8"
              />
              <YAxis yAxisId="left" domain={[60, 200]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={110} yAxisId="left" stroke="red" strokeDasharray="3 3" opacity={0.3} />
              <ReferenceLine y={160} yAxisId="left" stroke="red" strokeDasharray="3 3" opacity={0.3} />
              
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="bcf" 
                name="BCF (bpm)" 
                stroke="#f43f5e" 
                strokeWidth={2} 
                dot={{ r: 3 }} 
              />
              <Line 
                yAxisId="right"
                type="stepAfter" 
                dataKey="dilation" 
                name="Dilatação (cm)" 
                stroke="#0ea5e9" 
                strokeWidth={2} 
                dot={{ r: 3 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
