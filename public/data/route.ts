import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('API route called');
    
    // Get the absolute path to the data directory
    const dataDirectory = path.join(process.cwd(), 'src/data');
    console.log('Looking for data in:', dataDirectory);
    
    // Read the JSON file
    const filePath = path.join(dataDirectory, 'processed.json');
    console.log('Attempting to read:', filePath);
    
    const fileContents = await fs.readFile(filePath, 'utf8');
    const rawData = JSON.parse(fileContents);
    
    // Transform the data structure to what we need
    const transformedData = Object.entries(rawData).map(([key, entry]: [string, any]) => ({
      getKeepGrow: entry.getKeepGrow,
      cmoPriority: entry.cmoPriority,
      use_case_multi_primary: entry.use_case_multi_primary,
      use_case_multi_addl: entry.use_case_multi_addl,
      url: entry.url,
      title: entry.title
    })).filter(entry => 
      entry.getKeepGrow && 
      entry.cmoPriority && 
      entry.use_case_multi_primary
    );

    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to load data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}