import { Router } from 'express';
import {
  getVideos,
  getVideo,
  addVideo,
  removeVideo,
} from '../lib/state.mjs';

export const videosRouter = Router();

videosRouter.get('/', (_req, res) => {
  res.json({ videos: getVideos() });
});

videosRouter.post('/', (req, res) => {
  const { path: videoPath, name, lecturer, workshop } = req.body || {};
  if (!videoPath) {
    return res.status(400).json({ error: 'path is required' });
  }
  try {
    const video = addVideo({ path: videoPath, name, lecturer, workshop });
    res.status(201).json({ video });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

videosRouter.get('/:id', (req, res) => {
  const video = getVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  res.json({ video });
});

videosRouter.delete('/:id', (req, res) => {
  const ok = removeVideo(req.params.id);
  if (!ok) return res.status(404).json({ error: 'video not found' });
  res.json({ ok: true });
});
