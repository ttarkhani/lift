import type { Tx } from "@/server/db/client";

export type ConfirmedResolution = {
  requestId: string;
  requestingTeamId: string;
  helpingTeamId: string;
  outcomeId: string;
  confirmedAt: Date;
};

/**
 * Runs in confirmOutcome's transaction, once per request: a reconfirmation after a reopen
 * never calls it. Step 4 creates the award here and recomputes the pair's points.
 */
export async function onResolutionConfirmed(tx: Tx, resolution: ConfirmedResolution): Promise<void> {
  void tx;
  void resolution;
}
