import { useCallback, useRef, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { toast } from '../store/useToastStore';
import type { PhaseId } from '../api/types';

type JobPhase = Exclude<PhaseId, 'edit' | 'analyze'>;

interface AutoChainState {
  running: boolean;
  currentPhase: JobPhase | null;
  error: string | null;
}

/**
 * Runs a sequence of phases on a single video, waiting for each
 * to complete before starting the next. Returns controls + state.
 */
export function useAutoChain(videoId: string) {
  const [state, setState] = useState<AutoChainState>({
    running: false,
    currentPhase: null,
    error: null,
  });
  const cancelledRef = useRef(false);

  const runChain = useCallback(
    async (phases: JobPhase[], label: string) => {
      cancelledRef.current = false;
      setState({ running: true, currentPhase: null, error: null });

      for (const phase of phases) {
        if (cancelledRef.current) {
          setState({ running: false, currentPhase: null, error: null });
          toast.warning(`${label} cancelled`);
          return;
        }

        setState((s) => ({ ...s, currentPhase: phase }));

        // Kick off the phase
        try {
          await useDashboardStore.getState().runPhase(videoId, phase);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setState({ running: false, currentPhase: null, error: msg });
          toast.error(`${label} failed at ${phase}: ${msg}`);
          return;
        }

        // Wait for the phase to finish by polling the video's phase state
        const ok = await waitForPhase(videoId, phase);
        if (!ok) {
          // Phase failed
          const video = useDashboardStore.getState().videos.find((v) => v.id === videoId);
          const err = video?.phases[phase]?.error ?? 'unknown error';
          setState({ running: false, currentPhase: null, error: err });
          toast.error(`${label} stopped — ${phase} failed`);
          return;
        }
      }

      setState({ running: false, currentPhase: null, error: null });
      toast.success(`${label} complete`);
    },
    [videoId],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const autoPrep = useCallback(
    () => runChain(['phase1', 'transcribe'], 'Auto-Prep'),
    [runChain],
  );

  const autoFinish = useCallback(
    () => runChain(['microEvents', 'render'], 'Auto-Finish'),
    [runChain],
  );

  return { ...state, autoPrep, autoFinish, cancel };
}

/** Polls the store until the phase is done or failed. Resolves true if done, false if failed. */
function waitForPhase(videoId: string, phase: PhaseId): Promise<boolean> {
  return new Promise((resolve) => {
    const check = () => {
      const video = useDashboardStore.getState().videos.find((v) => v.id === videoId);
      if (!video) {
        resolve(false);
        return;
      }
      const status = video.phases[phase]?.status;
      if (status === 'done') {
        resolve(true);
        return;
      }
      if (status === 'failed') {
        resolve(false);
        return;
      }
      // Still running or pending — check again
      setTimeout(check, 500);
    };
    // Start checking after a short delay to let optimistic update settle
    setTimeout(check, 300);
  });
}
