// API endpoint for downloading flag images to local storage
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { countryName, flagUrl, fileName, source } = body;
    
    if (!countryName || !flagUrl || !fileName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }
    
    // Ensure flags directory exists
    const flagsDir = path.join(process.cwd(), 'public', 'flags');
    if (!existsSync(flagsDir)) {
      await mkdir(flagsDir, { recursive: true });
    }
    
    // Download the image
    console.log(`[FlagDownload] Downloading ${flagUrl} for ${countryName}`);
    const imageResponse = await fetch(flagUrl, {
      headers: {
        'User-Agent': 'IxStats-Builder'
      }
    });
    
    if (!imageResponse.ok) {
      throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const filePath = path.join(flagsDir, fileName);
    
    // Write the file
    await writeFile(filePath, Buffer.from(imageBuffer));
    
    console.log(`[FlagDownload] Successfully saved ${fileName} (${imageBuffer.byteLength} bytes)`);
    
    return NextResponse.json({
      success: true,
      fileName,
      fileSize: imageBuffer.byteLength,
      filePath: `/flags/${fileName}`,
      source,
      downloadedAt: Date.now()
    });
    
  } catch (error) {
    console.error('[FlagDownload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}