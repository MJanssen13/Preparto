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
  ReferenceLine,
  Legend
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
    diastolic: obs.vitals.paDiastolic,
    standingSystolic: obs.vitals.paStandingSystolic,
    standingDiastolic: obs.vitals.paStandingDiastolic
  }));

  if (data.length < 2) return <div className="text-center text-slate-400 text-sm py-8">Dados insuficientes para gráficos</div>;

  // Check if we have enough data for specific charts
  const hasBCFData = data.some(d => d.bcf !== undefined || d.dilation !== undefined);
  const hasPAData = data.some(d => d.systolic !== undefined || d.standingSystolic !== undefined);

  return (
    <div className="space-y-6">
      
      {/* BCF & Dilation Chart */}
      {hasBCFData && (
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
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <ReferenceLine y={110} yAxisId="left" stroke="red" strokeDasharray="3 3" opacity={0.3} label={{ value: '110', fontSize: 10, fill: 'red', opacity: 0.5, position: 'insideLeft' }} />
                <ReferenceLine y={160} yAxisId="left" stroke="red" strokeDasharray="3 3" opacity={0.3} label={{ value: '160', fontSize: 10, fill: 'red', opacity: 0.5, position: 'insideLeft' }} />
                
                <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="bcf" 
                    name="BCF (bpm)" 
                    stroke="#f43f5e" 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    connectNulls
                />
                <Line 
                    yAxisId="right"
                    type="stepAfter" 
                    dataKey="dilation" 
                    name="Dilatação (cm)" 
                    stroke="#0ea5e9" 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    connectNulls
                />
                </LineChart>
            </ResponsiveContainer>
            </div>
        </div>
      )}

      {/* Blood Pressure Chart */}
      {hasPAData && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            Pressão Arterial (mmHg)
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
                <YAxis domain={[40, 180]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '10px' }} />
                
                {/* Hypertension Thresholds */}
                <ReferenceLine y={140} stroke="red" strokeDasharray="3 3" opacity={0.4} label={{ value: '140', fontSize: 9, fill: 'red', position: 'insideTopRight' }} />
                <ReferenceLine y={90} stroke="orange" strokeDasharray="3 3" opacity={0.4} label={{ value: '90', fontSize: 9, fill: 'orange', position: 'insideTopRight' }} />
                
                {/* Standard / Sitting BP */}
                <Line 
                    type="monotone" 
                    dataKey="systolic" 
                    name="PAS (Sentada)" 
                    stroke="#4f46e5" 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    connectNulls
                />
                <Line 
                    type="monotone" 
                    dataKey="diastolic" 
                    name="PAD (Sentada)" 
                    stroke="#0ea5e9" 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                    connectNulls
                />

                {/* Standing BP (If available) */}
                <Line 
                    type="monotone" 
                    dataKey="standingSystolic" 
                    name="PAS (Em pé)" 
                    stroke="#d97706" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#d97706' }} 
                    connectNulls
                />
                <Line 
                    type="monotone" 
                    dataKey="standingDiastolic" 
                    name="PAD (Em pé)" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#f59e0b' }} 
                    connectNulls
                />
                </LineChart>
            </ResponsiveContainer>
            </div>
        </div>
      )}
    </div>
  );
};