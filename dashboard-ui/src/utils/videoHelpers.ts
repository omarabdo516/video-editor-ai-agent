import type { Video } from '../api/types';
import type { Filters, GroupField, SortField, SortDir, StatusFilter } from '../store/useDashboardStore';

const PHASE_KEYS = ['phase1', 'transcribe', 'edit', 'analyze', 'microEvents', 'render'] as const;

/** Overall video status for filtering/grouping. */
export function videoStatus(v: Video): StatusFilter {
  if (v.rating != null) return 'rated';
  const statuses = PHASE_KEYS.map((p) => v.phases[p]?.status ?? 'pending');
  if (statuses.every((s) => s === 'done')) return 'done';
  if (statuses.some((s) => s === 'running')) return 'in_progress';
  if (statuses.some((s) => s === 'done')) return 'in_progress';
  return 'pending';
}

/** Human-readable status label. */
export function statusLabel(s: StatusFilter): string {
  switch (s) {
    case 'all': return 'All';
    case 'pending': return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'done': return 'Done';
    case 'rated': return 'Rated';
  }
}

/** Phase completion count (0-6). */
export function phaseProgress(v: Video): number {
  return PHASE_KEYS.filter((p) => v.phases[p]?.status === 'done').length;
}

/** Apply filters to a video list. */
export function applyFilters(videos: Video[], filters: Filters): Video[] {
  return videos.filter((v) => {
    // Status filter
    if (filters.status !== 'all') {
      const vs = videoStatus(v);
      // 'done' should also match 'rated'
      if (filters.status === 'done' && vs !== 'done' && vs !== 'rated') return false;
      if (filters.status !== 'done' && vs !== filters.status) return false;
    }
    // Lecturer filter
    if (filters.lecturer && v.lecturer !== filters.lecturer) return false;
    // Workshop filter
    if (filters.workshop && v.workshop !== filters.workshop) return false;
    // Category filter
    if (filters.category === '__none__' && v.category) return false;
    if (filters.category && filters.category !== '__none__' && v.category !== filters.category) return false;
    return true;
  });
}

/** Sort a video list. */
export function sortVideos(videos: Video[], field: SortField, dir: SortDir): Video[] {
  return [...videos].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = (a.name || '').localeCompare(b.name || '', 'ar');
        break;
      case 'addedAt':
        cmp = (a.addedAt || '').localeCompare(b.addedAt || '');
        break;
      case 'rating':
        cmp = (a.rating ?? -1) - (b.rating ?? -1);
        break;
      case 'duration':
        cmp = (a.duration_sec ?? 0) - (b.duration_sec ?? 0);
        break;
      case 'progress':
        cmp = phaseProgress(a) - phaseProgress(b);
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export interface VideoGroup {
  key: string;
  label: string;
  videos: Video[];
}

/** Group videos by a field. Returns groups with sorted videos inside. */
export function groupVideos(
  videos: Video[],
  groupBy: GroupField,
  sortField: SortField,
  sortDir: SortDir,
): VideoGroup[] {
  if (groupBy === 'none') {
    return [{ key: '__all__', label: '', videos: sortVideos(videos, sortField, sortDir) }];
  }

  const buckets = new Map<string, Video[]>();
  const uncatKey = 'Uncategorized';

  for (const v of videos) {
    let key: string;
    switch (groupBy) {
      case 'lecturer':
        key = v.lecturer || uncatKey;
        break;
      case 'workshop':
        key = v.workshop || uncatKey;
        break;
      case 'category':
        key = v.category || uncatKey;
        break;
      case 'status':
        key = statusLabel(videoStatus(v));
        break;
      default:
        key = uncatKey;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(v);
  }

  // Sort groups: named groups first (alphabetical), Uncategorized last
  const groups = [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === uncatKey) return 1;
      if (b === uncatKey) return -1;
      return a.localeCompare(b, 'ar');
    })
    .map(([key, vids]) => ({
      key,
      label: key,
      videos: sortVideos(vids, sortField, sortDir),
    }));

  return groups;
}
