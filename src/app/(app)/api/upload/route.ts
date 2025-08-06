import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: payloadConfig });
    
    // Get the current user from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get the user's tenant by clerkUserId
    const users = await payload.find({
      collection: 'users',
      where: {
        clerkUserId: {
          equals: userId,
        },
      },
    });
    
    if (!users.docs || users.docs.length === 0) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    const user = users.docs[0];
    
    if (!user?.tenants || user.tenants.length === 0) {
      return NextResponse.json(
        { error: 'User has no tenant assigned' },
        { status: 400 }
      );
    }
    
    // Use the first tenant (assuming single tenant per user)
    const tenant = user.tenants[0];
    
    if (!tenant) {
      return NextResponse.json(
        { error: 'No tenant found for user' },
        { status: 400 }
      );
    }
    
    // Get the form data from the request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Payload
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create a file object that Payload expects
    const fileData = {
      alt: file.name, // Required alt field for Media collection
    };

    // Upload to Payload's Media collection with file
    const uploadedFile = await payload.create({
      collection: 'media',
      data: {
        ...fileData,
        tenant: tenant.tenant, // Set the tenant ID
      },
      file: {
        data: buffer,
        mimetype: file.type,
        name: file.name,
        size: file.size,
      },
      overrideAccess: true,
    });

    // Return the file data that can be stored in the tenant document
    return NextResponse.json({
      success: true,
      file: {
        id: uploadedFile.id,
        filename: uploadedFile.filename,
        url: uploadedFile.url,
        mimeType: uploadedFile.mimeType,
        filesize: uploadedFile.filesize,
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
} 