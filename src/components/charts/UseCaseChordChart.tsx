import React, { useState, useEffect, useMemo } from 'react';
import { Arc } from '@visx/shape';
import { Group } from '@visx/group';
import { Chord, Ribbon } from '@visx/chord';
import { scaleOrdinal } from '@visx/scale';

interface UseCaseRelationship {
  source: string;
  target: string;
  confidence: number;
  count: number;
}

interface UseCaseChordProps {
  width: number;
  height: number;
  centerSize?: number;
}

const UseCaseChordChart: React.FC<UseCaseChordProps> = ({
  width,
  height,
  centerSize = 20,
}) => {
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [connections, setConnections] = useState<number[]>([]);
  
  // Color palette
  const colors = [
	'#007B7F',
	'#00A3A7',
	'#00BABE',
	'#33CBD1',
	'#66DCE3',
	'#99EDF2',
	'#CCF8FA'
  ];  
  // Color palette
//   const colors = [
//     '#193661',
//     '#274C7F',
//     '#346194',
//     '#4175AA',
//     '#5C8BBA',
//     '#779FC9',
//     '#A2BCE0',
//     '#CCD8ED'
//   ];

  // Ensure minimum dimensions
  const minWidth = 600;
  const minHeight = 400;
  const safeWidth = Math.max(width, minWidth);
  const safeHeight = Math.max(height, minHeight);

  // Calculate chart dimensions
  const dimensions = useMemo(() => {
    const padding = 100;
    const legendWidth = 288; // w-72 = 18rem = 288px
    
    const adjustedHeight = safeHeight - padding;
    const availableWidth = safeWidth - legendWidth - padding;
    const chartWidth = availableWidth; // Use full available width
    
    // Ensure minimum chart size
    const minChartDimension = Math.min(chartWidth, adjustedHeight);
    const outerRadius = Math.max(minChartDimension * 0.35, 100); // Slightly reduced from 0.4
    const innerRadius = Math.max(outerRadius - centerSize, 70);
    
    return {
      adjustedHeight,
      chartWidth: availableWidth, // Use full available width
      outerRadius,
      innerRadius,
      // Add centerX to properly center the chart
      centerX: availableWidth / 2
    };
  }, [safeWidth, safeHeight, centerSize]);

  // Find connected segments when active segment changes
  useEffect(() => {
    if (activeSegment !== null && matrix.length > 0) {
      const connected = matrix[activeSegment]
        .map((value, index) => ({ value, index }))
        .filter(({ value }) => value > 0)
        .map(({ index }) => index);
      setConnections(connected);
    } else {
      setConnections([]);
    }
  }, [activeSegment, matrix]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data');
        const jsonData = await response.json();
        
        const useCases = new Set<string>();
        const relationships: UseCaseRelationship[] = [];
        
        jsonData.forEach((entry: any) => {
          if (entry.use_case_multi_primary) {
            const primary = entry.use_case_multi_primary.name;
            useCases.add(primary);
            
            if (entry.use_case_multi_addl) {
              entry.use_case_multi_addl.forEach((addl: any) => {
                useCases.add(addl.name);
                relationships.push({
                  source: primary,
                  target: addl.name,
                  confidence: addl.confidence,
                  count: 1
                });
              });
            }
          }
        });

        const useCaseArray = Array.from(useCases);
        setLabels(useCaseArray);
        
        const matrixSize = useCaseArray.length;
        const newMatrix = Array(matrixSize).fill(0).map(() => Array(matrixSize).fill(0));
        
        relationships.forEach(rel => {
          const sourceIdx = useCaseArray.indexOf(rel.source);
          const targetIdx = useCaseArray.indexOf(rel.target);
          if (sourceIdx !== -1 && targetIdx !== -1) {
            newMatrix[sourceIdx][targetIdx] += rel.confidence * rel.count;
            newMatrix[targetIdx][sourceIdx] += rel.confidence * rel.count;
          }
        });
        
        setMatrix(newMatrix);
      } catch (error) {
        console.error('Error loading data:', error);
        setMatrix([
          [11975, 5871, 8916],
          [1951, 10048, 2060],
          [8010, 16145, 8090],
        ]);
        setLabels(['Improve Marketing Performance', 'Scale Marketing Output', 'Personalize Communication']);
      }
    };
    
    fetchData();
  }, []);

  // Color scale
  const color = scaleOrdinal({
    domain: Array.from({ length: labels.length }, (_, i) => i),
    range: colors,
  });

  const getLabelPosition = (angle: number, isActive: boolean) => {
    const radius = dimensions.outerRadius + (isActive ? 40 : 30);
    const x = Math.cos(angle - Math.PI / 2) * radius;
    const y = Math.sin(angle - Math.PI / 2) * radius;
    return { x, y };
  };

  // Don't render if dimensions are too small
  if (width < minWidth || height < minHeight) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-muted-foreground">
          Viewport too small to display chart
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card rounded-xl shadow-lg p-8">
      <h3 className="text-xl font-semibold text-card-foreground mb-6 text-center">
        Use Case Relationships
      </h3>
      <div className="flex">
        <div className="flex-grow">
          <svg 
            width={dimensions.chartWidth} 
            height={dimensions.adjustedHeight}
            className="overflow-visible" // Allow labels to overflow
          >
            <Group top={dimensions.adjustedHeight / 2} left={dimensions.centerX}>
              <Chord matrix={matrix} padAngle={0.05}>
                {({ chords }) => (
                  <g>
                    {/* Ribbons rendered first (behind arcs) */}
                    {chords.map((chord, i) => (
                      <Ribbon
                        key={`ribbon-${i}`}
                        chord={chord}
                        radius={dimensions.innerRadius}
                        fill={color(chord.source.index)}
                        fillOpacity={0.75}
                        className="transition-opacity duration-200"
                        style={{
                          opacity: activeSegment === null || 
                            activeSegment === chord.source.index || 
                            activeSegment === chord.target.index ? 0.75 : 0.1
                        }}
                      />
                    ))}
                    
                    {/* Arcs rendered on top */}
                    {chords.groups.map((group, i) => (
                      <Arc
                        key={`arc-${i}`}
                        data={group}
                        innerRadius={dimensions.innerRadius}
                        outerRadius={dimensions.outerRadius}
                        fill={color(i)}
                        className="transition-opacity duration-200"
                        style={{
                          opacity: activeSegment === null || activeSegment === i ? 1 : 0.3
                        }}
                        onMouseEnter={() => setActiveSegment(i)}
                        onMouseLeave={() => setActiveSegment(null)}
                      />
                    ))}

                    {/* Dynamic labels */}
                    {chords.groups.map((group, i) => {
                      const angle = (group.startAngle + group.endAngle) / 2;
                      const isActive = activeSegment === i;
                      const isConnected = connections.includes(i);
                      const shouldShow = isActive || (activeSegment !== null && isConnected);
                      
                      if (!shouldShow) return null;

                      const { x, y } = getLabelPosition(angle, isActive);
                      const textAnchor = x > 0 ? "start" : "end";
                      const dx = x > 0 ? "0.5em" : "-0.5em";

                      return (
                        <g
                          key={`label-${i}`}
                          className="transition-opacity duration-200"
                          style={{ opacity: shouldShow ? 1 : 0 }}
                        >
                          <line
                            x1={Math.cos(angle - Math.PI / 2) * dimensions.outerRadius}
                            y1={Math.sin(angle - Math.PI / 2) * dimensions.outerRadius}
                            x2={x}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth={1}
                            opacity={0.5}
                          />
                          <text
                            x={x}
                            y={y}
                            dy=".35em"
                            textAnchor={textAnchor}
                            className={`text-sm fill-card-foreground ${isActive ? 'font-bold' : 'font-medium'}`}
                            dx={dx}
                          >
                            {labels[i]}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}
              </Chord>
            </Group>
          </svg>
        </div>

        <div className="w-72 p-6 bg-muted rounded-lg overflow-y-auto max-h-full">
          <div className="flex flex-col space-y-3">
            {labels.map((label, i) => (
              <div 
                key={label}
                className={`flex items-center p-2 rounded-md transition-colors cursor-pointer ${
                  activeSegment === i ? 'bg-muted/50' : ''
                }`}
                onMouseEnter={() => setActiveSegment(i)}
                onMouseLeave={() => setActiveSegment(null)}
              >
                <div 
                  className="w-4 h-4 mr-3 rounded-sm flex-shrink-0" 
                  style={{ backgroundColor: color(i) }}
                />
                <span className="text-card-foreground font-medium text-sm">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-muted-foreground/20">
            <p className="text-xs text-muted-foreground">
              Hover over segments to highlight relationships. 
              Labels show active use case and its connections.
              Ribbon thickness indicates relationship strength.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UseCaseChordChart;