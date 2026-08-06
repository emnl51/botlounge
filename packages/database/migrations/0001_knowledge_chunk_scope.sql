DROP INDEX IF EXISTS "knowledge_content_hash_uq";
CREATE UNIQUE INDEX "knowledge_thread_content_hash_uq"
  ON "knowledge_chunks" ("thread_id", "content_hash");
