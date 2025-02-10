import React from 'react';
import UseCaseChordChart from './UseCaseChordChart';

const RelationshipsChart = () => {
  // Add minimum dimensions to prevent negative values
  const minWidth = 1000;
  const minHeight = 800;
  
  return (
    <div className="w-full h-full min-w-[600px] min-h-[400px]">
      <UseCaseChordChart
        width={Math.max(window.innerWidth - 100, minWidth)}
        height={Math.max(window.innerHeight - 200, minHeight)}
        centerSize={30}
      />
    </div>
  );
};

export default RelationshipsChart;