-- Fix function search path security issue
DROP TRIGGER IF EXISTS knowledge_article_version_trigger ON knowledge_articles;
DROP FUNCTION IF EXISTS increment_article_version();

CREATE OR REPLACE FUNCTION increment_article_version()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO knowledge_article_versions (
    tenant_id,
    article_id,
    version_number,
    title,
    content,
    change_summary,
    created_by
  )
  SELECT
    NEW.tenant_id,
    NEW.id,
    COALESCE((SELECT MAX(version_number) FROM knowledge_article_versions WHERE article_id = NEW.id), 0) + 1,
    NEW.title,
    NEW.content,
    'Article updated',
    NEW.last_edited_by;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER knowledge_article_version_trigger
  AFTER UPDATE ON knowledge_articles
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION increment_article_version();