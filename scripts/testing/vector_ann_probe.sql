\set ON_ERROR_STOP on
\timing on

-- All objects are temporary and disappear when psql disconnects.
CREATE TEMP TABLE bench_queries AS
SELECT owner_id,
       ARRAY_AGG((sin(owner_id * 0.13 * d) + cos(owner_id * 0.07 * d))::real ORDER BY d)
           ::extensions.vector(2048) AS embedding
FROM generate_series(1, 100) owner_id CROSS JOIN generate_series(1, 2048) d
GROUP BY owner_id;

CREATE TEMP TABLE bench_vectors (
    id bigint PRIMARY KEY,
    owner_id integer NOT NULL,
    embedding extensions.vector(2048) NOT NULL
);

WITH owner_centers AS (
    SELECT owner_id,
           ARRAY_AGG((sin(owner_id * 0.13 * d) + cos(owner_id * 0.07 * d))::real ORDER BY d) AS center
    FROM generate_series(1, 100) owner_id CROSS JOIN generate_series(1, 2048) d
    GROUP BY owner_id
), row_inputs AS (
    SELECT id, ((id - 1) / 200 + 1)::integer AS owner_id
    FROM generate_series(1, 20000) id
)
INSERT INTO bench_vectors
SELECT r.id, r.owner_id,
       ARRAY(
           SELECT (c.center[d] + 0.15 * sin(r.id * 0.0017 + d * 0.013))::real
           FROM generate_series(1, 2048) d ORDER BY d
       )::extensions.vector(2048)
FROM row_inputs r JOIN owner_centers c USING (owner_id);

ANALYZE bench_vectors;
CREATE INDEX bench_vectors_owner_id ON bench_vectors(owner_id, id);
CREATE INDEX bench_vectors_half_hnsw ON bench_vectors USING hnsw
    ((embedding::extensions.halfvec(2048)) extensions.halfvec_cosine_ops)
    WITH (m=16, ef_construction=64);

-- Exact tenant-filtered baseline; this mirrors the app's existing owner B-tree path.
EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT v.id
FROM bench_vectors v
WHERE v.owner_id=7
ORDER BY v.embedding OPERATOR(extensions.<=>)
    (SELECT q.embedding FROM bench_queries q WHERE q.owner_id=7)
LIMIT 10;

CREATE TEMP TABLE exact_top AS
SELECT v.id
FROM bench_vectors v
WHERE v.owner_id=7
ORDER BY v.embedding OPERATOR(extensions.<=>)
    (SELECT q.embedding FROM bench_queries q WHERE q.owner_id=7)
LIMIT 10;

-- Remove the competing owner index only from this temporary benchmark table so
-- the candidate query demonstrates the global HNSW path rather than exact sort.
DROP INDEX bench_vectors_owner_id;
SET enable_seqscan=off;
SET hnsw.ef_search=40;
SET hnsw.iterative_scan=relaxed_order;

EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, SUMMARY ON)
SELECT v.id
FROM bench_vectors v
WHERE v.owner_id=7
ORDER BY v.embedding::extensions.halfvec(2048) OPERATOR(extensions.<=>)
    ((SELECT q.embedding FROM bench_queries q WHERE q.owner_id=7)::extensions.halfvec(2048))
LIMIT 10;

CREATE TEMP TABLE ann_top_40 AS
SELECT v.id
FROM bench_vectors v
WHERE v.owner_id=7
ORDER BY v.embedding::extensions.halfvec(2048) OPERATOR(extensions.<=>)
    ((SELECT q.embedding FROM bench_queries q WHERE q.owner_id=7)::extensions.halfvec(2048))
LIMIT 10;

SET hnsw.ef_search=200;
CREATE TEMP TABLE ann_top_200 AS
SELECT v.id
FROM bench_vectors v
WHERE v.owner_id=7
ORDER BY v.embedding::extensions.halfvec(2048) OPERATOR(extensions.<=>)
    ((SELECT q.embedding FROM bench_queries q WHERE q.owner_id=7)::extensions.halfvec(2048))
LIMIT 10;

SELECT 'ef_search=40' AS candidate,
       (SELECT count(*) FROM exact_top e JOIN ann_top_40 a USING (id)) AS overlap,
       10 AS k,
       round((SELECT count(*)::numeric FROM exact_top e JOIN ann_top_40 a USING (id)) / 10, 3) AS recall_at_10
UNION ALL
SELECT 'ef_search=200',
       (SELECT count(*) FROM exact_top e JOIN ann_top_200 a USING (id)),
       10,
       round((SELECT count(*)::numeric FROM exact_top e JOIN ann_top_200 a USING (id)) / 10, 3);
