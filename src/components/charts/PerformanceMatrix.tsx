import React, { useState, useEffect, useMemo } from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Circle } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows, GridColumns } from "@visx/grid";
import { useTooltip, TooltipWithBounds } from "@visx/tooltip";
import { localPoint } from "@visx/event";
import { useSpring, useSprings, animated } from "@react-spring/web";
import _ from "lodash";
import { useCaseMapping } from "@/types/chart";

const AnimatedCircle = animated(Circle);

const ArticlePerformanceScatter = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOutliers, setShowOutliers] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 }); // Dimensions hook moved up
  const chartContainerRef = React.useRef(null);

  // Act-On brand colors
  const colors = {
    get: "#00BABE", // Teal for GET
    keep: "#FD4A5C", // Red for KEEP
    grow: "#C2D500", // Yellow for GROW
    optimize: "#194F90", // Blue for OPTIMIZE
    background: "#EEF3FA",
  };

  // Spring physics configuration
  const springConfig = {
    tension: 300,
    friction: 20,
    mass: 1,
  };

  // Fetch data (no changes here)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error("Failed to fetch data");
        const data = await response.json();
        setRawData(data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.message);
      } finally {
        setLoading(false); // Set loading to false in 'finally'
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (chartContainerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        if (!Array.isArray(entries) || !entries.length) {
          return;
        }
        const entry = entries[0];
        setDimensions({
          width: entry.contentRect.width,
          height: 650,
        });
      });

      resizeObserver.observe(chartContainerRef.current);

      return () => resizeObserver.disconnect(); // Clean up
    }
  }, []);

  const width = dimensions.width;
  const height = dimensions.height;
  const margin = { top: 40, right: 120, bottom: 60, left: 80 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Process data with outlier filtering (useMemo is now called unconditionally)
  const { filteredData, stats, outlierCount, originalStats } = useMemo(() => {
    let transformedData = [];
    let filtered = [];
    let stats = {};
    let outlierCount = 0;
    let originalStats = {};

    if (rawData.length) {
      // Perform calculations only if rawData is not empty
      transformedData = rawData
        .filter((entry) => {
          const useCaseName = entry.use_case_multi_primary?.name;
          return useCaseName && useCaseMapping[useCaseName];
        })
        .map((entry) => {
          const useCaseName = entry.use_case_multi_primary?.name;
          const mapping = useCaseMapping[useCaseName];
          return {
            views: entry.analytics?.views || 0,
            avgSessionDuration: entry.analytics?.avg_session_duration || 0,
            category: mapping.getKeepGrow,
            title: entry.title,
            useCase: useCaseName,
            engagementRate: (entry.analytics?.engagement_rate || 0) * 100,
          };
        });

      const viewsMean = _.meanBy(transformedData, "views");
      const viewsStd = Math.sqrt(
        _.meanBy(transformedData, (d) => Math.pow(d.views - viewsMean, 2))
      );
      const durationMean = _.meanBy(transformedData, "avgSessionDuration");
      const durationStd = Math.sqrt(
        _.meanBy(transformedData, (d) =>
          Math.pow(d.avgSessionDuration - durationMean, 2)
        )
      );

      filtered = transformedData.filter((d) => {
        if (showOutliers) return true;

        const viewsZScore = Math.abs((d.views - viewsMean) / viewsStd);
        const durationZScore = Math.abs(
          (d.avgSessionDuration - durationMean) / durationStd
        );
        return viewsZScore <= 3 && durationZScore <= 3;
      });

      const getStats = (data) => {
        return data.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {});
      };

      stats = getStats(filtered);
      outlierCount = transformedData.length - filtered.length;
      originalStats = getStats(transformedData);
    }

    return {
      filteredData: filtered, // Return empty arrays if no data
      stats: stats,
      outlierCount: outlierCount,
      originalStats: originalStats,
    };
  }, [rawData, showOutliers, useCaseMapping]); // Include useCaseMapping in dependencies

  // Tooltip setup (no changes)
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip();

  // Setup scales (these *can* be inside useMemo, but it's generally clearer
  // to keep them separate if they're simple calculations).  They MUST be
  // before the early returns.
  const xScale = useMemo(() => {
    return scaleLinear({
      domain: [0, Math.max(...filteredData.map((d) => d.views))],
      range: [0, xMax],
      nice: true,
    });
  }, [filteredData, xMax]);

  const yScale = useMemo(() => {
    return scaleLinear({
      domain: [0, Math.max(...filteredData.map((d) => d.avgSessionDuration))],
      range: [yMax, 0],
      nice: true,
    });
  }, [filteredData, yMax]);

  const getColor = (category) => {
    const colorMap = {
      "1-GET": colors.get,
      "2-KEEP": colors.keep,
      "3-GROW": colors.grow,
      "4-OPTIMIZE": colors.optimize,
    };
    return colorMap[category];
  };

  const handleMouseOver = (event, d) => {
    const coords = localPoint(event.target.ownerSVGElement, event);
    showTooltip({
      tooltipData: d,
      tooltipLeft: coords?.x,
      tooltipTop: coords?.y,
    });
  };

  // Calculate the center of the chart for the ripple effect
  const chartCenterX = xMax / 2;
  const chartCenterY = yMax / 2;

  // Function to calculate distance from the center
  const getDistanceFromCenter = (x, y) => {
    return Math.sqrt(
      Math.pow(x - chartCenterX, 2) + Math.pow(y - chartCenterY, 2)
    );
  };

  // Find the maximum distance for normalization
  const maxDistance = useMemo(() => {
    let maxDist = 0;
    filteredData.forEach((d) => {
      const x = xScale(d.views);
      const y = yScale(d.avgSessionDuration);
      const dist = getDistanceFromCenter(x, y);
      maxDist = Math.max(maxDist, dist);
    });
    return maxDist;
  }, [filteredData, xScale, yScale]);

  // After computing filteredData, xScale, yScale, maxDistance, etc.
  const springs = useSprings(
    filteredData.length,
    filteredData.map((d) => {
      const x = xScale(d.views);
      const y = yScale(d.avgSessionDuration);
      const distance = getDistanceFromCenter(x, y);
      const delay = (distance / maxDistance) * 800;
      return {
        from: { scale: 0, opacity: 0, cx: x, cy: y },
        to: { scale: 1, opacity: 0.6, cx: x, cy: y },
        config: springConfig,
        delay: 100 + delay,
      };
    })
  );

  // --- NOW it's safe to have early returns ---
  if (loading)
    return (
      <div
        ref={chartContainerRef}
        className="w-full h-full bg-white rounded-xl shadow-lg p-6 flex items-center justify-center"
      >
        <div className="text-lg">Loading visualization...</div>
      </div>
    );

  if (error)
    return (
      <div
        ref={chartContainerRef}
        className="w-full h-full bg-white rounded-xl shadow-lg p-6 flex items-center justify-center"
      >
        <div className="text-red-500">Error loading data: {error}</div>
      </div>
    );

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full bg-white rounded-xl shadow-lg p-6 relative"
    >
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold">Article Performance</div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOutliers}
              onChange={(e) => setShowOutliers(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            Show Outliers
          </label>
          <div className="text-sm text-gray-500">
            {filteredData.length} articles plotted
            {outlierCount > 0 &&
              !showOutliers &&
              ` (${outlierCount} outliers hidden)`}
          </div>
        </div>
      </div>

      {/* Category summary */}
      <div className="mb-4 text-sm text-gray-600 flex gap-4">
        {["1-GET", "2-KEEP", "3-GROW", "4-OPTIMIZE"].map((category) => (
          <div key={category} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getColor(category) }}
            ></div>
            <span>
              {category}: {stats[category] || 0}
              {!showOutliers &&
                originalStats[category] !== stats[category] &&
                ` (${originalStats[category] - stats[category]} outliers)`}
            </span>
          </div>
        ))}
      </div>

      <svg width={width} height={height}>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={colors.background}
          rx={14}
        />

        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={yScale}
            width={xMax}
            height={yMax}
            stroke="#E5E7EB"
            strokeOpacity={0.2}
          />
          <GridColumns
            scale={xScale}
            width={xMax}
            height={yMax}
            stroke="#E5E7EB"
            strokeOpacity={0.2}
          />

          {filteredData.map((d, i) => {
            const springProps = springs[i];
            return (
              <AnimatedCircle
                key={i}
                cx={springProps.cx}
                cy={springProps.cy}
                r={3}
                fill={getColor(d.category)}
                opacity={springProps.opacity}
                scale={springProps.scale}
                onMouseMove={(e) => handleMouseOver(e, d)}
                onMouseLeave={hideTooltip}
                className="transition-opacity duration-200 hover:opacity-100"
              />
            );
          })}

          <AxisLeft
            scale={yScale}
            stroke="#101820"
            tickStroke="#101820"
            label="Average Session Duration (seconds)"
            labelOffset={50}
            tickLabelProps={() => ({
              fill: "#101820",
              fontSize: 10,
              textAnchor: "end",
              dx: -4,
            })}
          />
          <AxisBottom
            top={yMax}
            scale={xScale}
            stroke="#101820"
            tickStroke="#101820"
            label="Views"
            labelOffset={40}
            tickFormat={(value) => value.toLocaleString()}
            tickLabelProps={() => ({
              fill: "#101820",
              fontSize: 10,
              textAnchor: "middle",
              dy: 4,
            })}
          />
        </Group>

        <Group top={margin.top} left={width - margin.right + 20}>
          {[
            { label: "1-GET", color: colors.get },
            { label: "2-KEEP", color: colors.keep },
            { label: "3-GROW", color: colors.grow },
            { label: "4-OPTIMIZE", color: colors.optimize },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(0, ${i * 20})`}>
              <circle r={4} fill={item.color} opacity={0.6} />
              <text x={12} y={4} fontSize={10} fill="#101820">
                {item.label} ({stats[item.label] || 0})
              </text>
            </g>
          ))}
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        // @ts-ignore - Adding children prop to animated.g
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          className="bg-white p-3 rounded shadow-lg border border-gray-200"
        >
          <div className="text-sm">
            {/* @ts-ignore */}
            <div className="font-medium mb-1">{tooltipData.title}</div>
            {/* @ts-ignore */}
            <div>Use Case: {tooltipData.useCase}</div>
            {/* @ts-ignore */}
            <div>Views: {tooltipData.views.toLocaleString()}</div>
            {/* @ts-ignore */}
            <div>Duration: {tooltipData.avgSessionDuration.toFixed(1)}s</div>
            {/* @ts-ignore */}
            <div>Engagement: {tooltipData.engagementRate.toFixed(1)}%</div>
            {/* @ts-ignore */}
            <div>Category: {tooltipData.category}</div>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
};

export default ArticlePerformanceScatter;
