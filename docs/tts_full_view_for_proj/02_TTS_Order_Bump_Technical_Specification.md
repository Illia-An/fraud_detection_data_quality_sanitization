Technical Specification: TTS Order × Bump Data Views
1. Purpose
The goal is to create database views that combine order TTS from TransH with monitor Bump events from McKiti.
The data will be used for:
•	Order TTS analysis, in seconds.
•	Analysis of all Bump events linked to each order.
•	Data cleaning based on the 30-second threshold.
•	Measuring the impact of Bump filtering on order TTS.
•	Providing data for the Store × Month panel and Planner.
The main required view is dbo.V_TTS_OrderBump.
2. Required and recommended views
View	Data level	Priority
dbo.V_TTS_OrderBump	One row per Bump	Required
dbo.V_TTS_Order	One row per order	Recommended
dbo.V_TTS_StoreMonth	One row per store, year, and month	Recommended
The application can work with the main view only. The other two views can improve performance and simplify data checks.
3. Main view — dbo.V_TTS_OrderBump
Purpose: One row per monitor Bump event, including the related order data from TransH.
3.1. Order and Bump identifiers
Field	Data type	Required	Description
store_id	int	NOT NULL	Common store ID: StoreID from TransH and StoreIndex from McKiti after mapping
sale_date	date	NOT NULL	Business date of the order, without time
order_id	nvarchar(64)	NOT NULL	Common order ID used in both systems
order_key	nvarchar(128)	NOT NULL	Deterministic unique key for the order
bump_seq	int	NOT NULL	Bump sequence number within the order
bump_uid	nvarchar(128)	NOT NULL	Unique identifier for the Bump row
Key requirements:
•	Logical row key: (store_id, sale_date, order_id, bump_seq).
•	bump_uid must be unique.
•	Bump sequence numbers must be stable and follow the agreed order, using UpDatetime, SortOrder, and MeitNumber.
3.2. Order data from TransH
Field	Data type	Required	Description
order_tts_sec	float	NOT NULL for clean v1	Order TTS in seconds
order_tts_source	nvarchar(32)	NOT NULL	TTS source, for example TRHE_StoredTime
order_tts_unit_raw	nvarchar(8)	NOT NULL	Original unit: sec or min
order_sales_type	int	NULL	Sales type from TRHE_SalesType
order_channel	nvarchar(16)	NULL	Order channel: delivery, counter, other, or NULL
order_is_void	bit	NOT NULL	Indicates whether the order is void
transh_row_present	bit	NOT NULL	1 if the order exists in TransH; otherwise 0
If the source stores TTS in minutes, the value must be converted to seconds. The original unit must remain available for checking.
For the first version, the impact analysis should use only orders matched between TransH and McKiti.
3.3. Bump data from McKiti
The current monitor event source is the database view TargetsByMetrics_McKitiBump.
This view should be used if it provides all required fields and enough historical data. If not, an extended or alternative view with the same data structure and level of detail will be required.
Field	Data type	Required	Description
up_datetime	datetime2	NOT NULL	Time when the item appears on the monitor
bump_datetime	datetime2	NULL	Time when the item is removed from the monitor
bump_tts_sec	float	NULL	Bump duration in seconds, calculated from start and end timestamps
kvs_group	int	NULL	KVS group
meit_number	int	NULL	Item or product position
sort_order	int	NULL	Sort order
mckiti_row_present	bit	NOT NULL	1 if the row comes from the McKiti source
The source must also provide, directly or through a reliable mapping:
•	The related order ID.
•	The store ID.
•	The business date or enough information to calculate it.
bump_tts_sec should be NULL if the end timestamp is missing or if the calculated duration is negative.
3.4. Data quality and filtering flags
Field	Data type	Required	Description
bump_ge30	bit	NOT NULL	1 if bump_tts_sec >= 30
bump_valid	bit	NOT NULL	1 if the timestamps are valid and the duration is not NULL or negative
join_match	bit	NOT NULL	1 if TransH and McKiti were successfully joined using the agreed order key
exclude_reason	nvarchar(64)	NULL	Reason for exclusion, for example void or no_bump_time
Bumps with a duration of exactly 30 seconds must be included in the filtered results. Only valid Bumps shorter than 30 seconds should be removed from the filtered calculations.
3.5. Technical fields
Field	Data type	Required	Description
year	int	NOT NULL	Year from sale_date
month	int	NOT NULL	Month from sale_date
source_view_transh	nvarchar(128)	NOT NULL	Name of the TransH source view
source_view_mckiti	nvarchar(128)	NOT NULL	Actual name of the McKiti source view used
loaded_at	datetime2	NOT NULL	Date and time when the view was built or refreshed
4. Order view — dbo.V_TTS_Order
Priority: Recommended.
Data level: One row per order.
Field	Description
store_id	Store ID
sale_date	Business date of the order
order_id	Common order ID
order_key	Unique order key
year	Year of the order
month	Month of the order
order_tts_sec	Original order TTS in seconds
order_channel	Order channel
order_is_void	Void order flag
bump_count	Total number of Bumps
bump_count_valid	Number of valid Bumps
bump_count_ge30	Number of valid Bumps with a duration of at least 30 seconds
bump_count_lt30	Number of valid Bumps shorter than 30 seconds
bump_tts_sum_raw_sec	Total duration of all valid Bumps before filtering
bump_tts_sum_ge30_sec	Total duration of valid Bumps after filtering
bump_tts_avg_raw_sec	Average duration before filtering
bump_tts_avg_ge30_sec	Average duration after filtering
bump_tts_max_raw_sec	Maximum duration before filtering
bump_tts_max_ge30_sec	Maximum duration after filtering
pct_bumps_dropped	Share of valid Bumps removed by the filter: bump_count_lt30 / bump_count_valid
has_full_join	1 if the order has data from both TransH and McKiti
The original order TTS should be provided first. The formula for cleaned order TTS will be agreed separately as a product requirement.
5. Store and month view — dbo.V_TTS_StoreMonth
Priority: Recommended.
Data level: One row per store, year, and month.
Field	Description
store_id	Store ID
year	Year
month	Month
order_count	Number of orders in the panel
order_tts_mean_sec	Average order TTS in seconds
order_tts_median_sec	Median order TTS in seconds, if available
bump_volume	Number of valid Bumps
bump_volume_ge30	Number of valid Bumps with a duration of at least 30 seconds
bump_mean_ge30_sec	Average duration of Bumps after filtering
pct_orders_with_mckiti	Share of orders with data from McKiti
pct_bumps_dropped_lt30	Share of Bumps removed because their duration was shorter than 30 seconds
The field order_tts_mean_cleansed_sec can be added later, after the cleaned order TTS formula is agreed.
6. Data inclusion rules — Version 1
1.	Include only stores within the agreed store ID range or the agreed store list.
2.	Exclude void orders from the calculations (order_is_void = 0).
3.	For the first impact analysis, use only orders with join_match = 1.
4.	All output TTS values must be in seconds.
5.	If bump_datetime is NULL, the row may remain in the main view with bump_valid = 0, but it must not be included in Bump duration calculations.
6.	Invalid or missing timestamps must be handled using the agreed data quality rules.
7. Join requirements
The required relationship is:
TransH order → McKiti Bump events
The join must use the agreed combination of store_id, sale_date, and order_id, or another confirmed common order key.
The database owner must confirm:
•	Whether order_id is available in both sources.
•	Whether a mapping table is needed to match orders.
•	Whether StoreID in TransH matches StoreIndex in McKiti.
•	How order_key will be created and kept consistent.
Important: If there is no reliable way to identify the same order in both systems, this is a blocker for the first version. A mapping solution must be agreed before implementation.
8. Monitor source and historical data availability
The current monitor event source is the database view TargetsByMetrics_McKitiBump.
The implementation should use this view if it provides all required fields and enough historical data. Otherwise, an extended view or an alternative source with the same data structure and level of detail will be required.
The selected source must provide:
•	The timestamps when an item appears on and is removed from the monitor, or equivalent timestamps.
•	The related order ID.
•	The related store ID.
•	The information needed to determine the business date.
•	The fields required to calculate Bump duration and apply the 30-second filter.
The available historical period must support the Store × Month panel and Planner.
Minimum requirements:
•	At least two months of data for testing.
•	The target historical period must be agreed based on the availability of TransH data.
The field source_view_mckiti must contain the actual name of the view used in the implementation.
9. Performance requirements
The views should support efficient filtering by date range and store.
Recommended indexes, where supported by the database design:
•	(store_id, sale_date)
•	(store_id, year, month)
•	order_key
The application must be able to request data using a filter such as:
WHERE sale_date BETWEEN @from AND @to
An optional filter by store_id should also be supported.
Monthly partitioning or a table-valued function such as fn_TTS_OrderBump(@from, @to) may be considered if needed for performance.
10. Acceptance criteria
The views are ready for application development when the following checks are complete:
1.	A non-empty sample is available for at least one store and two months, with thousands of matched order_key values where possible.
2.	All Bump rows belonging to the same order_key have the same order_tts_sec.
3.	Calculated bump_tts_sec matches the source timestamps, with a maximum difference of one second.
4.	The percentage of successfully matched orders (join_match = 1) is calculated and documented.
5.	TTS units are correct. For example, if a typical order takes about four minutes, the value should be around 200–300 seconds, not 4.
6.	A short document is provided with the source names, join keys, filters, and void order rules.
7.	The available historical period is confirmed, including the test period of at least two months.
11. Expected result
The required deliverable is dbo.V_TTS_OrderBump, with one row per monitor Bump event and the related order TTS from TransH in seconds.
The additional views dbo.V_TTS_Order and dbo.V_TTS_StoreMonth are recommended to simplify analysis and improve performance.
The common order key, the correct join between TransH and McKiti, and sufficient historical data are critical requirements.
Without reliable order matching and enough historical data, the views cannot be accepted as ready for the required functionality.

