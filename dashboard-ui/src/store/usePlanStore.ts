// Per-video Stage α plan + render lifecycle store. Owns the SSE subscriptions
// for the planner job, polls for the auto-spawned render job, then takes over
// the render SSE, and finally surfaces the reflection + rating block.
//
// Keyed by videoId — multiple panels can be in flight in parallel
// (planner is concurrent-safe; render is GPU-serialized server-side).

import { create } from 'zustand';
import type { ProgressEvent, ValidatorVerdict } from '../api/types';
import {
  planAndRender,
  subscribeToProgress,
  getReflection,
  submitRating as apiSubmitRating,
  getVideo as apiGetVideo,
} from '../api/client';
import { toast } from './useToastStore';

export interface TokenEstimate {
  inputTokensEst?: number;
  outputTokensEst?: number;
  promptBytes?: number;
  outputBytes?: number;
}

export type PlanState =
  | { mode: 'idle' }
  | {
      mode: 'planning';
      jobId: string;
      lines: string[];
      tokens: TokenEstimate;
      pendingVerdict: ValidatorVerdict | null;
    }
  | {
      mode: 'validator-rejected';
      jobId: string;
      lines: string[];
      verdict: ValidatorVerdict;
      tokens: TokenEstimate;
    }
  | {
      mode: 'planner-failed';
      jobId: string;
      lines: string[];
      error: string;
    }
  | {
      mode: 'rendering';
      planJobId: string;
      renderJobId: string;
      planLines: string[];
      renderLines: string[];
      verdict: ValidatorVerdict;
      tokens: TokenEstimate;
      renderProgress: number | null;
    }
  | {
      mode: 'render-failed';
      renderJobId: string;
      planLines: string[];
      renderLines: string[];
      verdict: ValidatorVerdict;
      tokens: TokenEstimate;
    }
  | {
      mode: 'done-awaiting-rating';
      renderJobId: string;
      planLines: string[];
      renderLines: string[];
      verdict: ValidatorVerdict;
      tokens: TokenEstimate;
      reflection: string | null;
    }
  | {
      mode: 'rated';
      verdict: ValidatorVerdict;
      tokens: TokenEstimate;
      reflection: string | null;
      rating: number;
      note: string;
    };

interface PlanStore {
  byVideoId: Record<string, PlanState>;

  // Internal — not selected by components. Two parallel maps so cleanup can
  // be exhaustive without coordinating across slices.
  _subs: Map<string, () => void>;
  _polls: Map<string, number>;

  startPlan: (videoId: string) => Promise<void>;
  /** Re-trigger after a validator rejection or planner crash. Same as startPlan
   *  after a clean reset. */
  retry: (videoId: string) => Promise<void>;
  closePanel: (videoId: string) => void;
  reset: (videoId: string) => void;
  submitRating: (videoId: string, rating: number, note: string) => Promise<void>;
}

const TOKEN_RE_INPUT = /\[planner\] prompt: (\d+) bytes \(~(\d+) input tokens\)/;
const TOKEN_RE_OUTPUT = /\[planner\] output: (\d+) bytes \(~(\d+) output tokens\)/;
const RENDER_PROGRESS_RE = /(\d+)\s*\/\s*(\d+)\s*frames/;

const LINE_BUFFER_LIMIT = 500;
const RENDER_POLL_INTERVAL_MS = 1500;
const RENDER_POLL_MAX_MS = 15_000;

function pushBounded(buf: string[], text: string): string[] {
  const next = buf.length >= LINE_BUFFER_LIMIT ? buf.slice(1) : buf.slice();
  next.push(text);
  return next;
}

function cleanup(videoId: string): void {
  const { _subs, _polls } = usePlanStore.getState();
  const sub = _subs.get(videoId);
  if (sub) sub();
  const poll = _polls.get(videoId);
  if (poll != null) clearInterval(poll);
  usePlanStore.setState((s) => {
    const subs = new Map(s._subs);
    subs.delete(videoId);
    const polls = new Map(s._polls);
    polls.delete(videoId);
    return { _subs: subs, _polls: polls };
  });
}

function setState(videoId: string, next: PlanState): void {
  usePlanStore.setState((s) => ({
    byVideoId: { ...s.byVideoId, [videoId]: next },
  }));
}

function getState(videoId: string): PlanState | undefined {
  return usePlanStore.getState().byVideoId[videoId];
}

// ─── plan-job event handlers ────────────────────────────────────────────

function onPlanLine(videoId: string, text: string): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'planning') return;

  const inMatch = text.match(TOKEN_RE_INPUT);
  const outMatch = text.match(TOKEN_RE_OUTPUT);
  const tokens: TokenEstimate = { ...cur.tokens };
  if (inMatch) {
    tokens.promptBytes = Number(inMatch[1]);
    tokens.inputTokensEst = Number(inMatch[2]);
  }
  if (outMatch) {
    tokens.outputBytes = Number(outMatch[1]);
    tokens.outputTokensEst = Number(outMatch[2]);
  }

  setState(videoId, {
    ...cur,
    lines: pushBounded(cur.lines, text),
    tokens,
  });
}

function onValidatorPassed(videoId: string, verdict: ValidatorVerdict): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'planning') return;
  setState(videoId, { ...cur, pendingVerdict: verdict });
}

function onValidatorRejected(videoId: string, verdict: ValidatorVerdict): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'planning') return;
  setState(videoId, {
    mode: 'validator-rejected',
    jobId: cur.jobId,
    lines: cur.lines,
    verdict,
    tokens: cur.tokens,
  });
  toast.error('المخطّط مرفوض من الـ brand validator');
}

function onPlanDone(videoId: string, exitCode: number): void {
  const cur = getState(videoId);
  if (!cur) return;

  // Validator-rejected is terminal: keep it.
  if (cur.mode === 'validator-rejected') return;
  if (cur.mode !== 'planning') return;

  if (exitCode !== 0) {
    setState(videoId, {
      mode: 'planner-failed',
      jobId: cur.jobId,
      lines: cur.lines,
      error: `planner exited with code ${exitCode}`,
    });
    toast.error('Planner subprocess failed');
    return;
  }

  if (!cur.pendingVerdict) {
    setState(videoId, {
      mode: 'planner-failed',
      jobId: cur.jobId,
      lines: cur.lines,
      error: 'planner exited cleanly but validator never ran (server bug?)',
    });
    return;
  }
  if (!cur.pendingVerdict.passed) {
    // Defensive — validator-rejected event should have already fired.
    return;
  }
  startRenderPoll(videoId, cur.jobId, cur.lines, cur.tokens, cur.pendingVerdict);
}

function onPlanError(videoId: string, message: string): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'planning') return;
  setState(videoId, {
    ...cur,
    lines: pushBounded(cur.lines, `[error] ${message}`),
  });
}

// ─── render-job discovery + handlers ────────────────────────────────────

function startRenderPoll(
  videoId: string,
  planJobId: string,
  planLines: string[],
  tokens: TokenEstimate,
  verdict: ValidatorVerdict,
): void {
  const start = Date.now();
  const tick = async (): Promise<void> => {
    let video;
    try {
      video = await apiGetVideo(videoId);
    } catch {
      return;
    }
    const renderPhase = video.phases.render;
    if (renderPhase?.lastJobId && renderPhase.status === 'running') {
      stopRenderPoll(videoId);
      transitionToRendering(
        videoId,
        planJobId,
        renderPhase.lastJobId,
        planLines,
        tokens,
        verdict,
      );
      return;
    }
    if (Date.now() - start > RENDER_POLL_MAX_MS) {
      stopRenderPoll(videoId);
      const cur = getState(videoId);
      if (cur?.mode === 'planning') {
        setState(videoId, {
          mode: 'planner-failed',
          jobId: cur.jobId,
          lines: cur.lines,
          error: 'validator passed but render job did not start in time',
        });
        toast.error('Auto-render did not start');
      }
    }
  };
  const handle = window.setInterval(() => {
    void tick();
  }, RENDER_POLL_INTERVAL_MS);
  usePlanStore.setState((s) => {
    const polls = new Map(s._polls);
    polls.set(videoId, handle);
    return { _polls: polls };
  });
  void tick();
}

function stopRenderPoll(videoId: string): void {
  const { _polls } = usePlanStore.getState();
  const handle = _polls.get(videoId);
  if (handle != null) clearInterval(handle);
  usePlanStore.setState((s) => {
    const polls = new Map(s._polls);
    polls.delete(videoId);
    return { _polls: polls };
  });
}

function transitionToRendering(
  videoId: string,
  planJobId: string,
  renderJobId: string,
  planLines: string[],
  tokens: TokenEstimate,
  verdict: ValidatorVerdict,
): void {
  setState(videoId, {
    mode: 'rendering',
    planJobId,
    renderJobId,
    planLines,
    renderLines: [],
    verdict,
    tokens,
    renderProgress: null,
  });

  const oldUnsub = usePlanStore.getState()._subs.get(videoId);
  if (oldUnsub) oldUnsub();

  const unsub = subscribeToProgress(renderJobId, (ev) => onRenderEvent(videoId, ev));
  usePlanStore.setState((s) => {
    const subs = new Map(s._subs);
    subs.set(videoId, unsub);
    return { _subs: subs };
  });
}

function onRenderEvent(videoId: string, ev: ProgressEvent): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'rendering') return;

  if (ev.type === 'line') {
    const next: PlanState = {
      ...cur,
      renderLines: pushBounded(cur.renderLines, ev.text),
    };
    const m = ev.text.match(RENDER_PROGRESS_RE);
    if (m) {
      const done = Number(m[1]);
      const total = Number(m[2]);
      if (total > 0 && next.mode === 'rendering') {
        next.renderProgress = done / total;
      }
    }
    setState(videoId, next);
  } else if (ev.type === 'done') {
    if (ev.exitCode === 0) {
      void getReflection(videoId)
        .then((r) => transitionToDone(videoId, r.text))
        .catch(() => transitionToDone(videoId, null));
    } else {
      setState(videoId, {
        mode: 'render-failed',
        renderJobId: cur.renderJobId,
        planLines: cur.planLines,
        renderLines: cur.renderLines,
        verdict: cur.verdict,
        tokens: cur.tokens,
      });
      toast.error('Render failed');
    }
  } else if (ev.type === 'error') {
    setState(videoId, {
      ...cur,
      renderLines: pushBounded(cur.renderLines, `[error] ${ev.message}`),
    });
  }
}

function transitionToDone(videoId: string, reflection: string | null): void {
  const cur = getState(videoId);
  if (cur?.mode !== 'rendering') return;
  setState(videoId, {
    mode: 'done-awaiting-rating',
    renderJobId: cur.renderJobId,
    planLines: cur.planLines,
    renderLines: cur.renderLines,
    verdict: cur.verdict,
    tokens: cur.tokens,
    reflection,
  });
  toast.success('Render done — قيّم الريل');
}

// ─── store ──────────────────────────────────────────────────────────────

export const usePlanStore = create<PlanStore>((set, get) => ({
  byVideoId: {},
  _subs: new Map(),
  _polls: new Map(),

  startPlan: async (videoId) => {
    cleanup(videoId);

    setState(videoId, {
      mode: 'planning',
      jobId: '',
      lines: [],
      tokens: {},
      pendingVerdict: null,
    });

    let resp;
    try {
      resp = await planAndRender(videoId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState(videoId, {
        mode: 'planner-failed',
        jobId: '',
        lines: [`[startPlan error] ${msg}`],
        error: msg,
      });
      toast.error(`Plan failed to start: ${msg}`);
      return;
    }

    const planJobId = resp.jobId;
    setState(videoId, {
      mode: 'planning',
      jobId: planJobId,
      lines: [],
      tokens: {},
      pendingVerdict: null,
    });

    const unsub = subscribeToProgress(planJobId, (ev) => {
      if (ev.type === 'line') onPlanLine(videoId, ev.text);
      else if (ev.type === 'validator-passed') onValidatorPassed(videoId, ev.verdict);
      else if (ev.type === 'validator-rejected') onValidatorRejected(videoId, ev.verdict);
      else if (ev.type === 'done') onPlanDone(videoId, ev.exitCode);
      else if (ev.type === 'error') onPlanError(videoId, ev.message);
    });
    set((s) => {
      const subs = new Map(s._subs);
      subs.set(videoId, unsub);
      return { _subs: subs };
    });
  },

  retry: async (videoId) => {
    await get().startPlan(videoId);
  },

  closePanel: (videoId) => {
    cleanup(videoId);
    set((s) => {
      const next = { ...s.byVideoId };
      delete next[videoId];
      return { byVideoId: next };
    });
  },

  reset: (videoId) => {
    cleanup(videoId);
    setState(videoId, { mode: 'idle' });
  },

  submitRating: async (videoId, rating, note) => {
    try {
      await apiSubmitRating(videoId, rating, note);
      const cur = getState(videoId);
      if (cur?.mode === 'done-awaiting-rating') {
        setState(videoId, {
          mode: 'rated',
          verdict: cur.verdict,
          tokens: cur.tokens,
          reflection: cur.reflection,
          rating,
          note,
        });
      }
      toast.success(`Rating saved — ${rating}/5`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Rating failed: ${msg}`);
      throw e;
    }
  },
}));
