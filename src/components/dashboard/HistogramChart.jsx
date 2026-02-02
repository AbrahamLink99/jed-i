import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function HistogramChart({ data, title, subtitle }) {
  // Color cells based on position (center is good, edges are bad)
  const getColor = (index, total) => {
    const middle = Math.floor(total / 2);
    const distance = Math.abs(index - middle);
    
    if (distance === 0) return '#10b981'; // Green
    if (distance <= 1) return '#0891b2'; // Cyan
    if (distance <= 2) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div className="analytics-card p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
      </div>
      
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis 
            dataKey="range" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            angle={-15}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }}
            label={{ value: 'Antal', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index, data.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}