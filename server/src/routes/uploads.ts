import { Router } from 'express'
import { eq, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { documents, reimbursementRequests } from '../db/schema.js'
import { canReadDocument, resolveEmployeeId } from '../services/access.js'
import { resolveUploadPath } from '../utils/uploads.js'
import path from 'node:path'
import fs from 'node:fs'

export const uploadsRouter = Router()
uploadsRouter.get('*', async (req, res, next) => {
  try {
    const relative = req.path.replace(/^\//, '')
    if (!relative || relative.includes('..') || relative.includes('\\')) return res.sendStatus(400)
    // Only explicitly public image folders can bypass authentication.
    const publicImage = /^(logos|clients|contacts|avatars)\/[^/]+\.(png|jpe?g|gif|webp)$/i.test(relative)
    if (!publicImage) {
      if (!req.isAuthenticated() || req.user?.isActive === false) return res.sendStatus(401)
      if (relative.startsWith('documents/')) {
        const [document] = await db.select().from(documents).where(eq(documents.url, `/uploads/${relative}`)).limit(1)
        if (!document || !await canReadDocument(req.user, document)) return res.sendStatus(403)
      } else if (/^evidence-[^/]+$/.test(relative)) {
        const [request] = await db.select().from(reimbursementRequests).where(or(
          eq(reimbursementRequests.evidenceUrl, `/uploads/${relative}`),
          eq(reimbursementRequests.evidenceUrl, `uploads/${relative}`),
          eq(reimbursementRequests.evidenceUrl, `/api/uploads/${relative}`),
        )).limit(1)
        if (!request || (req.user?.role !== 'admin' && await resolveEmployeeId(req.user) !== request.employeeId)) return res.sendStatus(403)
      } else return res.sendStatus(404)
    }
    const filename = resolveUploadPath(relative)
    if (!fs.existsSync(filename)) return res.sendStatus(404)
    res.setHeader('Cache-Control', publicImage ? 'public, max-age=3600' : 'private, no-store')
    if (!publicImage && !/\.(pdf|png|jpe?g|gif|txt)$/i.test(path.extname(filename))) res.attachment(path.basename(filename))
    res.sendFile(filename)
  } catch (error) { next(error) }
})
