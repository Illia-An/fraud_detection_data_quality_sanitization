Task: Implement an Interactive Onboarding Experience for the Analytics Platform
1. Objective

Implement an interactive, context-aware onboarding experience for the existing analytics platform.

The platform has two primary functional areas:

Fraud detection and data cleaning — processes source data, identifies and filters fraudulent or otherwise irrelevant records according to the existing business logic, and visualizes the results.
KPI planning — uses the cleaned or otherwise approved dataset to generate a KPI plan and presents the resulting metrics and trends visually.

The primary audience is managers rather than technical analysts. The onboarding must help users understand the business purpose of each area, interpret the results, and navigate from data cleaning to KPI planning.

This is an experimental feature branch. Feel free to experiment with the UI, interaction patterns, and implementation architecture when justified. However, preserve the existing application's business logic and avoid unnecessary changes to unrelated functionality.

Important: Do not assume the architecture, framework, routing, component library, data model, or available features. Inspect the existing project first and adapt the implementation to what is actually present.

2. Phase 1 — Explore the Existing Project

Before implementing anything, inspect the repository and determine:

The frontend framework, application structure, routing, and main entry points.
The existing dashboard and navigation structure.
The actual pages and components responsible for fraud detection/data cleaning.
The existing charts, metric cards, filters, and data visualization components.
The KPI planner, including its inputs, outputs, and current user workflow.
The authentication model and available user or workspace identifiers.
Existing state management, persistence mechanisms, API conventions, and design system.
Existing UI libraries that could support guided tours, popovers, tooltips, overlays, or spotlight effects.
Existing tests, linting rules, formatting conventions, and build commands.
Any existing onboarding, help, tutorial, or feature-discovery functionality.

Identify which parts of the proposed onboarding can reuse existing components and which require new implementation.

Do not introduce a new dependency until you have checked whether the current stack already provides a suitable solution.

Required output from this phase

Create a concise implementation plan containing:

The relevant pages and components discovered.
The proposed onboarding entry point.
The recommended implementation approach and rationale.
The proposed onboarding steps and their actual UI targets.
The persistence strategy appropriate to the existing architecture.
Potential integration risks and any assumptions that require validation.

After documenting the plan, proceed with implementation unless a genuine blocker prevents it. Do not stop after producing a report.

3. Phase 2 — Design the Onboarding Experience

Implement an interactive product tour using the existing application UI.

The experience should feel like a native part of the product, not a separate demo application.

Use a guided walkthrough with contextual spotlight overlays, compact tooltip cards, progress indication, and navigation controls. Adapt the exact number and sequence of steps to the real application.

Step 1: Welcome

Introduce the platform's end-to-end workflow.

Suggested copy:

Title: From Data to KPI Plan

Body: Learn how to review cleaned data, understand the results, and build a KPI plan based on the available data.

Primary action: Start tour

Secondary action: Skip

Keep the introduction short and focused on business outcomes.

If the application has no dataset, offer an existing demo dataset or sample workspace only if the project already supports one or it can be added safely. Do not fabricate a successful analysis or KPI plan.

If a dataset or KPI plan already exists, adapt the onboarding to the current state rather than forcing the user through setup steps that are no longer relevant.

Step 2: Dashboard Overview

Highlight the actual navigation or workspace elements that provide access to the core features.

Suggested copy:

Title: Your analytics workspace

Body: Review your data, inspect the results of fraud filtering, and move to KPI planning from your workspace.

Explain only the elements that exist in the current UI.

Step 3: Fraud Detection and Data Cleaning

Navigate to or highlight the actual data-cleaning interface.

Suggested copy:

Title: Understand your data quality

Body: Review the records processed by the platform, the records excluded according to the configured filtering rules, and the data available for further analysis.

Highlight the most relevant existing chart, metric cards, or result summary.

If the chart supports interaction, optionally explain how to inspect the underlying categories or filtering details.

Do not label all excluded records as confirmed fraud unless the existing business logic establishes that they are confirmed fraudulent records. Preserve the terminology used by the product.

Do not trigger a costly, destructive, or irreversible data-processing operation automatically just because the user advances through the tour.

Step 4: Explain the Cleaning Results

Highlight the existing result visualization, filters, date range, or summary metrics.

Suggested copy:

Title: Understand what changed

Body: Compare the original dataset with the data retained after filtering. Review the selected period and filtering criteria to understand which data is used for subsequent analysis.

Use existing visualizations and values. Do not invent before-and-after metrics or introduce fake production data.

If the application already supports before-and-after comparison, use it. Otherwise, explain the existing result chart without redesigning the entire analytics workflow.

Step 5: Transition to KPI Planning

Highlight the actual KPI planner navigation item, entry point, or primary action.

Suggested copy:

Title: Turn cleaned data into a plan

Body: Use the available data to build a KPI plan and explore the resulting targets, metrics, or forecasts.

Adapt the copy to the actual behavior of the planner. Do not imply that the planner uses cleaned data automatically if the user must explicitly select a dataset or initiate a separate calculation.

If an existing plan is available, guide the user toward it. If not, guide them to the existing plan-creation workflow.

Step 6: Explain the KPI Visualization

Highlight the actual chart and its legend, target values, historical data, forecast, or other relevant components.

Suggested copy:

Title: Understand your KPI plan

Body: Explore the metrics shown in the chart and review how the plan relates to the available historical data, targets, or forecasts.

Only describe data series and calculations that actually exist in the product.

Keep this step focused on managerial interpretation rather than technical implementation details.

Step 7: Completion

Suggested copy:

Title: You're ready to get started

Body: You now know how to review your data and navigate to KPI planning. Continue exploring your current workspace whenever you're ready.

Primary action: Return to dashboard

Provide an easy way to restart the tour later.

The steps above describe the intended experience, not a requirement to create seven separate routes or screens. Combine, remove, or reorder steps when necessary to match the actual product workflow.

4. Interaction Requirements

Implement the following behaviors:

Start the tour from the welcome screen.
Move forward and backward through the steps.
Skip the current step where appropriate.
Exit the entire tour at any point.
Show progress, such as "Step 3 of 6".
Persist onboarding progress where appropriate.
Resume an interrupted tour when it makes sense.
Allow completed tours to be restarted from an accessible Help or onboarding entry point.
Support users who already have data, existing analysis results, or a KPI plan.
Avoid showing tooltips for elements that do not exist or are unavailable in the current state.
Handle loading states, asynchronous processing, navigation changes, and missing target elements gracefully.
Ensure the user can continue using the application after dismissing onboarding.
Respect the application's existing authentication, permissions, and workspace boundaries.

Use a clear distinction between acknowledging a tutorial step and completing an actual business operation. Advancing through a tooltip must never falsely mark data cleaning or KPI generation as completed.

When an action is required to continue, provide an explicit, meaningful action instead of forcing the user to click arbitrary parts of the interface.

5. UI and UX Requirements

The onboarding should be polished, unobtrusive, and consistent with the existing design system.

Prefer:

Spotlight overlays that emphasize one relevant element at a time.
Compact tooltip cards with a clear title and concise explanation.
Existing typography, colors, spacing, buttons, icons, and border-radius conventions.
Stable target selectors, preferably dedicated attributes such as data-onboarding="fraud-results" where appropriate.
Sensible tooltip placement and collision handling near viewport boundaries.
Responsive behavior for different screen sizes.
Keyboard accessibility, visible focus states, and appropriate ARIA attributes.
Reduced-motion support where applicable.
A clear distinction between primary navigation actions and secondary controls such as Skip or Exit.

Avoid:

Long blocks of text inside tooltips.
Highlighting many unrelated elements at once.
Blocking the entire application unnecessarily.
Hard-coded pixel coordinates for targets when a stable element anchor is available.
Reliance on fragile CSS class names or DOM structure.
Adding decorative UI that does not serve the onboarding flow.
Introducing a new visual design system just for the tour.

If an existing third-party library fits the project, evaluate whether it can satisfy the requirements with minimal additional complexity. Otherwise, implement a reusable internal solution.

6. Architecture and State Management

Keep onboarding logic separate from the business logic of data cleaning and KPI planning.

Use the project's existing conventions wherever possible.

The implementation should have clear responsibilities for:

Tour configuration: step IDs, copy, target selectors, placement, and eligibility conditions.
Tour controller: active step, navigation, skip, exit, and completion.
UI rendering: overlays, spotlights, tooltip cards, and progress.
Product-state integration: determining whether the relevant dataset, chart, or KPI plan exists.
Persistence: storing the user's progress.
Analytics: tracking meaningful onboarding and activation events.

Prefer declarative step configuration over a large component containing hard-coded conditional branches.

Do not duplicate existing business calculations or reimplement chart logic for onboarding purposes.

Persistence

First inspect how the application currently stores user preferences and workspace state.

Use the existing persistence mechanism if appropriate.

Use server-side persistence if onboarding progress must follow authenticated users across devices and the application already has a suitable mechanism.
Use local persistence only when appropriate for the project's architecture and privacy model.
If the application has no suitable persistence layer, implement a minimal solution consistent with the existing stack rather than introducing an unrelated backend system.

Consider storing:

Tour identifier and version.
Current step identifier.
Completed or acknowledged steps.
Completion or dismissal status.
Timestamps if useful for analytics or resumption.

Handle schema changes or a new tour version gracefully so users are not stuck on obsolete steps.

Do not treat client-provided user IDs as trusted authorization information.

7. Analytics and Success Metrics

If the project already has analytics instrumentation, integrate with it. Otherwise, add a lightweight, well-isolated event interface only if appropriate.

Useful events include:

onboarding_started
onboarding_step_viewed
onboarding_step_completed
onboarding_skipped
onboarding_dismissed
onboarding_completed
fraud_analysis_completed
kpi_plan_created

Use the existing naming conventions if the project already has an event taxonomy.

Keep tutorial events separate from real product-operation events.

The primary success metrics should be:

Completion rate of the onboarding tour.
Drop-off rate by step.
Time to first successful data-cleaning result.
Time to first successfully created KPI plan.
Percentage of new users who create a KPI plan.

Do not introduce a heavyweight analytics dependency solely for this feature.

8. Testing and Verification

Add tests using the existing testing framework.

At minimum, verify:

The tour can start and display its first step.
Next and Back navigation work correctly.
Skip and Exit work from intermediate steps.
Completion state is persisted and restored correctly.
A completed tour can be restarted.
Missing target elements do not crash the application.
Existing datasets and KPI plans are handled correctly.
The tour does not trigger data-processing or KPI-generation operations without explicit user action.
Loading and error states are handled appropriately.
The onboarding does not break existing navigation or business workflows.
Responsive layouts and keyboard interaction are usable.

Run the relevant tests, linting, type checking, and build commands supported by the repository.

Fix regressions introduced by this implementation.

Do not claim that a test, build, or integration works unless you have actually verified it.

9. Implementation Scope and Freedom

This is an experimental feature branch, so you may:

Introduce a new onboarding component hierarchy.
Refactor small parts of the UI when necessary for stable integration.
Add a suitable dependency if it is justified and compatible with the project.
Improve the placement or sequencing of onboarding steps.
Add a demo-mode entry point if the current product can support it safely and the implementation is appropriately scoped.
Propose and implement UX improvements that make the tour more coherent.

However:

Preserve existing business logic and data integrity.
Do not rewrite unrelated modules.
Do not fabricate real analytics results.
Do not add unnecessary backend infrastructure.
Keep the implementation maintainable and easy to remove or evolve after the experiment.

If a proposed step cannot be implemented because the corresponding UI or functionality does not exist, adapt the flow to the actual product and document the decision rather than creating a misleading simulation.

10. Final Deliverables

When finished, provide:

A brief summary of the existing architecture you discovered.
A description of the implemented onboarding flow and its actual step sequence.
A list of files created or modified, with a short explanation of each.
Any dependencies added and why they were needed.
A description of how onboarding state is persisted.
The analytics events implemented, if any.
The tests and verification commands executed, including their actual results.
Any remaining limitations or integration issues.
Instructions for manually testing the full onboarding experience.

Definition of done: A user can start the onboarding, navigate through a coherent tour adapted to the real analytics platform, understand the relationship between data cleaning and KPI planning, dismiss or resume the experience as appropriate, and return to normal product usage without disruption.