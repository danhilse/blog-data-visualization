import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Update the path to point to the src/data directory
    const dataPath = path.join(process.cwd(), 'src', 'data', 'processed.json');
    const fileContents = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(fileContents);
    
    // Process the data before sending
    const processedData = Object.values(data).filter((entry: any) => 
      entry.use_case_multi_primary?.name && 
      entry.ai_category
    );
    
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error reading data:', error);
    return NextResponse.json(
      { error: 'Failed to load data' },
      { status: 500 }
    );
  }
}
