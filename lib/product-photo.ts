import { HttpError } from "./auth";

export const MAX_PHOTO_BYTES = 1024 * 1024;

/** Only raster JPEGs are served; SVG/HTML and arbitrary external URLs are excluded. */
export function decodeProductPhoto(value: string): Buffer {
  const prefix = "data:image/jpeg;base64,";
  if (!value.startsWith(prefix))
    throw new HttpError(400, "Product photos must be JPEG images");
  const encoded = value.slice(prefix.length);
  if (encoded.length > 4 * Math.ceil(MAX_PHOTO_BYTES / 3))
    throw new HttpError(413, "Product photo must be at most 1 MB");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new HttpError(400, "Invalid product photo");
  const data = Buffer.from(encoded, "base64");
  if (data.length > MAX_PHOTO_BYTES)
    throw new HttpError(413, "Product photo must be at most 1 MB");
  if (
    data.toString("base64") !== encoded ||
    data.length < 4 ||
    data[0] !== 0xff ||
    data[1] !== 0xd8 ||
    data[data.length - 2] !== 0xff ||
    data[data.length - 1] !== 0xd9
  )
    throw new HttpError(400, "Invalid JPEG photo");
  // Check the JPEG header and dimensions before accepting a client upload.
  let offset = 2;
  let dimensionsFound = false;
  while (offset < data.length - 2) {
    if (data[offset++] !== 0xff) break;
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (offset + 2 > data.length) break;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length - 2) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) break;
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      if (!width || !height || width > 1600 || height > 1600)
        throw new HttpError(
          400,
          "Product photos must be at most 1600 pixels on each side",
        );
      dimensionsFound = true;
    }
    if (marker === 0xda) {
      if (dimensionsFound && offset + length < data.length - 2) return data;
      break;
    }
    offset += length;
  }
  throw new HttpError(400, "Invalid JPEG photo");
}
