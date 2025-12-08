import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { MoodData } from '../types';

interface MoodChartProps {
  data: MoodData[];
}

const MoodChart: React.FC<MoodChartProps> = ({ data }) => {
  return (
    <div className="w-full h-64 font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="4" height="4">
              <path d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2" style={{stroke: '#fb923c', strokeWidth: 1}} />
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="time" 
            stroke="#000" 
            tick={{ fill: '#000', fontSize: 12, fontWeight: 'bold' }} 
            axisLine={{ stroke: '#000', strokeWidth: 2 }}
            tickLine={false}
            dy={10}
          />
          <YAxis hide domain={[0, 100]} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '2px solid #000', 
              boxShadow: '4px 4px 0px 0px #000',
              borderRadius: '0px'
            }}
            itemStyle={{ color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}
            formatter={(value: number) => [`${value}% ENERGY`, 'MOOD']}
          />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="#000" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#diagonalHatch)" 
            activeDot={{ r: 6, stroke: '#000', strokeWidth: 2, fill: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MoodChart;