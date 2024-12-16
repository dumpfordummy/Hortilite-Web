import React, { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip);

interface LineChartProps {
  labels: string[];
  data: number[];
  label: string;
}

const LineChart: React.FC<LineChartProps> = ({ labels, data, label }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            title: { display: true, text: 'Pixel Index' },
          },
          y: {
            title: { display: true, text: 'Green Pixel Value' },
          },
        },
      },
    });

    return () => {
      chart.destroy();
    };
  }, [labels, data, label]);

  return <canvas ref={chartRef} />;
};

export default LineChart;
