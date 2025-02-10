import React, { useState, useEffect, useRef } from 'react';
import DonutChart from './DonutChart';
import { Card } from '@/components/ui/card';

interface DataItem {
  label: string;
  value: number;
}

const UseCaseChart = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Define dimensions based on container rather than window
  const [dimensions, setDimensions] = useState({
    width: 1200,
    height: 900
  });

  useEffect(() => {
    if (!containerRef.current) return;
  
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        // Use container dimensions while maintaining aspect ratio
        // const size = Math.min(containerWidth, containerHeight);
        setDimensions({
          width: containerWidth,
          height: containerHeight,
        });
      }
    };
  
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    updateDimensions();
  
    return () => observer.disconnect();
  }, []);

  // Use ResizeObserver for more reliable size tracking
  useEffect(() => {
    const container = document.getElementById('chart-container');
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        // Subtract padding and maintain aspect ratio
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
          // Process and aggregate use case data
          const useCases = jsonData.reduce((acc: any, entry: any) => {
            if (entry.use_case_multi_primary?.name) {
              const name = entry.use_case_multi_primary.name;
              acc[name] = (acc[name] || 0) + 1;
            }
            return acc;
          }, {});
          
          // Sort and format data
          const sortedData = Object.entries(useCases)
            .sort(([,a]: any, [,b]: any) => b - a)
            .map(([label, value]) => ({
              label: label.replace(/([A-Z])/g, ' $1').trim(), // Add spaces before capital letters
              value: value as number
            }));
          
          setData(sortedData);
          setError(null);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load use case data');
        // Fallback data
        setData([
          { label: 'Convert Visitors', value: 40 },
          { label: 'Improve Performance', value: 30 },
          { label: 'Data Driven Organization', value: 20 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Act-On brand color palette with complementary shades
  const colors = [
    '#194F90', // AO Blue
    '#1E5FAD', // Lighter blue
    '#00BABE', // AO Teal
    '#00D5D9', // Lighter teal
    '#C2D500', // AO Yellow
    '#D6EA00', // Lighter yellow
    '#FD4A5C', // AO Red
    '#FF6B7A', // Lighter red
    '#101820', // AO Black
    '#2A3542', // Lighter black
  ];

  if (loading) {
    return (
      <div className="w-full h-[90vh] flex items-center justify-center">
        <Card className="w-full h-full flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-ao-blue border-t-transparent rounded-full animate-spin" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[90vh] flex items-center justify-center">
        <Card className="w-full h-full flex items-center justify-center">
          <div className="text-center text-ao-red">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} 
                    className="mt-4 px-4 py-2 bg-ao-blue text-white rounded-md hover:bg-opacity-90">
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-[90vh] flex items-center justify-center" ref={containerRef}>
      <DonutChart
        data={data}
        width={dimensions.width}
        height={dimensions.height}
        colorRange={colors}
        title="Use Case Distribution"
      />
    </div>
  );
};

export default UseCaseChart;