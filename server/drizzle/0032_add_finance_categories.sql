CREATE TABLE IF NOT EXISTS "finance_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" varchar(20) NOT NULL,
  "name" text NOT NULL,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_finance_categories_kind" ON "finance_categories" ("kind");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_finance_categories_kind_name_lower" ON "finance_categories" ("kind", lower("name"));

INSERT INTO "finance_categories" ("kind", "name")
SELECT 'income', x.name
FROM (VALUES
  ('Client Payment'),
  ('Consulting'),
  ('Service Fee'),
  ('Other Income')
) AS x(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "finance_categories" fc
  WHERE fc."kind" = 'income'
    AND lower(fc."name") = lower(x.name)
);

INSERT INTO "finance_categories" ("kind", "name")
SELECT 'expense', x.name
FROM (VALUES
  ('Software'),
  ('Operations'),
  ('Marketing'),
  ('Office'),
  ('Tax'),
  ('Other Cost')
) AS x(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "finance_categories" fc
  WHERE fc."kind" = 'expense'
    AND lower(fc."name") = lower(x.name)
);
