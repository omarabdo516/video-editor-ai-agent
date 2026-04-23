import { useMemo } from 'react';
import {
  useDashboardStore,
  type SortField,
  type GroupField,
  type StatusFilter,
} from '../store/useDashboardStore';
import { videoStatus } from '../utils/videoHelpers';

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'addedAt', label: 'Date' },
  { value: 'name', label: 'Name' },
  { value: 'rating', label: 'Rating' },
  { value: 'duration', label: 'Duration' },
  { value: 'progress', label: 'Progress' },
];

const GROUP_OPTIONS: Array<{ value: GroupField; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'lecturer', label: 'Lecturer' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'Active' },
  { value: 'done', label: 'Done' },
  { value: 'rated', label: 'Rated' },
];

export function SidebarControls() {
  const videos = useDashboardStore((s) => s.videos);
  const filters = useDashboardStore((s) => s.filters);
  const setFilter = useDashboardStore((s) => s.setFilter);
  const clearFilters = useDashboardStore((s) => s.clearFilters);
  const sortField = useDashboardStore((s) => s.sortField);
  const sortDir = useDashboardStore((s) => s.sortDir);
  const setSortField = useDashboardStore((s) => s.setSortField);
  const toggleSortDir = useDashboardStore((s) => s.toggleSortDir);
  const groupBy = useDashboardStore((s) => s.groupBy);
  const setGroupBy = useDashboardStore((s) => s.setGroupBy);

  // Counts per status
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: videos.length, pending: 0, in_progress: 0, done: 0, rated: 0 };
    for (const v of videos) {
      const s = videoStatus(v);
      counts[s]++;
    }
    // "done" in filter also shows "rated"
    counts.done += counts.rated;
    return counts;
  }, [videos]);

  // Extract unique values for filter dropdowns
  const lecturers = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) if (v.lecturer) set.add(v.lecturer);
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [videos]);

  const workshops = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) if (v.workshop) set.add(v.workshop);
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [videos]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) if (v.category) set.add(v.category);
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [videos]);

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.lecturer !== null ||
    filters.workshop !== null ||
    filters.category !== null;

  return (
    <div className="flex flex-col gap-2">
      {/* Status chips — with counts */}
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((opt) => {
          const active = filters.status === opt.value;
          const count = statusCounts[opt.value];
          // Hide status options with 0 count (except "All")
          if (count === 0 && opt.value !== 'all') return null;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter('status', active && opt.value !== 'all' ? 'all' : opt.value)}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors"
              style={{
                background: active ? 'var(--color-brand-accent)' : 'var(--color-bg-elevated)',
                color: active ? '#000' : 'var(--color-text-muted)',
                border: `1px solid ${active ? 'var(--color-brand-accent)' : 'var(--color-border-subtle)'}`,
              }}
            >
              {opt.label}
              <span
                className="ml-1 tabular-nums"
                style={{ opacity: 0.7 }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dropdown filters — only show if there are multiple options */}
      {(lecturers.length > 1 || workshops.length > 1 || categories.length > 0) && (
        <div className="flex items-center gap-1.5">
          {lecturers.length > 1 && (
            <FilterSelect
              value={filters.lecturer}
              onChange={(v) => setFilter('lecturer', v)}
              options={lecturers}
              placeholder="Lecturer"
            />
          )}
          {workshops.length > 1 && (
            <FilterSelect
              value={filters.workshop}
              onChange={(v) => setFilter('workshop', v)}
              options={workshops}
              placeholder="Workshop"
            />
          )}
          {categories.length > 0 && (
            <FilterSelect
              value={filters.category}
              onChange={(v) => setFilter('category', v)}
              options={categories}
              placeholder="Category"
            />
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors"
              style={{ color: 'var(--color-status-failed)' }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Sort + Group row */}
      <div className="flex items-center gap-1.5">
        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="min-w-0 flex-1 rounded px-1.5 py-1 text-[10px]"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>Sort: {o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleSortDir}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px]"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-subtle)',
            color: 'var(--color-text-secondary)',
          }}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        <span className="h-3 w-px shrink-0" style={{ background: 'var(--color-border-subtle)' }} />

        {/* Group */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupField)}
          className="min-w-0 flex-1 rounded px-1.5 py-1 text-[10px]"
          style={{
            background: groupBy !== 'none' ? 'rgba(255, 181, 1, 0.08)' : 'var(--color-bg-elevated)',
            border: `1px solid ${groupBy !== 'none' ? 'rgba(255, 181, 1, 0.25)' : 'var(--color-border-subtle)'}`,
            color: groupBy !== 'none' ? 'var(--color-brand-accent)' : 'var(--color-text-secondary)',
          }}
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Group: {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[10px]"
      style={{
        background: value ? 'rgba(255, 181, 1, 0.08)' : 'var(--color-bg-elevated)',
        border: `1px solid ${value ? 'rgba(255, 181, 1, 0.25)' : 'var(--color-border-subtle)'}`,
        color: value ? 'var(--color-brand-accent)' : 'var(--color-text-muted)',
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
