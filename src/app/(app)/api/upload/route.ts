import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import { auth } from '@clerk/nextjs/server';
import payloadConfig from '../../../../payload.config';

// Force Node.js runtime for Buffer and Payload APIs
export const runtime = "nodejs";

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
    
    console.log('Upload: User ID from Clerk:', userId);
    
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
      console.log('Upload: No user found for Clerk ID:', userId);
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    const user = users.docs[0];
    
    if (!user) {
      console.log('Upload: User object is undefined');
      return NextResponse.json(
        { error: 'User object is undefined' },
        { status: 500 }
      );
    }
    
    console.log('Upload: User found:', {
      id: user.id,
      email: user.email,
      tenants: user.tenants
    });
    
    // Handle tenantId from form data OR fallback to user's tenants
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const providedTenantId = formData.get('tenantId') as string;
    
    let tenantId: string;
    
    if (providedTenantId) {
      // SECURITY: Verify this tenant belongs to the current user
      console.log('Upload: Verifying provided tenantId:', providedTenantId);
      
      const tenant = await payload.find({
        collection: 'tenants',
        where: {
          and: [
            { id: { equals: providedTenantId } },
            { user: { equals: user.id } }
          ]
        },
        limit: 1
      });
      
      if (!tenant.docs.length) {
        console.log('Upload: Invalid tenantId or unauthorized access:', providedTenantId);
        return NextResponse.json(
          { error: 'Invalid tenant ID or unauthorized access' },
          { status: 403 }
        );
      }
      
      tenantId = providedTenantId;
      console.log('Upload: Tenant ownership verified:', tenantId);
    } else {
      // Fallback to existing logic for profile updates
      const tenants = Array.isArray(user.tenants) ? user.tenants : [];
      
      if (tenants.length !== 1) {
        return NextResponse.json(
          { error: "Provide tenantId when user has zero or multiple tenants" },
          { status: 400 }
        );
      }
      
             const ref = tenants[0];
       
       // Type-safe tenant reference resolution with proper type guards
       let resolved: string | undefined;
       
       if (typeof ref === "string") {
         resolved = ref;
       } else if (ref && typeof ref === "object") {
         if ("id" in ref && typeof ref.id === "string") {
           resolved = ref.id;
         } else if ("tenant" in ref) {
           if (typeof ref.tenant === "string") {
             resolved = ref.tenant;
           } else if (ref.tenant && typeof ref.tenant === "object" && "id" in ref.tenant && typeof ref.tenant.id === "string") {
             resolved = ref.tenant.id;
           }
         }
       }

      if (!resolved) {
        return NextResponse.json({ error: "Invalid tenant reference" }, { status: 400 });
      }
      
      tenantId = resolved;
      console.log('Upload: Resolved fallback tenant ID:', tenantId);
    }
    
    console.log('Upload: Final tenant ID to use:', tenantId);
    
    if (!file) {
      console.log('Upload: No file provided in form data');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Upload: File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      console.log('Upload: File size exceeds limit:', file.size);
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log('Upload: Invalid file type:', file.type);
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

    console.log('Upload: Attempting to create media with tenant:', tenantId);
    console.log('Upload: Vercel Blob token exists:', !!process.env.BLOB_READ_WRITE_TOKEN);

    let uploadedFile;
    try {
      // Upload to Payload's Media collection with file
      uploadedFile = await payload.create({
        collection: 'media',
        data: {
          ...fileData,
          tenant: tenantId, // Set the tenant ID
        },
        file: {
          data: buffer,
          mimetype: file.type,
          name: file.name,
          size: file.size,
        },
        overrideAccess: true,
      });

      console.log('Upload: Successfully uploaded file:', uploadedFile.id);

      // 🔧 NEW: Link the uploaded media to the tenant
      await payload.update({
        collection: 'tenants',
        id: tenantId,
        data: { image: uploadedFile.id },
        overrideAccess: true,
      });

      console.log('Upload: Successfully linked image to tenant:', tenantId);

      // Return the file data
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
    } catch (uploadError) {
      console.error('Upload: Payload create failed:', uploadError);
      
      // FAIL-SAFE: Clean up uploaded file if it was created but linking failed
      if (uploadedFile?.id) {
        try {
          await payload.delete({
            collection: 'media',
            id: uploadedFile.id,
            overrideAccess: true,
          });
          console.log('Upload: Cleaned up orphaned media file:', uploadedFile.id);
        } catch (cleanupError) {
          console.error('Upload: Failed to cleanup orphaned media file:', cleanupError);
        }
      }
      
      // Check if it's a Vercel Blob storage issue
      if (uploadError instanceof Error && uploadError.message.includes('blob')) {
        return NextResponse.json(
          { error: 'Vercel Blob storage configuration issue. Please check BLOB_READ_WRITE_TOKEN environment variable.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'File upload failed: ' + (uploadError instanceof Error ? uploadError.message : 'Unknown error') },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

// Keep the GET endpoint for debugging
export async function GET() {
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
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        tenants: user.tenants
      },
      environment: {
        BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json(
      { error: 'GET failed' },
      { status: 500 }
    );
  }
} 