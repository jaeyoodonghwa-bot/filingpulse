import { Actor, log } from "apify";
import { createCoreSignalProvider } from "./core-provider.js";
import {
  EVENT_NAME,
  normalizeInput,
  runSignalPipeline,
  type ActorInput,
} from "./runner.js";

await Actor.init();

try {
  const rawInput = (await Actor.getInput<ActorInput>()) ?? {};
  const input = normalizeInput(rawInput);

  // Respect Apify's maxTotalChargeUsd budget automatically via ChargingManager when available
  const chargingManager = Actor.getChargingManager();
  const maxChargeableByBudget =
    chargingManager?.calculateMaxEventChargeCountWithinLimit(EVENT_NAME);

  const effectiveLimit =
    typeof maxChargeableByBudget === "number" &&
    Number.isFinite(maxChargeableByBudget) &&
    maxChargeableByBudget >= 0
      ? Math.min(input.maxItems, maxChargeableByBudget)
      : input.maxItems;

  log.info("Starting FilingPulse SEC Signal Extractor", {
    tickers: input.tickers,
    maxItems: input.maxItems,
    effectiveLimit,
    lookbackDays: input.lookbackDays,
    fixtureMode: input.fixtureMode,
  });

  if (effectiveLimit === 0) {
    log.warning(
      "Budget limit (maxTotalChargeUsd) allows 0 filing-signal charges; exiting without fetching."
    );
    await Actor.setStatusMessage(
      "Skipped: maxTotalChargeUsd budget too low for 1 filing-signal ($0.005)."
    );
  } else {
    const provider = createCoreSignalProvider();

    const result = await runSignalPipeline(
      { ...input, maxItems: effectiveLimit },
      provider,
      async (record) => {
        await Actor.pushData(record);
        const chargeResult = await Actor.charge({
          eventName: EVENT_NAME,
          count: 1,
        });
        return {
          limitReached: Boolean(chargeResult?.eventChargeLimitReached),
        };
      }
    );

    log.info("FilingPulse run completed", {
      tickersProcessed: result.tickersProcessed,
      emittedCount: result.emittedCount,
      chargedCount: result.chargedCount,
      estimatedChargeUsd: result.estimatedChargeUsd,
      stoppedByBudget: result.stoppedByBudget,
      stoppedByMaxItems: result.stoppedByMaxItems,
    });

    await Actor.setStatusMessage(
      `Extracted ${result.emittedCount} SEC signal(s) across ${result.tickersProcessed} ticker(s) ($${result.estimatedChargeUsd.toFixed(4)} PPE).`
    );
  }
} catch (error) {
  log.error("FilingPulse Actor failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
} finally {
  await Actor.exit();
}
