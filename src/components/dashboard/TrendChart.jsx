import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TrendChart({ data, dataKeys, title, yAxisLabel }) {
  const colors = ['#0891b2', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="analytics-card p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            }}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 12 } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('sv-SE');
            }}
          />
          {dataKeys.length > 1 && <Legend />}
          
          {dataKeys.map((key, index) => (
            <Line 
              key={key}
              type="monotone" 
              dataKey={key}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}