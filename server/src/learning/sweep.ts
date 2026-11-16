/**
 * The automatic Learning sweep: every so often, start a Learning run on each container.
 *
 * Learning otherwise runs when an administrator presses Learn now (learning/routes.ts's
 * `POST /runs`) or when the backend's own schedule decides. This is the deployment's counterpart,
 * for one that wants Learning to keep up on its own: on each pass the containers the Learning
 * settings name — the default container, and each Bot's own mapping — are enumerated and each gets
 * the same `manage.startLearningRun` the admin route calls, over whatever conversations finished
 * since the last run.
 *
 * PERSONAL SPACES ARE NOT SWEPT. A person's own Learning space (learning/personal-space.ts) is
 * recorded in `learning_person_spaces` by existence, not owned by settings, and the runs that
 * matter to an administrator are the Bot containers'. Sweeping every person's space would start a
 * run per person per pass, which is a scale decision, not a default.
 *
 * NEVER THROWS. A pass is a background nicety: Intelligence unreachable, a container gone, a
 * backend that refuses — each is logged and left for the next pass, and the server keeps running.
 *
 * CONCURRENCY. Two replicas sweeping the same hours would start two runs on one container, and
 * Intelligence runs one Learning run per container at a time. The guard is the run list itself: a
 * container with a run still queued or running is skipped this pass, so a replica that sweeps a
 * moment later skips it too, and nothing is doubled. The next pass starts the next run.
 */
import type { LearningSettings } from "@openbot/shared/learning";
import {
  DEPLOYMENT_INITIATOR,
  type AuditStore,
  recordAuditEvent,
} from "../audit";
import type { LearningManagement, Run } from "./review";

/** The run statuses that mean a container's Learning is still working. */
const IN_FLIGHT = new Set([
  "queued",
  "freezing",
  "batching",
  "reducing",
  "finalizing",
]);

export type LearningSweep = {
  /** One pass over every configured container. Resolves whatever happened; never rejects. */
  sweep: () => Promise<void>;
};

export function createLearningSweep(deps: {
  /** The runtime key's own Learning client, the same one the admin routes use. */
  manage: LearningManagement | undefined;
  /** The Learning settings, read fresh each pass: they name the containers. */
  readSettings: () => Promise<LearningSettings>;
  /** The audit trail a started run is recorded in; absent records nothing. */
  audit?: AuditStore;
  /** The pass summary; the default is the server's JSON console line. */
  log?: (entry: Record<string, unknown>) => void;
}): LearningSweep {
  const log = deps.log ?? ((entry) => console.info(JSON.stringify(entry)));
  return {
    async sweep() {
      let settings: LearningSettings;
      try {
        settings = await deps.readSettings();
      } catch (error) {
        console.error(
          JSON.stringify({
            type: "learning-sweep-error",
            containerId: null,
            error: error instanceof Error ? error.name : "UnknownError",
          }),
        );
        return;
      }
      // Automatic Learning switched off in Admin: the sweep runs nothing, by the same rule the
      // runtime's own delivery follows (personal-space.ts reads the same switch).
      if (!settings.enabled) return;
      const manage = deps.manage;
      if (!manage) return;
      const containers = [
        ...new Set(
          [
            settings.defaultTarget?.containerId,
            ...Object.values(settings.agents).map(
              (target) => target?.containerId,
            ),
          ].filter((id): id is string => typeof id === "string" && id !== ""),
        ),
      ];
      const report = {
        considered: containers.length,
        started: 0,
        skipped: 0,
        failed: 0,
      };
      for (const containerId of containers) {
        try {
          // A run still working holds its container: skip it, whichever order Intelligence listed
          // the runs in, so two replicas racing one pass cannot start the same run twice.
          const runs = await manage.listLearningRuns({ containerId });
          if (runs.some((run: Run) => IN_FLIGHT.has(run.status))) {
            report.skipped += 1;
            continue;
          }
          const run = await manage.startLearningRun({ containerId });
          report.started += 1;
          if (deps.audit)
            await recordAuditEvent(deps.audit, {
              eventType: "configuration.changed",
              targetType: "learning",
              initiator: DEPLOYMENT_INITIATOR,
              payload: {
                change: "learning_run_started",
                containerId,
                runId: run.id,
                by: "learning-sweep",
              },
            });
        } catch (error) {
          report.failed += 1;
          console.error(
            JSON.stringify({
              type: "learning-sweep-error",
              containerId,
              error: error instanceof Error ? error.name : "UnknownError",
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
      if (report.started || report.skipped || report.failed)
        log({
          type: "learning-sweep",
          ...report,
        });
    },
  };
}
