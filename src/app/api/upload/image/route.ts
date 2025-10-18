// API endpoint for uploading images (flags, coat of arms, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Allowed types: PNG, JPG, GIF, WEBP, SVG'
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 5MB limit'
      }, { status: 400 });
    }

    // Convert to base64 data URL
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    console.log(`[ImageUpload] Successfully processed ${file.name} (${file.size} bytes) for user ${userId}`);

    return NextResponse.json({
      success: true,
      dataUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: Date.now()
    });

  } catch (error) {
    console.error('[ImageUpload] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint to check authentication status
export async function GET() {
  try {
    const { userId } = await auth();
    return NextResponse.json({
      authenticated: !!userId,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES
    });
  } catch (error) {
    return NextResponse.json({
      authenticated: false,
      error: 'Failed to check authentication'
    }, { status: 500 });
  }
}

