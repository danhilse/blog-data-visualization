'use client'

import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ZoomableSunburst from '@/components/charts/SunburstChart';
import CategoriesChart from '@/components/charts/CategoriesChart';
import UseCaseChart from '@/components/charts/UseCaseChart';
import RelationshipsChart from '@/components/charts/RelationshipsChart';  // Fixed import
import WordCloudChart from '@/components/charts/WordCloudChart';
import SankeyChart from '@/components/charts/SankeyChart';
import UseCasePerformanceMatrix from '@/components/charts/PerformanceMatrix';
import RadialMetricWheel from '@/components/charts/radial';
import AnalyticsTreemap from '@/components/charts/tree';
import { Card } from '@/components/ui/card';
import Image from 'next/image';

export default function Home() {
  return (
    <Tabs defaultValue="use-cases" className="h-screen bg-white">
      {/* Fixed Header with Title and Nav */}
      <div className="h-16 bg-white border-b fixed w-full top-0 z-20 flex items-center justify-between px-6">
        {/* <h1 className="text-lg font-semibold text-blue-800"> </h1> */}
        <div className="mb-6 flex pt-8">
          <Image 
            src="/logo.svg" 
            alt="Logo" 
            width={80} 
            height={0} 
            priority 
          />
        </div>
        
        {/* Navigation Tabs - Right Aligned */}
        <TabsList className="h-full bg-transparent">
          {['tree',
          'sunburst',
          'use-cases', 
          // 'categories', 
          'relationships', 
          // 'word-cloud', 
          'sankey', 
          'matrix', 
          // 'radial', 
          ].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="text-sm px-4 h-full data-[state=active]:bg-blue-50 data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      
      {/* Main Content Area - Scrollable */}
      <div className="pt-16 h-screen">
        <Card className="h-full rounded-none border-0">
          <div className="h-full overflow-auto">
            <TabsContent value="use-cases" className="min-h-full p-6">
              <UseCaseChart />
            </TabsContent>
            
            <TabsContent value="sunburst" className="min-h-full p-6">
              <ZoomableSunburst />
            </TabsContent>
            
            <TabsContent value="categories" className="min-h-full p-6">
              <CategoriesChart />
            </TabsContent>
            
            <TabsContent value="relationships" className="min-h-full p-6">
              <RelationshipsChart />
            </TabsContent>

            <TabsContent value="word-cloud" className="min-h-full p-6">
              <WordCloudChart />
            </TabsContent>

            <TabsContent value="sankey" className="min-h-full p-6">
              <SankeyChart />
            </TabsContent>

            <TabsContent value="matrix" className="min-h-full p-6">
              <UseCasePerformanceMatrix />
            </TabsContent>

            <TabsContent value="radial" className="min-h-full p-6">
              <RadialMetricWheel />
            </TabsContent>

            <TabsContent value="tree" className="min-h-full p-6">
              <AnalyticsTreemap />
            </TabsContent>
          </div>
        </Card>
      </div>
    </Tabs>
  );
}