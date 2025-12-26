import { Prisma } from "@prisma/client";

export const buildMissingRelatedQuery = (relationship, limit = 200) => {
  const joinMapping = relationship.joinMapping ?? {};
  const joinEntries = Object.entries(joinMapping);
  if (!joinEntries.length) {
    return { error: "Relationship join mapping is empty." };
  }

  const conditions = joinEntries.map(([leftField, rightField]) =>
    Prisma.sql`(l.normalized ->> ${leftField}) = (r.normalized ->> ${rightField})`
  );

  const query = Prisma.sql`
    SELECT
      l.id,
      l.business_key AS "businessKey",
      l.normalized AS "normalized"
    FROM curated_rows l
    WHERE l.dataset_id = ${relationship.leftDatasetId}
      AND NOT EXISTS (
        SELECT 1
        FROM curated_rows r
        WHERE r.dataset_id = ${relationship.rightDatasetId}
          AND ${Prisma.join(conditions, " AND ")}
      )
    LIMIT ${limit};
  `;

  return { query };
};
