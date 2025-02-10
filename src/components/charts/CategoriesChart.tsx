import React, { useState, useEffect } from 'react';
import DonutChart from './DonutChart';
import { Card } from '@/components/ui/card';

interface DataItem {
  label: string;
  value: number;
}

const CategoriesChart = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({
    width: 900,
    height: 800
  });

  // Use ResizeObserver for reliable container-based sizing
  useEffect(() => {
    const container = document.getElementById('categories-container');
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width - 48;
        const height = Math.min(entry.contentRect.height - 48, width * 0.75);
        setDimensions({ width, height });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        
        if (response.ok) {
          // Process and aggregate category data
          const categories = jsonData.reduce((acc: any, entry: any) => {
            if (entry.ai_category) {
              // Clean and format category names
              const category = entry.ai_category
                .split('_')
                .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
              acc[category] = (acc[category] || 0) + 1;
            }
            return acc;
          }, {});
          
          // Sort and format data
          const sortedData = Object.entries(categories)
            .sort(([,a]: any, [,b]: any) => b - a)
            .map(([label, value]) => ({
              label,
              value: value as number
            }));
          
          setData(sortedData);
          setError(null);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load category data');
        // Fallback data
        setData([
          { label: 'Demand Generation', value: 45 },
          { label: 'Content Marketing', value: 35 },
          { label: 'Marketing Operations', value: 20 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Act-On brand color palette with marketing focus
  const colors = [
    '#00BABE', // AO Teal (Primary for marketing categories)
    '#00CECF', // Light teal
    '#194F90', // AO Blue
    '#1A5CA8', // Light blue
    '#C2D500', // AO Yellow
    '#D1E419', // Light yellow
    '#FD4A5C', // AO Red
    '#FF6B7A', // Light red
    '#101820', // AO Black
    '#2A3542', // Light black
  ];

  if (loading) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-ao-teal border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Loading category data...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full flex items-center justify-center">
        <div className="text-center text-ao-red">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-ao-teal text-white rounded-md hover:bg-opacity-90"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div id="categories-container" className="w-full h-full">
      <DonutChart
        data={data}
        width={dimensions.width}
        height={dimensions.height}
        colorRange={colors}
        title="Categories Distribution"
      />
    </div>
  );
};

export default CategoriesChart;