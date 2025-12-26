# Database Schema (Minimum)

## Tables
### datasets
- id
- slug
- name
- default_sheet_name
- pk_fields_jsonb
- mapping_jsonb
- created_at
- updated_at

### import_runs
- id
- dataset_id
- file_name
- file_hash
- imported_at
- total_rows
- ok_rows
- error_rows
- notes

### raw_rows
- id
- dataset_id
- import_run_id
- row_number
- business_key
- row_jsonb
- row_hash
- parsed_ok
- parse_errors_jsonb
- created_at

### relationships
- id
- name
- left_dataset_id
- right_dataset_id
- join_mapping_jsonb
- created_at

## Curated storage
Either:
a) One generic curated_rows table (preferred for flexibility)
b) Per-dataset curated tables (more complex)

Preferred approach:
- curated_rows:
  - id
  - dataset_id
  - business_key
  - normalized_jsonb
  - typed_columns (common)
  - last_import_run_id
  - updated_at

Performance requirement:
- Ensure join keys exist in indexed columns OR generated stored columns for performance.

## Indexes (minimum expectations)
- curated_rows(dataset_id, business_key)
- raw_rows(dataset_id, business_key)
- join key indexes as needed for relationships/reports
