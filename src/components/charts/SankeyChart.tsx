import React, { useEffect, useState, useRef } from "react";
import { Sankey } from "@visx/sankey";
import { Group } from "@visx/group";
import { LinkHorizontal } from "@visx/shape";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { useCaseMapping } from "@/types/chart";
import { animated, useSpring, useTrail, config } from "@react-spring/web"; // Import config

type NodeDatum = {
  name: string;
  category?: string;
  nodeType: "category" | "priority" | "aiCategory" | "useCase";
  parentCategory?: string;
};

type LinkDatum = {
  source: number;
  target: number;
  value: number;
};

const EnhancedSankeyChart = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [data, setData] = useState<{
    nodes: NodeDatum[];
    links: LinkDatum[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip();

  const categoryColors = {
    "1-GET": "#00BABE",
    "2-KEEP": "#E34E64",
    "3-GROW": "#E2E41A",
    "4-OPTIMIZE": "#193661",
  };

  const getNodeOpacity = (nodeType: string) => {
    switch (nodeType) {
      case "category":
        return 0.9;
      case "priority":
        return 0.7;
      case "aiCategory":
        return 0.6;
      case "useCase":
        return 0.5;
      default:
        return 0.7;
    }
  };

  const getNodeBackground = (node: any) => {
    if (!node) return "#194F90";
    const category =
      node.nodeType === "category" ? node.name : node.parentCategory;
    if (!category || !categoryColors[category]) {
      return "#194F90";
    }
    return categoryColors[category];
  };

  const getLabelPosition = (node: any) => {
    switch (node.nodeType) {
      case "priority":
        return {
          x: node.x0 - 8,
          anchor: "end",
        };
      case "aiCategory":
        return {
          x: node.x1 + 8,
          anchor: "start",
        };
      case "category":
        return {
          x: node.x0 < dimensions.width / 2 ? node.x1 + 8 : node.x0 - 8,
          anchor: node.x0 < dimensions.width / 2 ? "start" : "end",
        };
      case "useCase":
        return {
          x: node.x0 < dimensions.width / 2 ? node.x1 + 8 : node.x0 - 8,
          anchor: node.x0 < dimensions.width / 2 ? "start" : "end",
        };
      default:
        return {
          x: node.x0 < dimensions.width / 2 ? node.x1 + 8 : node.x0 - 8,
          anchor: node.x0 < dimensions.width / 2 ? "start" : "end",
        };
    }
  };

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Faster, more concurrent spring config
  const springConfig = prefersReducedMotion
    ? { immediate: true }
    : { tension: 250, friction: 25, mass: 0.8 }; //  Faster, but still smooth

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(rect.width - 48, 800),
          height: Math.max(rect.height - 48, 600),
        });
      }
    };

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch("/api/data");
        const rawData = await res.json();

        const nodes: NodeDatum[] = [];
        const nodeIndices: Record<string, number> = {};
        const links: LinkDatum[] = [];

        const categories = ["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"];
        categories.forEach((cat) => {
          nodeIndices[cat] = nodes.length;
          nodes.push({ name: cat, nodeType: "category", parentCategory: cat });
        });

        const hierarchy: Record<
          string,
          {
            count: number;
            aiCategories: Record<
              string,
              {
                count: number;
                useCaseCounts: Record<string, number>;
              }
            >;
            category: string;
            useCases: Record<string, number>;
          }
        > = {};

        rawData.forEach((d: any) => {
          const useCaseName = d.use_case_multi_primary?.name;
          if (!useCaseName || !useCaseMapping[useCaseName]) return;

          const mapping = useCaseMapping[useCaseName];
          const category = mapping.getKeepGrow;
          const priority = mapping.cmoPriority;
          const aiCategory = d.ai_category;

          if (!category || !priority || !aiCategory) return;

          if (!hierarchy[priority]) {
            hierarchy[priority] = {
              count: 0,
              aiCategories: {},
              category,
              useCases: {},
            };
          }

          hierarchy[priority].useCases[useCaseName] =
            (hierarchy[priority].useCases[useCaseName] || 0) + 1;
          hierarchy[priority].count++;

          if (!hierarchy[priority].aiCategories[aiCategory]) {
            hierarchy[priority].aiCategories[aiCategory] = {
              count: 0,
              useCaseCounts: {},
            };
          }

          hierarchy[priority].aiCategories[aiCategory].useCaseCounts[
            useCaseName
          ] =
            (hierarchy[priority].aiCategories[aiCategory].useCaseCounts[
              useCaseName
            ] || 0) + 1;
          hierarchy[priority].aiCategories[aiCategory].count++;
        });

        Object.entries(hierarchy).forEach(([priority, priorityData]) => {
          if (!nodeIndices[priority]) {
            nodeIndices[priority] = nodes.length;
            nodes.push({
              name: priority,
              nodeType: "priority",
              parentCategory: priorityData.category,
            });
          }

          links.push({
            source: nodeIndices[priorityData.category],
            target: nodeIndices[priority],
            value: priorityData.count,
          });

          Object.entries(priorityData.useCases).forEach(
            ([useCaseName, count]) => {
              if (!nodeIndices[useCaseName]) {
                nodeIndices[useCaseName] = nodes.length;
                nodes.push({
                  name: useCaseName,
                  nodeType: "useCase",
                  parentCategory: priorityData.category,
                });
              }

              links.push({
                source: nodeIndices[priority],
                target: nodeIndices[useCaseName],
                value: count,
              });
            }
          );

          Object.entries(priorityData.aiCategories).forEach(
            ([aiCategory, aiData]) => {
              if (!nodeIndices[aiCategory]) {
                nodeIndices[aiCategory] = nodes.length;
                nodes.push({
                  name: aiCategory,
                  nodeType: "aiCategory",
                  parentCategory: priorityData.category,
                });
              }

              Object.entries(aiData.useCaseCounts).forEach(
                ([useCaseName, count]) => {
                  links.push({
                    source: nodeIndices[useCaseName],
                    target: nodeIndices[aiCategory],
                    value: count,
                  });
                }
              );
            }
          );
        });

        setData({ nodes, links });
      } catch (err: any) {
        setError(err.message || "Error loading data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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

  const { width, height } = dimensions;

  const sankeySettings = {
    nodeWidth: 20,
    nodePadding: 8,
    size: [width - 160, height - 60],
    nodeSort: (a: any, b: any) => {
      if (a.nodeType === b.nodeType) {
        if (a.nodeType === "category") {
          const order = ["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"];
          return order.indexOf(a.name) - order.indexOf(b.name);
        }
        return b.value - a.value;
      }
      return 0;
    },
  };

  const customNodeAlign = (node: NodeDatum) => {
    switch (node.nodeType) {
      case "category":
        return 0;
      case "priority":
        return 1;
      case "useCase":
        return 2;
      case "aiCategory":
        return 3;
      default:
        return 0;
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[600px] bg-card rounded-xl shadow-lg p-6"
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        <Group top={30} left={80}>
          {/* @ts-ignore */}
          <Sankey<NodeDatum, LinkDatum>
            root={data}
            {...sankeySettings}
            nodeAlign={customNodeAlign}
          >
            {({ graph, createPath }) => {
              // Animation for links -  shorter delay, and calculated based on index
              // @ts-ignore
              const linkAnimations = useTrail(graph.links.length, {
                from: { strokeDashoffset: 1000, opacity: 0 },
                to: { strokeDashoffset: 0, opacity: 0.25 },
                config: springConfig,
                delay: (i: number) => i * 5 + 100, //  Staggered, but very quick.
              });

              // Animation for nodes - Shorter delay, calculated, less vertical movement
              // @ts-ignore
              const nodeAnimations = useTrail(graph.nodes.length, {
                from: { opacity: 0, transform: "translateY(10px)" }, //  Less vertical movement
                to: { opacity: 1, transform: "translateY(0px)" },
                config: springConfig,
                delay: (i: number) => i * 10 + 300, // Staggered, starts after links have begun.
              });

              return (
                <>
                  {graph.links.map((link, i) => {
                    // @ts-ignore
                    const { strokeDashoffset, opacity } = linkAnimations[i];
                    return (
                      <g key={`link-${i}`}>
                        <animated.path
                          // @ts-ignore
                          d={createPath(link)}
                          stroke={getNodeBackground(link.source)}
                          strokeOpacity={opacity}
                          strokeWidth={Math.max(1, link.width)}
                          fill="none"
                          style={{
                            strokeDasharray: 1000,
                            strokeDashoffset,
                            transition: "all 0.8s ease", // Add transition for smooth hover effect
                          }}
                          onMouseMove={(e) => {
                            const coords = localPoint(
                              e.target.ownerSVGElement,
                              e
                            );
                            showTooltip({
                              tooltipLeft: coords?.x,
                              tooltipTop: coords?.y,
                              // @ts-ignore
                              tooltipData: `${link.source.name} → ${link.target.name}: ${link.value}`,
                            });
                          }}
                          onMouseLeave={hideTooltip}
                          // Add hover styles using inline styles (most straightforward for this case)
                          onMouseEnter={(e) => {
                            e.target.style.filter =
                              "brightness(1.2) drop-shadow(0 0 8px rgba(255,255,255,0.3))";

                            e.currentTarget.style.strokeOpacity = "0.6"; // Increase opacity on hover
                            e.currentTarget.style.cursor = "pointer"; // Change cursor to pointer
                          }}
                          onMouseOut={(e) => {
                            e.target.style.filter = "none";

                            e.currentTarget.style.strokeOpacity = opacity.get(); // Reset opacity on mouse out. opacity is an animated value
                          }}
                        />
                      </g>
                    );
                  })}
                  {graph.nodes.map((node, i) => {
                    const labelPos = getLabelPosition(node);
                    // @ts-ignore
                    const { opacity, transform } = nodeAnimations[i];
                    return (
                      <Group key={`node-${i}`}>
                        <animated.rect
                          // @ts-ignore
                          x={node.x0}
                          y={node.y0}
                          width={node.x1 - node.x0}
                          height={node.y1 - node.y0}
                          fill={getNodeBackground(node)}
                          opacity={opacity.to(
                            (o) => o * getNodeOpacity(node.nodeType)
                          )}
                          style={{ transform }}
                          onMouseMove={(e) => {
                            const coords = localPoint(
                              e.target.ownerSVGElement,
                              e
                            );
                            showTooltip({
                              tooltipLeft: coords?.x,
                              tooltipTop: coords?.y,
                              tooltipData: `${node.name}\nTotal: ${node.value}`,
                            });
                          }}
                          onMouseLeave={hideTooltip}
                        />
                        {/* @ts-ignore */}
                        <animated.text
                          x={labelPos.x}
                          y={(node.y1 + node.y0) / 2}
                          dy=".35em"
                          fontSize={10}
                          textAnchor={labelPos.anchor}
                          fill="#101820"
                          style={{ opacity, pointerEvents: "none" }}
                        >
                          {node.name}
                        </animated.text>
                      </Group>
                    );
                  })}
                </>
              );
            }}
          </Sankey>
        </Group>
      </svg>
      {tooltipOpen && tooltipData && (
        // @ts-ignore
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          className="bg-white p-2 rounded shadow-lg text-sm"
        >
          {/* @ts-ignore */}
          {tooltipData}
        </TooltipWithBounds>
      )}
    </div>
  );
};

export default EnhancedSankeyChart;
