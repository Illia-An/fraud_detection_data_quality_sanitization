Hi,
To implement the TTS analysis functionality, we need a set of data views in the database. The functionality will cover order TTS, monitor Bump events, data cleaning based on the 30-second threshold, the impact on order TTS, and the use of the results in the Store × Month panel and Planner.
1. Main data view — dbo.V_TTS_OrderBump
This is the main requirement for the first version.
Each row should represent one Bump event from the monitor and include the related order data from TransH.
The view should include:
•	A common store ID (store_id).
•	The business date of the order (sale_date).
•	A common order ID (order_id) and a unique order key (order_key).
•	The Bump sequence number and unique Bump ID.
•	Order TTS from TransH (order_tts_sec), converted to seconds.
•	Bump start and end timestamps and the calculated Bump duration (bump_tts_sec).
•	Data quality flags, Bump validity, and information about whether the two sources were successfully joined.
•	Source information and the view load timestamp.
All Bump rows belonging to the same order must have the same order_tts_sec value.
2. Additional data views
To make development easier and improve performance, we would also like to have:
•	dbo.V_TTS_Order — one row per order, with Bump counts and duration statistics before and after applying the 30-second threshold.
•	dbo.V_TTS_StoreMonth — aggregated data by store, year, and month, for use in the Planner and Store × Month panel.
These two views are recommended but are not required for the first version.
3. Key requirement — joining TransH and McKiti
We need a reliable way to match each order in TransH with its related Bump events in McKiti.
Please confirm:
•	Whether both sources contain a common order ID or whether a reliable mapping can be created.
•	Whether StoreID in TransH matches StoreIndex in McKiti, or whether a store mapping table is needed.
•	How the business date and unique order key will be defined.
If the orders cannot be matched reliably, this must be identified and discussed before development starts. Without a common order key, the required functionality cannot be implemented correctly.
4. Monitor event source and data availability
The current monitor event source is the database view TargetsByMetrics_McKitiBump.
However, the product requirements focus on the meaning and structure of the data, not on this specific view. If the current view contains data for only one month, an extended view or an alternative view with the same data structure and level of detail will be required.
The source must provide the timestamps when an item appears on and is removed from the monitor, or equivalent timestamps, together with the related order and store IDs.
For testing, data covering at least two months is required. The target historical period should be agreed based on the availability of TransH data.
The source_view_mckiti field should contain the actual name of the view used in the implementation.
5. Data processing rules
For the first version, we need the following rules:
•	All TTS values in the output must be in seconds.
•	Void orders must be excluded from the calculations.
•	The impact analysis must use only orders successfully matched between TransH and McKiti.
•	Bump duration must be calculated from the start and end timestamps.
•	Missing or incorrect timestamps must be marked with data quality flags.
•	Bumps shorter than 30 seconds must be excluded from the filtered calculations, while the original values must remain available for comparison.
6. Acceptance criteria
Before the views are handed over for application development, we need to verify that:
•	A sample dataset is available for at least one store and two months, with enough matched orders for analysis.
•	The TransH and McKiti data are joined correctly, and the percentage of matched orders is documented.
•	All Bump rows belonging to the same order have the same order_tts_sec value.
•	The calculated Bump duration matches the source timestamps, with a maximum difference of one second.
•	The TTS units and value ranges are correct.
•	Short documentation is available, describing the sources, join keys, filters, and void order rules.
•	The available historical period is confirmed.
The views should also support efficient filtering by date range and, where needed, by store_id.
Expected result
The main deliverable is dbo.V_TTS_OrderBump, ready for use by the application. The additional views, dbo.V_TTS_Order and dbo.V_TTS_StoreMonth, would also be useful.
Please review the requirements, confirm whether the required fields and historical data are available in TransH and TargetsByMetrics_McKitiBump, and let us know about any technical limitations, especially those related to matching orders and data availability.
The detailed field specifications, data types, keys, and validation rules are provided in the attached technical specification.
Thank you!

