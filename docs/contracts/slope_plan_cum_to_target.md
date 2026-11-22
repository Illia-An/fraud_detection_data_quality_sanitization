# Contract: Slope Hero Plan = linear cumulative path to target

**Branch:** `exp/slope-plan-cum-to-target`  
**Metric:** Q10012 five_percent (network Hero + store Inspect Slope)

## Product lock (4 steps)

1. **Actual → cumulative (chain)**  
   Equal-weight network monthly facts → **history** running mean (since data start / spine).

2. **Set target in cumulative**  
   Linear path from **history cum-as-of** (last plotted fact) → **network target** by Dec of planning year.

3. **Convert Plan → actual (monthly) Plan**  
   `m_k = (n+k)·c_k − (n+k−1)·c_{k−1}` (network monthly Plan).

4. **Chain → stores → store cumulative**  
   Allocate each future chain monthly level to stores (equal-weight mean = chain Plan;
   priority to stores further from that level). Mirror store actual through handoff.
   Store cumulative Plan = **history** running mean of allocated store monthlies.

## Other locks

- **Plan ≠ Simulation** — Simulation stays live slope forecast.
- **Grain:** Plan cum attaches to the history-cum curve at cutover (no YTD reset jump).
- **YTD cum** remains available as an opt-in series (not the Plan handoff).
- Store Inspect **Plan** comes from step 4. Chart target = network target.
  Unreachable implied hints remain from simulation.
- **UI:** Slope Hero is the only network Hero (Legacy evaluation chart / toggle removed).

## Non-goals (this experiment)

- Smooth / trajectory_power variants (linear only)
- TTS planner parity

## Follow-up

- Save of edited pin paths: see [`slope_plan_point_drag.md`](slope_plan_point_drag.md) Phase 2 (Option A client monthlies).
