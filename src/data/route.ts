import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { useCaseMapping } from '@/types/chart';

export async function GET() {
  try {
    console.log('API route called');
    
    const dataDirectory = path.join(process.cwd(), 'src/data');
    const filePath = path.join(dataDirectory, 'processed.json');
    
    const fileContents = await fs.readFile(filePath, 'utf8');
    const rawData = JSON.parse(fileContents);
    
    // Transform and filter the data using useCaseMapping
    const transformedData = Object.entries(rawData)
      .map(([key, entry]: [string, any]) => {
        const useCaseName = entry.use_case_multi_primary?.name;
        
        // Only include entries that have a valid use case and mapping
        if (!useCaseName || !useCaseMapping[useCaseName]) {
          return null;
        }

        // Get the mapping
        const mapping = useCaseMapping[useCaseName];

        return {
          ...entry,  // Keep original data
          getKeepGrow: mapping.getKeepGrow,
          cmoPriority: mapping.cmoPriority
        };
      })
      .filter(Boolean); // Remove null entries

    // Log summary for debugging
    const categoryCounts = transformedData.reduce((acc, item) => {
      const category = item.getKeepGrow;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    console.log('Category distribution:', categoryCounts);
    console.log(`Total entries with valid mappings: ${transformedData.length}`);
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to load data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}