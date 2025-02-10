import React, { useEffect, useState, useRef, useMemo } from 'react';
import { arc } from "@visx/shape";
import { scaleOrdinal } from "@visx/scale";
import { Group } from "@visx/group";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { useSpring, useSprings, animated, config, useSpringRef, useChain } from 'react-spring';
import { useCaseMapping } from '@/types/chart';

const AnimatedPath = animated.path;
const AnimatedGroup = animated.g;

const TOTAL_ANIMATION_DURATION = 2000; // 2 seconds total animation
const ROTATION_DURATION = 1600; // rotation lasts 1.8 seconds



const ZoomableSunburst = () => {
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const minSize = 800;
  const [dimensions, setDimensions] = useState({ width: minSize, height: minSize });
  
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip();
  const { TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true
  });
  
  const color = scaleOrdinal()
    .domain(['1-GET', '2-KEEP', '3-GROW', '4-OPTIMIZE'])
    .range(['#00BABE', '#E34E64', '#E2E41A', '#193661']);

  // Create refs for animation sequencing


  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const size = Math.min(
          Math.max(width - margin.left - margin.right, minSize),
          Math.max(height - margin.top - margin.bottom, minSize)
        );
        setDimensions({ width: size, height: size });
      }
    };

    // Initial size calculation with delay to ensure container is properly rendered
    const timeoutId = setTimeout(updateDimensions, 0);
    
    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Data fetching and processing
  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/data');
        const rawData = await response.json();

        // Step 1: Calculate use case counts and angles
        const useCaseCounts = {};
        rawData.forEach((entry: any) => {
          const useCaseName = entry.use_case_multi_primary?.name;
          if (!useCaseName || !useCaseMapping[useCaseName]) return;
          useCaseCounts[useCaseName] = (useCaseCounts[useCaseName] || 0) + 1;
        });

        const totalUseCases = Object.values(useCaseCounts)
          .reduce((sum: number, count: number) => sum + count, 0);

        // Calculate angles in radians for use cases
        const useCaseAngles = {};
        Object.entries(useCaseCounts).forEach(([name, count]) => {
          useCaseAngles[name] = (count as number) / totalUseCases * (2 * Math.PI);
        });

        // Step 2: Group by CMO Priority with cumulative angles
        const cmoPriorityGroups = {};
        let currentAngle = 0;

        Object.entries(useCaseMapping).forEach(([useCaseName, mapping]) => {
          if (!useCaseCounts[useCaseName]) return;
          
          const cmoPriorityKey = mapping.cmoPriority;
          const categoryKey = mapping.getKeepGrow;
          
          if (!cmoPriorityGroups[cmoPriorityKey]) {
            cmoPriorityGroups[cmoPriorityKey] = {
              name: cmoPriorityKey,
              category: categoryKey,
              startAngle: currentAngle,
              children: []
            };
          }

          const group = cmoPriorityGroups[cmoPriorityKey];
          const angle = useCaseAngles[useCaseName];
          
          group.children.push({
            name: useCaseName,
            size: useCaseCounts[useCaseName],
            startAngle: currentAngle,
            endAngle: currentAngle + angle
          });
          
          currentAngle += angle;
          group.endAngle = currentAngle;
        });

        // Step 3: Group by GET/KEEP/GROW/OPTIMIZE
        const categoryGroups = {};
        currentAngle = 0;

        // Sort categories to ensure consistent order
        ['1-GET', '2-KEEP', '3-GROW', '4-OPTIMIZE'].forEach(categoryKey => {
          const categoryChildren = Object.values(cmoPriorityGroups)
            .filter((cmo: any) => cmo.category === categoryKey)
            .sort((a: any, b: any) => (b.endAngle - b.startAngle) - (a.endAngle - a.startAngle));

          if (categoryChildren.length > 0) {
            categoryGroups[categoryKey] = {
              name: categoryKey,
              categoryKey: categoryKey,
              startAngle: currentAngle,
              children: categoryChildren.map((cmo: any) => {
                const cmoAngle = cmo.endAngle - cmo.startAngle;
                const cmoEndAngle = currentAngle + cmoAngle;
            
                const node = {
                  name: cmo.name,
                  startAngle: currentAngle,
                  endAngle: cmoEndAngle,
                  // store the categoryKey here
                  categoryKey: categoryKey,
                  children: cmo.children.map(child => ({
                    ...child,
                    // also store categoryKey in each use-case child
                    categoryKey: categoryKey,
                    startAngle: currentAngle + (
                      (child.startAngle - cmo.startAngle) / (cmo.endAngle - cmo.startAngle) * cmoAngle
                    ),
                    endAngle: currentAngle + (
                      (child.endAngle - cmo.startAngle) / (cmo.endAngle - cmo.startAngle) * cmoAngle
                    )
                  }))
                };
            
                currentAngle = cmoEndAngle;
                return node;
              })
            };
            
            categoryGroups[categoryKey].endAngle = currentAngle;
          }
        });

        setData({
          root: {
            name: "",
            startAngle: 0,
            endAngle: 2 * Math.PI,
            children: Object.values(categoryGroups)
          },
          debugInfo: {
            totalUseCases,
            categorySummary: Object.fromEntries(
              Object.entries(categoryGroups).map(([key, cat]: [string, any]) => [
                key,
                {
                  angleDegrees: ((cat.endAngle - cat.startAngle) * 180 / Math.PI).toFixed(2),
                  children: cat.children.map(child => ({
                    name: child.name,
                    angleDegrees: ((child.endAngle - child.startAngle) * 180 / Math.PI).toFixed(2),
                    children: child.children.map(useCase => ({
                      name: useCase.name,
                      angleDegrees: ((useCase.endAngle - useCase.startAngle) * 180 / Math.PI).toFixed(2)
                    }))
                  }))
                }
              ])
            )
          }
        });
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  function getColorName(node, depth) {
    // if this is the root ring, we might do something else
    // or skip it entirely
    if (depth === 1) return node.name;             // "1-GET", "2-KEEP", etc.
    if (depth === 2) return node.parent?.name;     // "1-GET", etc.
    if (depth === 3) return node.parent?.parent?.name; 
    return '';  
  }


  // Effect to trigger animations after data loads
  useEffect(() => {
    if (data && !isVisible) {
      setIsVisible(true);
    }
  }, [data]);

  // Create spring refs for animation sequencing
  const rotationSpringRef = useSpringRef();
  const segmentsSpringRef = useSpringRef();

  // Rotation spring with longer duration
// Rotation spring with slower, non-linear motion
const rotationSpring = useSpring({
  ref: rotationSpringRef,
  from: { rotation: -90 }, // Start with 2 full rotations
  to: { rotation: 0 },
  config: {
    duration: ROTATION_DURATION,
    easing: t => {
      // Slow down in middle, speed up at end
      return 1 - Math.pow(Math.cos((t * Math.PI) / 2), 2);
    }
  }
});


  // Pre-calculate all node configurations
  const { nodeConfigs, nodeMap } = useMemo(() => {
    if (!data) return { nodeConfigs: [], nodeMap: new Map() };

    const configs = [];
    const mapping = new Map();
    let index = 0;

    function processNode(node, depth = 0) {
      if (!node) return;
      
      const key = `${node.name}-${depth}`;
      mapping.set(key, index++);

      // Scale delays to fit within animation duration
      const baseDelay = depth * 200; // Delay between rings
      
      const ringTotalSegments = data.root.children
        .reduce((count, cat) => count + (depth === 1 ? 1 : 
          depth === 2 ? cat.children.length : 
          depth === 3 ? cat.children.reduce((sum, cmo) => sum + cmo.children.length, 0) : 0), 0);
      
      const segmentIndex = mapping.get(key) % ringTotalSegments;
      const segmentDelay = (segmentIndex / ringTotalSegments) * 150;

      configs.push({
        depth,
        delay: baseDelay + segmentDelay,
        node
      });

      if (node.children) {
        node.children.forEach(child => processNode(child, depth + 1));
      }
    }

    if (data.root) {
      processNode(data.root);
    }

    return { nodeConfigs: configs, nodeMap: mapping };
  }, [data]);

  // Create springs for segments
  const springs = useSprings(
    nodeConfigs.length,
    nodeConfigs.map(({ depth, delay, node }) => ({
      ref: segmentsSpringRef,
      from: { 
        progress: 0,
        opacity: 0
      },
      to: { 
        progress: 1,
        opacity: depth === 0 ? 0 : 1
      },
      delay,
      config: {
        mass: 1,
        tension: 280,
        friction: 60
      }
    }))
  );

  useChain(
    [segmentsSpringRef, rotationSpringRef],
    [0, 0],
    [TOTAL_ANIMATION_DURATION * 0.7, ROTATION_DURATION]
  );

  function renderNode(node, depth = 0) {
    const angle = node.endAngle - node.startAngle;
    const angleInDegrees = (angle * 180) / Math.PI;
    
    if (angleInDegrees < 0.01) return null;

    const radius = Math.min(dimensions.width, dimensions.height) / 2 - margin.top * 2;
    const ringWidths = [0.1, 0.2, 0.4, 0.4].map(w => radius * w);
    const startRadius = depth === 0 ? 0 : ringWidths.slice(0, depth).reduce((a, b) => a + b, 0);
    const innerRadius = startRadius;
    const outerRadius = startRadius + ringWidths[depth];

    const springIndex = nodeMap.get(`${node.name}-${depth}`);
    if (springIndex === undefined) return null;

    const spring = springs[springIndex];
    const fillColor = color(node.categoryKey || '');
    const fillOpacity = node.children
      ? (depth === 1 ? 0.9 : 0.7)
      : 0.5;

    return (
      <AnimatedGroup key={`${node.name}-${depth}`}>
        <AnimatedPath
          d={spring.progress.to(progress => {
            // Keep angles fixed, only animate the outer radius
            return arc()({
              innerRadius,
              outerRadius: innerRadius + ((outerRadius - innerRadius) * progress),
              startAngle: node.startAngle,
              endAngle: node.endAngle
            }) || '';
          })}
          fill={fillColor}
          fillOpacity={spring.opacity.to(o => o * fillOpacity)}
          stroke="#1f2937"
          strokeWidth="1"
          strokeOpacity={spring.progress}
          onMouseEnter={(e) => {
            const coords = localPoint(e.target.ownerSVGElement, e);
            showTooltip({
              tooltipLeft: coords?.x ?? 0,
              tooltipTop: coords?.y ?? 0,
              tooltipData: {
                name: node.name,
                size: node.size,
                angle: `${angleInDegrees.toFixed(2)}°`
              }
            });
          }}
          onMouseLeave={hideTooltip}
          className="transition-opacity duration-200 hover:opacity-80"
        />
        {angleInDegrees > (depth === 3 ? 3 : 5) && (
          <AnimatedGroup
            style={{
              opacity: spring.progress,
              transform: spring.progress.to(progress => {
                const midRadius = innerRadius + ((outerRadius - innerRadius) * progress * 0.5);
                const [centroidX, centroidY] = arc().centroid({
                  innerRadius: midRadius,
                  outerRadius: midRadius,
                  startAngle: node.startAngle,
                  endAngle: node.endAngle
                });
                const rotationAngle = ((node.startAngle + node.endAngle) / 2) * (180 / Math.PI) - 90;
                const isOnLeft = rotationAngle > 90 && rotationAngle < 270;
                return `
                  translate(${centroidX}px, ${centroidY}px)
                  rotate(${rotationAngle}deg)
                  rotate(${isOnLeft ? 180 : 0}deg)
                `;
              })
            }}
          >
            <text
              dy=".35em"
              fontSize={depth === 1 ? 14 : depth === 2 ? 12 : 9}
              fill={depth === 1 ? 'white' : depth === 2 ? '#1f2937' : '#374151'}
              textAnchor="middle"
              style={{
                pointerEvents: 'none',
                fontWeight: depth === 1 ? 'bold' : 'normal'
              }}
            >
              <tspan>
                {node.name.length > 25 
                  ? `${node.name.substring(0, 25)}...` 
                  : node.name}
              </tspan>
              {node.size > 0 && (
                <tspan x="0" dy="1.1em" fontSize={8}>
                  ({node.size})
                </tspan>
              )}
            </text>
          </AnimatedGroup>
        )}
        {node.children?.map(child => renderNode(child, depth + 1))}
      </AnimatedGroup>
    );
  }

  // ... (keep existing render logic) ...

return (
  <div className="w-full h-full flex items-center justify-center">
    <div 
      ref={containerRef} 
      className="relative w-full max-w-full min-w-[800px] min-h-[800px] h-screen bg-card rounded-xl shadow-lg p-8 flex items-center justify-center"
    >
      {data && (
        <animated.svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`${-dimensions.width/2} ${-dimensions.height/2} ${dimensions.width} ${dimensions.height}`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            transform: rotationSpring.rotation.to(r => `rotate(${r}deg)`)
          }}
        >
          {renderNode(data.root)}
        </animated.svg>
      )}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          className="bg-white p-2 rounded shadow-lg text-sm"
        >
          <div className="font-bold">{tooltipData.name}</div>
          <div>Count: {tooltipData.size}</div>
          <div>Angle: {tooltipData.angle}</div>
        </TooltipInPortal>
      )}
    </div>
  </div>
  );
};

export default ZoomableSunburst;