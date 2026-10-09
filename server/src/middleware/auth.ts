import type { NextFunction, Request, Response } from 'express'
import { supabaseAdmin } from '../supabaseAdmin.js'

export interface AuthedRequest extends Request {
  userId?: string
  userEmail?: string
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' })
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  req.userId = data.user.id
  req.userEmail = data.user.email ?? undefined
  next()
}
