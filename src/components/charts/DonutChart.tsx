import React, { useState } from "react";
import Pie from "@visx/shape/lib/shapes/Pie";
import { scaleOrdinal } from "@visx/scale";
import { Group } from "@visx/group";
import { Card } from "@/components/ui/card";
import { animated, useSpring, config } from "react-spring";

interface DataItem {
  label: string;
  value: number;
}

interface DonutChartProps {
  data: DataItem[];
  width: number;
  height: number;
  colorRange?: string[];
  title: string;
}

const DonutChart = ({
  data,
  width,
  height,
  colorRange = ["#194F90", "#00BABE", "#C2D500", "#FD4A5C", "#101820"],
  title,
}: DonutChartProps) => {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const radius = Math.min(width, height) / 3;
  const centerY = height / 2;
  const centerX = width / 2;

  const titleSpring = useSpring({
    from: { opacity: 0, transform: "translateY(-20px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    delay: 500,
  });

  const getColor = scaleOrdinal({
    domain: data.map((d) => d.label),
    range: colorRange,
  });

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const labelThreshold = total * 0.075;

  // Whole Chart Rotation Animation
  const [chartRotation, setChartRotation] = useState(0);

  const chartRotationSpring = useSpring({
    from: { rotation: 0 },
    to: { rotation: chartRotation + 360 },
    config: { duration: 2000 }, // Adjust for desired rotation speed
    reset: true,
    onRest: () => {
      setChartRotation((prevRotation) => prevRotation + 360);
    },
  });

  return (
    <Card className="w-full h-full p-6 bg-white flex items-center justify-center">
      <div className="relative w-full h-full flex items-center justify-center">
        {/* @ts-ignore */}
        <animated.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={titleSpring}
        >
          <div className="text-center mt-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-gray-600">Total: {total.toLocaleString()}</p>
          </div>
        </animated.div>

        <svg width={width} height={height}>
          <Group top={centerY} left={centerX}>
            {/* @ts-ignore */}
            <animated.g
              style={{
                transformOrigin: "center",
                transform: chartRotationSpring.rotation.to(
                  (r) => `rotate(${r})`
                ),
              }}
            >
              <Pie
                data={data}
                pieValue={(d) => d.value}
                outerRadius={radius}
                innerRadius={radius - 50}
                cornerRadius={3}
                padAngle={0.02}
              >
                {(pie) => (
                  <g>
                    {pie.arcs.map((arc, index) => {
                      const isActive = activeSegment === arc.data.label;
                      const percentage = (
                        (arc.data.value / total) *
                        100
                      ).toFixed(1);
                      const isLargeSegment = arc.data.value > labelThreshold;

                      const centerAngle = (arc.startAngle + arc.endAngle) / 2;
                      const hoverDistance = isActive ? 3 : 0;
                      const translateX =
                        Math.cos(centerAngle - Math.PI / 2) * hoverDistance;
                      const translateY =
                        Math.sin(centerAngle - Math.PI / 2) * hoverDistance;

                      const labelRadius = radius + (isLargeSegment ? 28 : 24);
                      const labelX =
                        Math.cos(centerAngle - Math.PI / 2) * labelRadius;
                      const labelY =
                        Math.sin(centerAngle - Math.PI / 2) * labelRadius;

                      const [centroidX, centroidY] = pie.path.centroid(arc);

                      // Individual segment animation: Radial expansion + rotation
                      const segmentSpring = useSpring({
                        from: {
                          scale: 0, // Start very small
                          rotate: 180, // Start rotated
                          opacity: 0,
                        },
                        to: {
                          scale: 1,
                          rotate: 0, // Rotate to final position
                          opacity: 1,
                        },
                        delay: 200 + index * 50, // Staggered delay
                        config: config.slow,
                      });
                      return (
                        // @ts-ignore
                        <animated.g
                          key={`${arc.data.label}-${index}`}
                          onMouseEnter={() => setActiveSegment(arc.data.label)}
                          onMouseLeave={() => setActiveSegment(null)}
                          className="cursor-pointer"
                          style={{
                            transformOrigin: `${centroidX}px ${centroidY}px`, // Rotate around centroid
                            transform: segmentSpring.scale
                              .to((s) => `scale(${s})`)
                              .to(
                                // @ts-ignore
                                (s, r) => `scale(${s}) rotate(${r}deg)`,
                                segmentSpring.rotate
                              ), //Combine scale and rotation
                            opacity: segmentSpring.opacity,
                          }}
                        >
                          <path
                            d={pie.path(arc) || ""}
                            fill={getColor(arc.data.label)}
                            style={{
                              transform: `translate(${translateX}px, ${translateY}px)`,
                              opacity: isActive ? 0.85 : 1,
                              transition: "opacity 0.2s, transform 0.2s",
                            }}
                          />

                          {(isLargeSegment || isActive) && (
                            <g>
                              <line
                                x1={centroidX}
                                y1={centroidY}
                                x2={labelX}
                                y2={labelY}
                                stroke="#DDDDDD"
                                strokeWidth={isActive ? 1.5 : 1}
                              />
                              <text
                                x={labelX}
                                y={labelY}
                                dy=".35em"
                                fontSize={12}
                                textAnchor={labelX > 0 ? "start" : "end"}
                                fill="#101820"
                                dx={labelX > 0 ? "0.5em" : "-0.5em"}
                              >
                                {arc.data.label}
                                <tspan
                                  x={labelX}
                                  dy="1.2em"
                                  dx={labelX > 0 ? "0.5em" : "-0.5em"}
                                  fill="#666666"
                                >
                                  {percentage}%
                                </tspan>
                              </text>
                            </g>
                          )}
                        </animated.g>
                      );
                    })}
                  </g>
                )}
              </Pie>
            </animated.g>
          </Group>
        </svg>
      </div>
    </Card>
  );
};

export default DonutChart;
