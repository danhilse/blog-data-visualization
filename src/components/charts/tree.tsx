import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Group } from "@visx/group";
import { Treemap, hierarchy } from "@visx/hierarchy";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { Text } from "@visx/text";
import { animated, useSpring, to } from "@react-spring/web";
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

const baseColors = {
  get: "#00BABE",
  keep: "#FD4A5C",
  grow: "#C2D500",
  optimize: "#194F90",
  background: "#EEF3FA",
};

const getMinMax = (values) => {
  const filteredValues = values.filter((v) => v != null);
  return {
    min: Math.min(...filteredValues),
    max: Math.max(...filteredValues),
  };
};

const getColor = (category) => {
  const colorMap = {
    "1-GET": baseColors.get,
    "2-KEEP": baseColors.keep,
    "3-GROW": baseColors.grow,
    "4-OPTIMIZE": baseColors.optimize,
  };
  return colorMap[category];
};

const calculateDelay = (node, dynamicHeight) => {
  const centerX = 600;
  const centerY = dynamicHeight / 2;
  const nodeCenterX = (node.x0 + node.x1) / 2;
  const nodeCenterY = (node.y0 + node.y1) / 2;
  const dx = nodeCenterX - centerX;
  const dy = nodeCenterY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  return (distance / maxDistance) * 800;
};

// --------------------------------------------------------------------------
// Memoized node component
// Modified TreemapNode component
interface TreemapNodeProps {
  node: any;
  dynamicHeight: number;
  highlightedCluster: string | null;
  selectedNode: any;
  onNodeClick: (data: any, e: React.MouseEvent) => void;
  onMouseEnter: (data: any) => void;
  onMouseLeave: () => void;
  isChartHovered: boolean;
}

const TreemapNode = React.memo(
  ({
    node,
    dynamicHeight,
    highlightedCluster,
    selectedNode,
    onNodeClick,
    onMouseEnter,
    onMouseLeave,
    isChartHovered,
  }: TreemapNodeProps) => {
    if (node.children) return null;

    const width = node.x1 - node.x0;
    const height = node.y1 - node.y0;
    const data = node.data;
    const isHighlighted = highlightedCluster === data.useCase;
    const baseOpacity = node.opacityValue ?? node.data.opacityValue;
    const isClusterFaded = highlightedCluster && !isHighlighted;
    const isSelected = selectedNode?.name === data.name;
    const fadeOpacity = isClusterFaded ? 0.3 : 1;

    let finalOpacity = baseOpacity;
    if (isChartHovered) {
      finalOpacity = isHighlighted ? baseOpacity : baseOpacity * 0.3;
    }

    const delay = calculateDelay(node, dynamicHeight);
    const [isInitialRender] = useState(true);

    const springProps = useSpring({
      from: isInitialRender
        ? {
            width: 0,
            height: 0,
            x: node.x0 + width / 2,
            y: node.y0 + height / 2,
            opacity: 0,
            scale: 0,
          }
        : {
            width,
            height,
            x: node.x0,
            y: node.y0,
            opacity: finalOpacity,
            scale: 1,
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
      immediate: !isInitialRender,
    });

    return (
      // @ts-ignore
      <animated.g
        style={{
          transform: springProps.scale.to((s) => `scale(${s})`),
          transformOrigin: `${node.x0 + width / 2}px ${node.y0 + height / 2}px`,
        }}
      >
        <animated.rect
          // @ts-ignore
          width={springProps.width}
          height={springProps.height}
          x={springProps.x}
          y={springProps.y}
          opacity={springProps.opacity}
          stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
          strokeWidth={isSelected ? 2 : 1}
          fill={getColor(data.category)}
          onClick={(e) => onNodeClick(data, e)}
          onMouseEnter={() => onMouseEnter(data)}
          onMouseLeave={onMouseLeave}
          style={{
            cursor: "pointer",
            filter: isHighlighted
              ? "brightness(1.1) drop-shadow(0 0 8px rgba(255,255,255,0.3))"
              : "none",
            transition: "filter 0.3s ease",
          }}
        />
        {width > 40 && height > 30 && (
          // @ts-ignore
          <animated.g
            style={{
              opacity: springProps.opacity,
              transform: to(
                [
                  springProps.x,
                  springProps.y,
                  springProps.scale,
                  springProps.width,
                  springProps.height,
                ],
                (x, y, scale, width, height) =>
                  `translate(${x + width / 2}px, ${
                    y + height / 2
                  }px) scale(${scale})`
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
      </animated.g>
    );
  },
  (prevProps, nextProps) => {
    // @ts-ignore
    const prevNode = prevProps.node;
    // @ts-ignore
    const nextNode = nextProps.node;

    if (
      (prevNode.opacityValue ?? prevNode.data.opacityValue) !==
      (nextNode.opacityValue ?? nextNode.data.opacityValue)
    ) {
      return false;
    }

    // Add data comparison
    if (prevNode.data.opacityValue !== nextNode.data.opacityValue) {
      return false;
    }

    if (
      prevNode.x0 !== nextNode.x0 ||
      prevNode.x1 !== nextNode.x1 ||
      prevNode.y0 !== nextNode.y0 ||
      prevNode.y1 !== nextNode.y1
    ) {
      return false;
    }

    // @ts-ignore
    if (prevProps.isChartHovered !== nextProps.isChartHovered) {
      return false;
    }

    // @ts-ignore
    if (prevProps.highlightedCluster !== nextProps.highlightedCluster) {
      // @ts-ignore
      const wasHighlighted =
        prevProps.highlightedCluster === prevNode.data.useCase;
      // @ts-ignore
      const isHighlighted =
        nextProps.highlightedCluster === nextNode.data.useCase;
      if (wasHighlighted !== isHighlighted) return false;
    }

    // @ts-ignore
    if (prevProps.selectedNode?.name !== nextProps.selectedNode?.name) {
      // @ts-ignore
      const wasSelected = prevProps.selectedNode?.name === prevNode.data.name;
      // @ts-ignore
      const isSelected = nextProps.selectedNode?.name === nextNode.data.name;
      if (wasSelected !== isSelected) return false;
    }

    return true;
  }
);
// --------------------------------------------------------------------------
// Memoized MetricSelector
// @ts-ignore
const MetricSelector = React.memo(({ value, onChange, label }) => (
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
));

// --------------------------------------------------------------------------
// Main component
const UseCaseTreemap = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlightedCluster, setHighlightedCluster] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sizeMetric, setSizeMetric] = useState("sessions");
  const [opacityMetric, setOpacityMetric] = useState("engagement_rate");
  const tooltipTimeoutRef = useRef(null);
  const [isHoveringCluster, setIsHoveringCluster] = useState(false);
  const chartRef = useRef(null);
  const [isChartHovered, setIsChartHovered] = useState(false);

  const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip();

  const [containerWidth, setContainerWidth] = useState(0);

  // Keep container width in sync with the actual rendered width
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;

    const updateWidth = () => {
      const width = element.clientWidth;
      if (!width) return;
      setContainerWidth((prev) => (prev === width ? prev : width));
    };

    updateWidth();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = Math.round(entry.contentRect.width);
        if (!width) return;
        setContainerWidth((prev) => (prev === width ? prev : width));
      });
      resizeObserver.observe(element);
    }

    window.addEventListener("resize", updateWidth);

    return () => {
      window.removeEventListener("resize", updateWidth);
      resizeObserver?.disconnect();
    };
  }, []);

  // --- Stable callbacks -----------------------------------------------------

  // Modified chart mouse enter/leave handlers
  const handleChartMouseEnter = useCallback(() => {
    setIsChartHovered(true);
  }, []);

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    setIsChartHovered(false);
    setHighlightedCluster(null);
    setIsHoveringCluster(false);

    if (!selectedNode) {
      hideTooltip();
    }
  }, [hideTooltip, selectedNode]);

  const handleCloseTooltip = useCallback(() => {
    setSelectedNode(null);
    setHighlightedCluster(null);
    setIsHoveringCluster(false);
    hideTooltip();
  }, [hideTooltip]);

  const handleNodeClick = useCallback(
    (node, event) => {
      event.stopPropagation();
      if (selectedNode?.name === node.name) {
        setSelectedNode(null);
        setHighlightedCluster(null);
        setIsHoveringCluster(false);
        hideTooltip();
      } else {
        setSelectedNode(node);
        setHighlightedCluster(node.useCase);
        setIsHoveringCluster(true);
        const rect = event.target.getBoundingClientRect();
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        showTooltip({
          tooltipLeft: rect.right + 10,
          tooltipTop: rect.top + scrollTop,
          tooltipData: node,
        });
      }
    },
    [selectedNode, hideTooltip, showTooltip]
  );

  const handleMouseEnter = useCallback((node) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setIsHoveringCluster(true);
    setHighlightedCluster(node.useCase);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!selectedNode) {
      tooltipTimeoutRef.current = setTimeout(() => {
        if (!isHoveringCluster) {
          setHighlightedCluster(null);
        }
      }, 100);
    }
  }, [selectedNode, isHoveringCluster]);

  const handleTooltipMouseEnter = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setIsHoveringCluster(true);
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    setIsHoveringCluster(false);
    if (!chartRef.current?.contains(document.activeElement)) {
      tooltipTimeoutRef.current = setTimeout(() => {
        setHighlightedCluster(null);
        if (!selectedNode) {
          hideTooltip();
        }
      }, 100);
    }
  }, [selectedNode, hideTooltip]);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // --- Data fetching
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

  // --- Data processing (memoized) ------------------------------------------
  const allAnalytics = useMemo(
    () => rawData.map((entry) => entry.analytics).filter(Boolean),
    [rawData]
  );

  const metricBounds = useMemo(
    () => ({
      min: allAnalytics.length
        ? Math.min(
            ...allAnalytics
              .map((a) => a[opacityMetric])
              .filter((v) => v != null)
          )
        : 0,
      max: allAnalytics.length
        ? Math.max(
            ...allAnalytics
              .map((a) => a[opacityMetric])
              .filter((v) => v != null)
          )
        : 1,
    }),
    [allAnalytics, opacityMetric]
  );

  const calculateOpacity = useCallback(
    (value, metric) => {
      if (value == null) return 0.1;

      if (metric === "engagement_rate" || metric === "bounce_rate") {
        return 0.2 + 0.8 * value;
      }

      if (metricBounds.min === metricBounds.max) return 0.8;

      return (
        0.2 +
        (0.8 * (value - metricBounds.min)) /
          (metricBounds.max - metricBounds.min)
      );
    },
    [metricBounds]
  );

  const processedData = useMemo(() => {
    if (!rawData.length) return null;

    const groupedData = _.chain(rawData)
      .filter((entry) => {
        const useCaseName = entry.use_case_multi_primary?.name;
        return useCaseName && useCaseMapping[useCaseName];
      })
      .groupBy((entry) => entry.use_case_multi_primary.name)
      .map((articles, useCase) => ({
        name: useCase,
        children: articles.map((article) => ({
          name: article.title,
          url: article.url,
          category: useCaseMapping[useCase].getKeepGrow,
          useCase,
          ...(article.analytics || {}),
          opacityValue: calculateOpacity(
            article.analytics?.[opacityMetric],
            opacityMetric
          ),
        })),
      }))
      .value();

    return {
      name: "Use Cases",
      children: groupedData,
    };
  }, [rawData, opacityMetric, calculateOpacity]);

  // --- Build the hierarchy for the treemap -------------------------------
  const root = useMemo(() => {
    if (!processedData) return null;

    return hierarchy(processedData)
      .sum((d) => d[sizeMetric] || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .each((node) => {
        // Preserve the opacity value through the hierarchy transformation
        // @ts-ignore
        if (node.data.opacityValue !== undefined) {
          // @ts-ignore
          node.opacityValue = node.data.opacityValue;
        }
      });
  }, [processedData, sizeMetric]);

  // --- Determine dynamic chart height -------------------------------------
  const maxHeight =
    typeof window !== "undefined" ? window.innerHeight * 0.78 : 800;
  const dynamicHeight = root
    ? Math.min(maxHeight, Math.max(600, root.descendants().length * 15))
    : 600;

  const layoutWidth = containerWidth || chartRef.current?.clientWidth || 1200;

  // --- Legend (memoized) -----------------------------------------------------
  const Legend = useMemo(
    () => (
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
            // @ts-ignore
            value={sizeMetric}
            onChange={setSizeMetric}
            label="Size By"
          />
          <MetricSelector
            // @ts-ignore
            value={opacityMetric}
            onChange={setOpacityMetric}
            label="Opacity By"
          />
        </div>
      </div>
    ),
    [highlightedCluster, sizeMetric, opacityMetric]
  );

  // --- Tooltip component -----------------------------------------------------
  const CustomTooltip = ({ data }) => {
    if (!data) return null;

    return (
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-72 overflow-hidden relative"
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      >
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

  // Modified render method
  return (
    <div className="w-full h-full bg-white rounded-xl shadow-lg p-6">
      {Legend}
      <div
        ref={chartRef}
        className="overflow-auto h-[calc(100%-6rem)] mt-6"
        onMouseEnter={handleChartMouseEnter}
        onMouseLeave={handleChartMouseLeave}
      >
        <svg width="100%" height={dynamicHeight}>
          <rect
            width="100%"
            height={dynamicHeight}
            fill={baseColors.background}
            rx={8}
          />
          {root && (
            <Treemap
              key={`treemap-${layoutWidth}`}
              root={root}
              size={[layoutWidth, dynamicHeight]}
              padding={1}
              round
            >
              {(treemap) => {
                const nodes = treemap.descendants();
                return (
                  <Group>
                    {nodes.map((node, i) => (
                      <TreemapNode
                        key={`node-${i}`}
                        node={node}
                        dynamicHeight={dynamicHeight}
                        highlightedCluster={highlightedCluster}
                        selectedNode={selectedNode}
                        onNodeClick={handleNodeClick}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        isChartHovered={isChartHovered}
                      />
                    ))}
                  </Group>
                );
              }}
            </Treemap>
          )}
        </svg>
      </div>
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

export default UseCaseTreemap;
