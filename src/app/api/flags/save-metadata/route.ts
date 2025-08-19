// API endpoint for saving flag metadata to server
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flags, lastUpdateTime } = body;
    
    // Ensure flags directory exists
    const flagsDir = path.join(process.cwd(), 'public', 'flags');
    if (!existsSync(flagsDir)) {
      await mkdir(flagsDir, { recursive: true });
    }
    
    // Save metadata to file
    const metadata = {
      lastUpdateTime,
      flags: flags || {},
      updatedAt: Date.now()
    };
    
    const metadataPath = path.join(flagsDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`[FlagMetadata] Saved metadata with ${Object.keys(flags || {}).length} flags`);
    
    return NextResponse.json({
      success: true,
      flagCount: Object.keys(flags || {}).length,
      savedAt: Date.now()
    });
    
  } catch (error) {
    console.error('[FlagMetadata] Error saving metadata:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}