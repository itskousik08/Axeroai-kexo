import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

export async function uploadToCloudinary(
  file: Buffer | string,
  options: {
    folder?: string
    resource_type?: 'image' | 'video' | 'raw' | 'auto'
    public_id?: string
    format?: string
  } = {}
) {
  const { folder = 'kexo', resource_type = 'auto', ...rest } = options

  return new Promise<{ url: string; public_id: string; duration?: number; format: string; bytes: number }>(
    (resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type, ...rest },
        (error, result) => {
          if (error) return reject(error)
          if (!result) return reject(new Error('No result from Cloudinary'))
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration,
            format: result.format,
            bytes: result.bytes,
          })
        }
      )
      if (typeof file === 'string') {
        // base64 data URL
        cloudinary.uploader.upload(file, { folder, resource_type, ...rest })
          .then(result => resolve({
            url: result.secure_url,
            public_id: result.public_id,
            duration: result.duration,
            format: result.format,
            bytes: result.bytes,
          }))
          .catch(reject)
      } else {
        uploadStream.end(file)
      }
    }
  )
}

export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image') {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

export function getOptimizedUrl(publicId: string, options: {
  width?: number
  height?: number
  quality?: number
  format?: string
} = {}) {
  return cloudinary.url(publicId, {
    fetch_format: options.format || 'auto',
    quality: options.quality || 'auto',
    width: options.width,
    height: options.height,
    crop: 'limit',
  })
}
