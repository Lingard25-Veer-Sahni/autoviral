import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { searchImages, imageSearchConfigured } from '../services/imageSearch.js'

const router = Router()

// GET /api/media/image-search?query=...&perPage=..., backs the image-mode
// "search for an image" dropdown in Create Video. Real Pexels Photos search,
// server-side (keeps the API key off the client), auth-gated like every
// other endpoint that does real work on the user's behalf.
router.get('/image-search', requireAuth, async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query : ''
  if (!query.trim()) {
    return res.status(400).json({ error: 'query is required' })
  }
  if (!imageSearchConfigured) {
    return res.status(503).json({ error: 'Image search is not configured (PEXELS_API_KEY missing).', results: [] })
  }

  const perPageRaw = Number(req.query.perPage)
  const perPage = Number.isFinite(perPageRaw) && perPageRaw > 0 ? perPageRaw : 16

  const results = await searchImages(query, perPage)
  res.json({ results })
})

export default router
