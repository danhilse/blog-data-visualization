import React, { useState, useEffect, useMemo, useRef } from "react";
import { Group } from "@visx/group";
import { Treemap, hierarchy } from "@visx/hierarchy";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { Text } from "@visx/text";
import { animated, useSpring, useTrail, config } from "@react-spring/web";
import { ExternalLink, X } from "lucide-react";
import _ from "lodash";
import { useCaseMapping } from "@/types/chart";

const METRICS = {
  "Total Users": "total_users",
  Sessions: "sessions",
  "Page Views": "views",
  "Engagement Rate": "engagement_rate",
  "Avg Session Duration": "avg_session_duration",
  "Bounce Rate": "bounce_rate",
};

const AnimatedRect = animated.rect;
const AnimatedGroup = animated(Group);

const RadialMetricWheel = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightedCluster, setHighlightedCluster] = useState<string | null>(
    null
  );
  const [selectedNode, setSelectedNode] = useState<{
    name: string;
    useCase: string;
    url?: string;
    [key: string]: any;
  } | null>(null);
  const [sizeMetric, setSizeMetric] = useState("sessions");
  const [opacityMetric, setOpacityMetric] = useState("engagement_rate");
  const tooltipTimeoutRef = useRef(null);
  const [isHoveringCluster, setIsHoveringCluster] = useState(false);
  const chartRef = useRef(null);

  const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  const handleCloseTooltip = () => {
    setSelectedNode(null);
    setHighlightedCluster(null);
    hideTooltip();
  };

  const handleChartMouseEnter = () => {
    // Optional: Reset any lingering states when re-entering the chart
  };

  // Fix the chart mouse leave handler
  const handleChartMouseLeave = () => {
    setHighlightedCluster(null);
    if (!selectedNode) {
      setIsHoveringCluster(false);
    }
  };

  const handleNodeClick = (node, event) => {
    event.stopPropagation();
    if (selectedNode?.name === node.name) {
      setSelectedNode(null);
      hideTooltip();
      setHighlightedCluster(null);
    } else {
      setSelectedNode(node);
      setHighlightedCluster(node.useCase);
      const rect = event.target.getBoundingClientRect();
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      showTooltip({
        tooltipLeft: rect.right + 10,
        tooltipTop: rect.top + scrollTop,
        tooltipData: node,
      });
    }
  };

  const handleMouseEnter = (node) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setIsHoveringCluster(true);
    setHighlightedCluster(node.useCase);
  };

  const handleMouseLeave = () => {
    if (!selectedNode) {
      setIsHoveringCluster(false);
      tooltipTimeoutRef.current = setTimeout(() => {
        if (!isHoveringCluster) {
          setHighlightedCluster(null);
        }
      }, 100);
    }
  };

  const handleTooltipMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setIsHoveringCluster(true);
  };

  const handleTooltipMouseLeave = () => {
    setIsHoveringCluster(false);
    // Check if we're leaving the entire chart area
    if (!chartRef.current?.contains(document.activeElement)) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setHighlightedCluster(null);
        if (!selectedNode) {
          hideTooltip();
        }
      }, 100);
    }
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);
  const colors = {
    get: "#00BABE",
    keep: "#FD4A5C",
    grow: "#C2D500",
    optimize: "#194F90",
    background: "#EEF3FA",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        setRawData(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateOpacity = (value, metric, allValues) => {
    if (value == null) return 0.1;

    const values = allValues
      .filter((analytics) => analytics && analytics[metric] != null)
      .map((analytics) => analytics[metric]);

    if (values.length === 0) return 0.1;

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) return 0.8;

    if (metric === "engagement_rate" || metric === "bounce_rate") {
      return 0.2 + 0.8 * value;
    }

    return 0.2 + (0.8 * (value - min)) / (max - min);
  };

  const processedData = useMemo(() => {
    if (!rawData.length) return null;

    const allAnalytics = rawData
      .map((entry) => entry.analytics)
      .filter(Boolean);

    const groupedData = _.chain(rawData)
      .filter((entry) => {
        const useCaseName = entry.use_case_multi_primary?.name;
        // Use the mapping to ensure we have a valid category
        return useCaseName && useCaseMapping[useCaseName];
      })
      .groupBy((entry) => entry.use_case_multi_primary.name)
      .map((articles, useCase) => ({
        name: useCase,
        children: articles.map((article) => ({
          name: article.title,
          url: article.url,
          // Use the mapping to get the correct category
          category: useCaseMapping[useCase].getKeepGrow,
          useCase,
          ...(article.analytics || {}),
          opacityValue: calculateOpacity(
            article.analytics?.[opacityMetric],
            opacityMetric,
            allAnalytics
          ),
        })),
      }))
      .value();

    return {
      name: "Use Cases",
      children: groupedData,
    };
  }, [rawData, opacityMetric]);

  const root = useMemo(() => {
    if (!processedData) return null;
    return hierarchy(processedData)
      .sum((d) => d[sizeMetric] || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [processedData, sizeMetric]);

  const calculateDelay = (node, maxDepth) => {
    const centerX = 600;
    const centerY = dynamicHeight / 2;
    const dx = (node.x0 + node.x1) / 2 - centerX;
    const dy = (node.y0 + node.y1) / 2 - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    return (distance / maxDistance) * 800;
  };

  const getColor = (category) => {
    const colorMap = {
      "1-GET": colors.get,
      "2-KEEP": colors.keep,
      "3-GROW": colors.grow,
      "4-OPTIMIZE": colors.optimize,
    };
    return colorMap[category];
  };

  const renderNode = (node, i, maxDepth) => {
    if (!node.children) {
      const width = node.x1 - node.x0;
      const height = node.y1 - node.y0;
      const data = node.data;
      const isHighlighted = highlightedCluster === data.useCase;
      const isClusterFaded = highlightedCluster && !isHighlighted;
      const isSelected = selectedNode?.name === data.name;
      const baseOpacity = data.opacityValue;
      const fadeOpacity = isClusterFaded ? 0.3 : 1;
      const finalOpacity = baseOpacity * fadeOpacity;

      const delay = calculateDelay(node, maxDepth);

      const springProps = useSpring({
        from: {
          width: 0,
          height: 0,
          x: node.x0 + width / 2,
          y: node.y0 + height / 2,
          opacity: 0,
          scale: 0,
        },
        to: {
          width,
          height,
          x: node.x0,
          y: node.y0,
          opacity: finalOpacity,
          scale: 1,
        },
        delay,
        config: {
          tension: 300,
          friction: 20,
          mass: 1,
        },
      });

      return (
        <AnimatedGroup
          key={`node-${i}`}
          style={{
            transform: springProps.scale.to((s) => `scale(${s})`),
            transformOrigin: `${node.x0 + width / 2}px ${
              node.y0 + height / 2
            }px`,
          }}
        >
          <AnimatedRect
            // @ts-ignore
            width={springProps.width}
            height={springProps.height}
            x={springProps.x}
            y={springProps.y}
            opacity={springProps.opacity}
            stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
            strokeWidth={isSelected ? 2 : 1}
            fill={getColor(data.category)}
            onClick={(e) => handleNodeClick(data, e)}
            onMouseEnter={() => handleMouseEnter(data)}
            onMouseLeave={handleMouseLeave}
            style={{
              cursor: "pointer",
              filter: isHighlighted
                ? "brightness(1.1) drop-shadow(0 0 8px rgba(255,255,255,0.3))"
                : "none",
              transition: "filter 0.3s ease",
            }}
          />
          {width > 40 && height > 40 && (
            // @ts-ignore
            <animated.g
              style={{
                opacity: springProps.opacity,
                transform: springProps.scale.to(
                  (s) =>
                    `translate(${node.x0 + width / 2}px, ${
                      node.y0 + height / 2
                    }px) scale(${s})`
                ),
              }}
            >
              {/* @ts-ignore */}
              <Text
                x={0}
                y={0}
                width={width - 4}
                verticalAnchor="middle"
                textAnchor="middle"
                fontSize={Math.min(12, width / 12)}
                fill="#ffffff"
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {data.name.substring(0, 30)}
                {data.name.length > 30 ? "..." : ""}
              </Text>
            </animated.g>
          )}
        </AnimatedGroup>
      );
    }
    return null;
  };

  const Legend = () => (
    <div className="flex justify-between items-end mb-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          {["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"].map((category) => (
            <div key={category} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getColor(category) }}
              ></div>
              <span className="text-sm">{category}</span>
            </div>
          ))}
        </div>
        <div className="text-sm">
          {highlightedCluster || (
            <span className="font-light opacity-60 italic">
              Hover over a tile to see the use case
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <MetricSelector
          value={sizeMetric}
          onChange={setSizeMetric}
          label="Size By"
        />
        <MetricSelector
          value={opacityMetric}
          onChange={setOpacityMetric}
          label="Opacity By"
        />
      </div>
    </div>
  );

  const CustomTooltip = ({ data }) => {
    if (!data) return null;

    return (
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-72 overflow-hidden relative"
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      >
        {/* Close button */}
        <button
          onClick={handleCloseTooltip}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={16} className="text-white" />
        </button>

        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-[#101820] text-white hover:bg-[#123c6e] transition-colors"
        >
          <div className="text-[#EEF3FA] p-4">
            <div className="hover:underline cursor-pointer pr-6">
              <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                {data.name}
                <ExternalLink size={16} className="inline-block" />
              </h3>
            </div>
            <p className="text-sm opacity-90">{data.useCase}</p>
          </div>
        </a>

        {/* Metrics */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="font-semibold">
                {data.total_users?.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessions</p>
              <p className="font-semibold">{data.sessions?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Page Views</p>
              <p className="font-semibold">{data.views?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Engagement</p>
              <p className="font-semibold">
                {(data.engagement_rate * 100)?.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">Average Duration:</p>
              <p className="font-semibold">
                {data.avg_session_duration?.toFixed(1)}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600">Bounce Rate:</p>
              <p className="font-semibold">
                {(data.bounce_rate * 100)?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
  if (!processedData) return null;

  const AnimatedRect = animated.rect;

  const maxHeight =
    typeof window !== "undefined" ? window.innerHeight * 0.8 : 800;
  const dynamicHeight = root
    ? Math.min(maxHeight, Math.max(600, root.descendants().length * 15))
    : 600;

  // Modify the MetricSelector to stop propagation on click
  const MetricSelector = ({ value, onChange, label }) => (
    <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
      <label className="mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded p-1"
      >
        {Object.entries(METRICS).map(([label, value]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full h-[90vh] bg-white rounded-xl shadow-lg p-6">
      <Legend />
      <div
        ref={chartRef}
        className="overflow-auto h-[calc(100%-6rem)] mt-6"
        onMouseLeave={handleChartMouseLeave}
      >
        <svg width="100%" height={dynamicHeight}>
          <rect
            width="100%"
            height={dynamicHeight}
            fill={colors.background}
            rx={8}
          />
          <Treemap root={root} size={[1200, dynamicHeight]} padding={1} round>
            {(treemap) => {
              const maxDepth = Math.max(
                ...treemap.descendants().map((d) => d.depth)
              );
              return (
                <Group>
                  {treemap
                    .descendants()
                    .map((node, i) => renderNode(node, i, maxDepth))}
                </Group>
              );
            }}
          </Treemap>
        </svg>
      </div>
      {/* @ts-ignore */}
      {tooltipData && (
        // @ts-ignore
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            position: "absolute",
            pointerEvents: "auto",
          }}
        >
          <CustomTooltip data={tooltipData} />
        </TooltipWithBounds>
      )}
    </div>
  );
};

export default RadialMetricWheel;
