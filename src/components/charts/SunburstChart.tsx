import React, { useEffect, useState, useRef, useMemo } from "react";
import { arc } from "@visx/shape";
import { scaleOrdinal } from "@visx/scale";
import { Group } from "@visx/group";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import {
  useSpring,
  useSprings,
  animated,
  config,
  useSpringRef,
  useChain,
  to,
} from "react-spring";
import { useCaseMapping } from "@/types/chart";

const AnimatedPath = animated.path;
const AnimatedText = animated(({ children, ...props }) => (
  <text {...props}>{children}</text>
));
const AnimatedGroup = animated(({ children, ...props }) => (
  <g {...props}>{children}</g>
));

const ZoomableSunburst = () => {
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const minSize = 750;
  const [dimensions, setDimensions] = useState({
    width: minSize,
    height: minSize,
  });

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip();
  const { TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  });

  const color = scaleOrdinal()
    .domain(["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"])
    .range(["#00BABE", "#E34E64", "#E2E41A", "#193661"]);

  // Create refs for animation sequencing
  const nodesSpringRef = useSpringRef();

  // Single spring for all nodes
  const nodesSpring = useSpring({
    ref: nodesSpringRef,
    from: { progress: 0 },
    to: { progress: 1 },
    config: {
      mass: 1,
      tension: 280,
      friction: 60,
    },
  });

  // Pre-calculate all node animations and store their configurations
  const { nodeConfigs, nodeMap } = useMemo(() => {
    if (!data) return { nodeConfigs: [], nodeMap: new Map() };

    const configs = [];
    const mapping = new Map();
    const radius =
      Math.min(dimensions.width, dimensions.height) / 2 - margin.top * 2;
    const ringWidths = [0.5, 0.25, 0.4, 0.4].map((w) => radius * w);

    function processNode(node, depth = 0) {
      const startRadius =
        depth === 0 ? 0 : ringWidths.slice(0, depth).reduce((a, b) => a + b, 0);
      const innerRadius = startRadius;
      const outerRadius = startRadius + ringWidths[depth];

      const key = `${node.name}-${depth}`;
      const index = configs.length;
      mapping.set(key, index);

      configs.push({
        from: {
          startAngle: node.startAngle,
          endAngle: node.startAngle,
          innerRadius: 0,
          outerRadius: 0,
          opacity: 0,
        },
        to: {
          startAngle: node.startAngle,
          endAngle: node.endAngle,
          innerRadius,
          outerRadius,
          opacity: 1,
        },
        config: {
          mass: 1,
          tension: 280,
          friction: 60,
        },
        delay: depth * 200,
      });

      if (node.children) {
        node.children.forEach((child) => processNode(child, depth + 1));
      }
    }

    if (data.root) {
      processNode(data.root);
    }

    return { nodeConfigs: configs, nodeMap: mapping };
  }, [data, dimensions]);

  // Create all springs at once using useSprings
  const springs = useSprings(
    nodeConfigs.length,
    nodeConfigs.map((config) => ({
      from: config.from,
      to: config.to,
      config: config.config,
      delay: config.delay,
    }))
  );

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
    window.addEventListener("resize", updateDimensions);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Data fetching and processing
  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/data");
        const rawData = await response.json();

        // Step 1: Calculate use case counts and angles
        const useCaseCounts = {};
        rawData.forEach((entry: any) => {
          const useCaseName = entry.use_case_multi_primary?.name;
          if (!useCaseName || !useCaseMapping[useCaseName]) return;
          useCaseCounts[useCaseName] = (useCaseCounts[useCaseName] || 0) + 1;
        });

        const totalUseCases = Object.values(useCaseCounts).reduce(
          (sum: number, count: number) => sum + count,
          0
        ) as number;

        // Calculate angles in radians for use cases
        const useCaseAngles = {};
        Object.entries(useCaseCounts).forEach(([name, count]) => {
          useCaseAngles[name] =
            ((count as number) / totalUseCases) * (2 * Math.PI);
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
              children: [],
            };
          }

          const group = cmoPriorityGroups[cmoPriorityKey];
          const angle = useCaseAngles[useCaseName];

          group.children.push({
            name: useCaseName,
            size: useCaseCounts[useCaseName],
            startAngle: currentAngle,
            endAngle: currentAngle + angle,
          });

          currentAngle += angle;
          group.endAngle = currentAngle;
        });

        // Step 3: Group by GET/KEEP/GROW/OPTIMIZE
        const categoryGroups = {};
        currentAngle = 0;

        // Sort categories to ensure consistent order
        ["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"].forEach((categoryKey) => {
          const categoryChildren = Object.values(cmoPriorityGroups)
            .filter((cmo: any) => cmo.category === categoryKey)
            .sort(
              (a: any, b: any) =>
                b.endAngle - b.startAngle - (a.endAngle - a.startAngle)
            );

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
                  children: cmo.children.map((child) => ({
                    ...child,
                    // also store categoryKey in each use-case child
                    categoryKey: categoryKey,
                    startAngle:
                      currentAngle +
                      ((child.startAngle - cmo.startAngle) /
                        (cmo.endAngle - cmo.startAngle)) *
                        cmoAngle,
                    endAngle:
                      currentAngle +
                      ((child.endAngle - cmo.startAngle) /
                        (cmo.endAngle - cmo.startAngle)) *
                        cmoAngle,
                  })),
                };

                currentAngle = cmoEndAngle;
                return node;
              }),
            };

            categoryGroups[categoryKey].endAngle = currentAngle;
          }
        });

        setData({
          root: {
            name: "",
            startAngle: 0,
            endAngle: 2 * Math.PI,
            children: Object.values(categoryGroups),
          },
          debugInfo: {
            totalUseCases,
            categorySummary: Object.fromEntries(
              Object.entries(categoryGroups).map(
                ([key, cat]: [string, any]) => [
                  key,
                  {
                    angleDegrees: (
                      ((cat.endAngle - cat.startAngle) * 180) /
                      Math.PI
                    ).toFixed(2),
                    children: cat.children.map((child) => ({
                      name: child.name,
                      angleDegrees: (
                        ((child.endAngle - child.startAngle) * 180) /
                        Math.PI
                      ).toFixed(2),
                      children: child.children.map((useCase) => ({
                        name: useCase.name,
                        angleDegrees: (
                          ((useCase.endAngle - useCase.startAngle) * 180) /
                          Math.PI
                        ).toFixed(2),
                      })),
                    })),
                  },
                ]
              )
            ),
          },
        });
      } catch (error) {
        console.error("Error loading data:", error);
        setError(
          error instanceof Error ? error.message : "Unknown error occurred"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  function getColorName(node, depth) {
    // if this is the root ring, we might do something else
    // or skip it entirely
    if (depth === 1) return node.name; // "1-GET", "2-KEEP", etc.
    if (depth === 2) return node.parent?.name; // "1-GET", etc.
    if (depth === 3) return node.parent?.parent?.name;
    return "";
  }

  // Effect to trigger animations after data loads
  useEffect(() => {
    if (data && !isVisible) {
      setIsVisible(true);
    }
  }, [data]);

  const rotationSpringRef = useSpringRef();
  const ring1SpringRef = useSpringRef();
  const ring2SpringRef = useSpringRef();
  const ring3SpringRef = useSpringRef();
  const ring4SpringRef = useSpringRef();

  // Spring for rotation
  const rotationSpring = useSpring({
    ref: rotationSpringRef,
    from: { rotation: -180 },
    to: { rotation: 0 },
    config: { tension: 280, friction: 60 },
  });

  // Springs for each ring's animation
  const ring1Spring = useSpring({
    ref: ring1SpringRef,
    from: { progress: 0, angle: 0 },
    to: { progress: 1, angle: 1 },
    config: { tension: 280, friction: 50 },
  });

  const ring2Spring = useSpring({
    ref: ring2SpringRef,
    from: { progress: 0, angle: 0 },
    to: { progress: 1, angle: 1 },
    config: { tension: 280, friction: 60 },
  });

  const ring3Spring = useSpring({
    ref: ring3SpringRef,
    from: { progress: 0, angle: 0 },
    to: { progress: 1, angle: 1 },
    config: { tension: 280, friction: 60 },
  });

  const ring4Spring = useSpring({
    ref: ring4SpringRef,
    from: { progress: 0, angle: 0 },
    to: { progress: 1, angle: 1 },
    config: { tension: 280, friction: 60 },
  });

  // Chain the animations in sequence
  useChain(
    [
      rotationSpringRef,
      ring1SpringRef,
      ring2SpringRef,
      ring3SpringRef,
      ring4SpringRef,
    ],
    [0, 0.2, 0.4, 0.65, 0.82]
  );

  function renderNode(node, depth = 0) {
    const angle = node.endAngle - node.startAngle;
    const angleInDegrees = (angle * 180) / Math.PI;

    if (angleInDegrees < 0.01) return null;

    const radius =
      Math.min(dimensions.width, dimensions.height) / 2 - margin.top * 2;
    const ringWidths = [0.07, 0.23, 0.4, 0.4].map((w) => radius * w);

    const springForDepth = [ring1Spring, ring2Spring, ring3Spring, ring4Spring][
      depth
    ];

    const baseRadius = ringWidths.slice(0, depth).reduce((a, b) => a + b, 0);
    const ringWidth = ringWidths[depth];

    const fillColor = color(node.categoryKey || "");
    const fillOpacity = node.children ? (depth === 1 ? 0.9 : 0.7) : 0.5;

    return (
      <AnimatedGroup key={`${node.name}-${depth}`}>
        <AnimatedPath
          fill={fillColor}
          fillOpacity={springForDepth.progress.to((p) => p * fillOpacity)}
          stroke="#1f2937"
          strokeWidth="1"
          style={{
            cursor: "pointer",
            filter: "none",
            transition: "filter 0.3s ease",
            // @ts-ignore
            d: to(
              [springForDepth.progress, springForDepth.angle],
              (progress, angle) => {
                const interpolatedStartAngle = node.startAngle;
                const interpolatedEndAngle =
                  depth === 0
                    ? node.endAngle
                    : node.startAngle +
                      (node.endAngle - node.startAngle) * angle;

                let currentStart = 0;
                for (let i = 0; i < depth; i++) {
                  const prevRingCurrentProgress = [
                    ring1Spring,
                    ring2Spring,
                    ring3Spring,
                    ring4Spring,
                  ][i].progress.get();
                  currentStart += ringWidths[i] * prevRingCurrentProgress;
                }

                const currentWidth = ringWidth * progress;

                return (
                  arc()({
                    innerRadius: currentStart,
                    outerRadius: currentStart + currentWidth,
                    startAngle: interpolatedStartAngle,
                    endAngle: interpolatedEndAngle,
                  }) || ""
                );
              }
            ),
          }}
          onMouseEnter={(e) => {
            e.target.style.filter =
              "brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.3))";
            const coords = localPoint(e.target.ownerSVGElement, e);
            showTooltip({
              tooltipLeft: coords?.x ?? 0,
              tooltipTop: coords?.y ?? 0,
              tooltipData: {
                name: node.name,
                size: node.size,
                angle: `${angleInDegrees.toFixed(2)}°`,
              },
            });
          }}
          onMouseLeave={(e) => {
            e.target.style.filter = "none";
            hideTooltip();
          }}
        />
        {angleInDegrees > (depth === 3 ? 3 : 5) && (
          <AnimatedGroup
            style={{
              opacity: to(
                [springForDepth.progress, springForDepth.angle],
                (progress, angle) => {
                  // Start fading in when the ring is 80% expanded and angle is 80% complete
                  const fadeThreshold = 0.8;
                  const fadeProgress = Math.min(
                    (progress - fadeThreshold) / (1 - fadeThreshold),
                    (angle - fadeThreshold) / (1 - fadeThreshold)
                  );
                  return Math.max(0, fadeProgress);
                }
              ),
              transform: to(
                [springForDepth.progress, springForDepth.angle],
                (progress, angle) => {
                  const [centroidX, centroidY] = arc().centroid({
                    innerRadius: baseRadius,
                    outerRadius: baseRadius + ringWidth * progress,
                    startAngle: node.startAngle,
                    endAngle:
                      depth === 0
                        ? node.endAngle
                        : node.startAngle +
                          (node.endAngle - node.startAngle) * angle,
                  });
                  const rotationAngle =
                    ((node.startAngle + node.endAngle * angle) / 2) *
                      (180 / Math.PI) -
                    90;
                  const isOnLeft = rotationAngle > 90 && rotationAngle < 270;
                  return `
                    translate(${centroidX}px, ${centroidY}px)
                    rotate(${rotationAngle}deg)
                    rotate(${isOnLeft ? 180 : 0}deg)
                  `;
                }
              ),
            }}
          >
            <AnimatedText
              dy=".35em"
              fontSize={depth === 1 ? 11 : depth === 2 ? 10 : 8}
              fill={depth === 1 ? "white" : depth === 2 ? "#1f2937" : "#374151"}
              textAnchor="middle"
              style={{
                pointerEvents: "none",
                fontWeight: depth === 1 ? "bold" : "normal",
              }}
            >
              {node.name.length > 25
                ? `${node.name.substring(0, 25)}...`
                : node.name}
              {node.size > 0 && (
                <tspan x="0" dy="1.1em" fontSize={8}>
                  ({node.size})
                </tspan>
              )}
            </AnimatedText>
          </AnimatedGroup>
        )}
        {node.children?.map((child) => renderNode(child, depth + 1))}
      </AnimatedGroup>
    );
  }

  if (loading)
    return (
      <div className="w-full h-full flex items-center justify-center">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500">
        Error: {error}
      </div>
    );
  if (!data)
    return (
      <div className="w-full h-full flex items-center justify-center">
        No data available
      </div>
    );

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full max-w-full min-w-[800px] min-h-[800px] h-screen bg-card rounded-xl shadow-lg p-8 flex items-center justify-center"
      >
        {/* @ts-ignore - Adding children prop to animated.g */}
        <animated.svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox={`${-dimensions.width / 2} ${-dimensions.height / 2} ${
            dimensions.width
          } ${dimensions.height}`}
          style={{
            maxWidth: "100%",
            height: "auto",
            transform: rotationSpring.rotation.to((r) => `rotate(${r}deg)`),
          }}
        >
          {renderNode(data.root)}
        </animated.svg>
      </div>
    </div>
  );
};

export default ZoomableSunburst;
