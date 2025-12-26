# Reporting SQL Requirements (Must implement)

## Missing related (anti-join)
Example pattern:
SELECT l.*
FROM curated_rows l
LEFT JOIN curated_rows r
  ON l.dataset_id = :left AND r.dataset_id = :right
 AND l.join_key = r.join_key
WHERE l.dataset_id = :left
  AND r.id IS NULL;

## Duplicate keys
SELECT business_key, COUNT(*)
FROM curated_rows
WHERE dataset_id = :dataset
GROUP BY business_key
HAVING COUNT(*) > 1;
