# Schema: SummerCampain.dbo.TargetsByMetrics_RateGetAnswers

Verified against `INFORMATION_SCHEMA.COLUMNS` and DB-team glossary (2026-08-26).
Column names, count (35), and ordinal order match 1:1.

| Field | Value |
|---|---|
| Database | `SummerCampain` |
| Object | `dbo.TargetsByMetrics_RateGetAnswers` |
| Object type | VIEW |
| Access | read-only `SELECT` (Trusted Connection / same ERP server baseline) |
| Dev twin | `SummerCampain_dev` does **not** contain this VIEW |

## Columns

| # | Column | SQL type | Nullable | Description (DB team) |
|---|--------|----------|----------|------------------------|
| 1 | ParticipateNumber | nvarchar(50) | NO | Participation identifier |
| 2 | AnswerDate | datetime | YES | Response date |
| 3 | AnswerTime | datetime | YES | Response time |
| 4 | DiscountTypeDesc | nvarchar(50) | YES | Benefit type granted for response |
| 5 | BlackList | nvarchar(50) | YES | Customer blacklist indicator |
| 6 | PrintStore | int | YES | Transaction store |
| 7 | PrintDate | datetime | YES | Business date |
| 8 | PrintPos | int | YES | POS/cash register number |
| 9 | PrintOrder | int | YES | Order number |
| 10 | PrintDateTime | datetime | YES | Order date and time |
| 11 | EmpIdNumber | int | YES | Employee identifier |
| 12 | EmpStore | int | YES | Employee store |
| 13 | EmpName | nvarchar(100) | YES | Employee first name |
| 14 | EmpLastName | nvarchar(100) | YES | Employee last name |
| 15 | EmpStartDate | nvarchar(50) | YES | Employee start date |
| 16 | EmpEndDate | nvarchar(50) | YES | Employee end date |
| 17 | EmpRole | nvarchar(50) | YES | Employee role |
| 18 | Year | int | YES | Calendar year |
| 19 | Month | int | YES | Calendar month |
| 20 | PhoneFromLog | nvarchar(50) | YES | Phone number from response log |
| 21 | ContactType | nvarchar(50) | YES | Customer contact type |
| 22 | UserName | nvarchar(255) | YES | Customer name |
| 23 | UserContact | nvarchar(255) | YES | Customer contact information |
| 24 | ext_user_id | int | YES | External application user identifier |
| 25 | OveringDone | nvarchar(50) | YES | Transaction void/cancellation indicator |
| 26 | Reprinted | nvarchar(50) | YES | Receipt reprint indicator |
| 27 | PrintSource | nvarchar(50) | YES | Purchase and pickup channel |
| 28 | TakeChanel | int | YES | Transaction pickup channel |
| 29 | PayChanel | int | YES | Transaction payment channel |
| 30 | OrderChanel | nchar(10) | YES | Order placement channel |
| 31 | GreenReceipt | int | YES | Green receipt indicator |
| 32 | IdentifiedCustomer | int | YES | Customer identification indicator |
| 33 | Question_ID | int | YES | Survey question identifier |
| 34 | Title | nvarchar(50) | YES | Survey question description |
| 35 | Answer_Value | int | YES | Customer answer value |

## Fraud-feature mapping (draft)

| Logical need | Candidate columns |
|---|---|
| Entity key | `UserContact`, `PhoneFromLog`, `ext_user_id`, `ParticipateNumber` |
| Store / POS | `PrintStore`, `PrintPos`, `PrintOrder` |
| Survey latency | `PrintDateTime` → `AnswerTime` |
| Scores | `Question_ID`, `Answer_Value`, `Title` |
| Channel | `ContactType`, `PrintSource`, `TakeChanel`, `PayChanel`, `OrderChanel` |
| Existing signal | `BlackList` |
| Staff context | `EmpIdNumber`, `EmpStore`, `EmpName`, `EmpLastName`, `EmpRole`, … |

## Notes

- No free-text customer comment column observed; `Title` is the **question** description.
- Flag-like fields (`BlackList`, `OveringDone`, `Reprinted`) are `nvarchar`, not `bit` — decode actual values before filtering.
- `EmpStartDate` / `EmpEndDate` are `nvarchar(50)`, not `datetime`.
- PII columns (`PhoneFromLog`, `UserContact`, `UserName`, employee names): do not log, commit samples, or expose in API responses without redaction.
