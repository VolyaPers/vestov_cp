import path from 'node:path'

export function getUploadsDirectory(environment: { NODE_ENV?: string; UPLOADS_DIR?: string }, cwd = process.cwd()): string {
  const configured = environment.UPLOADS_DIR?.trim()
  if (environment.NODE_ENV === 'production' && (!configured || !path.isAbsolute(configured) || path.resolve(configured) === path.parse(configured).root)) {
    throw new Error('Production requires an absolute UPLOADS_DIR inside a persistent storage mount. Configure durable storage before starting the API.')
  }
  return path.resolve(configured || path.join(cwd, 'uploads'))
}

export const uploadsDirectory = getUploadsDirectory({ NODE_ENV: process.env.NODE_ENV, UPLOADS_DIR: process.env.UPLOADS_DIR })

export function resolveUploadPath(url: string): string {
  const relative = url.replace(/^\/?(?:api\/)?uploads\//, '')
  const resolved = path.resolve(uploadsDirectory, relative)
  if (!resolved.startsWith(uploadsDirectory + path.sep) || relative.includes('\0')) {
    throw new Error('Invalid upload path')
  }
  return resolved
}
