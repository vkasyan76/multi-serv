import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import configPromise from "@/payload.config";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({
      config: configPromise,
    });

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Payload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a file object that Payload expects
    const fileData = {
      data: buffer,
      mimetype: file.type,
      name: file.name,
      size: file.size,
    };

    // Upload to Payload's Media collection
    const uploadedFile = await payload.create({
      collection: "media",
      data: {
        alt: file.name,
      },
      file: fileData,
    });

    return NextResponse.json({
      success: true,
      file: uploadedFile,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
} 