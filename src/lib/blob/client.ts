import { put, del, list } from "@vercel/blob";

export async function uploadBlob(
  filename: string,
  data: Buffer | ReadableStream | Blob,
  options?: { contentType?: string }
) {
  const blob = await put(filename, data, {
    access: "public",
    contentType: options?.contentType,
  });
  return blob;
}

export async function deleteBlob(url: string) {
  await del(url);
}

export async function listBlobs(prefix?: string) {
  const result = await list({ prefix });
  return result.blobs;
}
