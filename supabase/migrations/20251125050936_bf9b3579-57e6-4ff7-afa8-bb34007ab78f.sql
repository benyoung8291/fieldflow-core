-- Update RLS policies for knowledge_articles to allow supervisors and above to create/edit

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create articles in their tenant" ON knowledge_articles;
DROP POLICY IF EXISTS "Users can update their own articles" ON knowledge_articles;
DROP POLICY IF EXISTS "Users can delete their own articles" ON knowledge_articles;

-- Create new policy for creating articles (supervisors and above)
CREATE POLICY "Supervisors and above can create articles"
ON knowledge_articles
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    user_has_any_role_safe(ARRAY['supervisor', 'management', 'tenant_admin', 'super_admin']::user_role[])
  )
);

-- Create new policy for updating articles (supervisors and above)
CREATE POLICY "Supervisors and above can update articles"
ON knowledge_articles
FOR UPDATE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND (
    user_has_any_role_safe(ARRAY['supervisor', 'management', 'tenant_admin', 'super_admin']::user_role[])
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND (
    user_has_any_role_safe(ARRAY['supervisor', 'management', 'tenant_admin', 'super_admin']::user_role[])
  )
);

-- Create new policy for deleting articles (supervisors and above)
CREATE POLICY "Supervisors and above can delete articles"
ON knowledge_articles
FOR DELETE
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND (
    user_has_any_role_safe(ARRAY['supervisor', 'management', 'tenant_admin', 'super_admin']::user_role[])
  )
);

-- Ensure the version tracking trigger is active
DROP TRIGGER IF EXISTS knowledge_article_version_trigger ON knowledge_articles;

CREATE TRIGGER knowledge_article_version_trigger
AFTER UPDATE OF title, content, summary ON knowledge_articles
FOR EACH ROW
WHEN (
  OLD.title IS DISTINCT FROM NEW.title OR
  OLD.content IS DISTINCT FROM NEW.content OR
  OLD.summary IS DISTINCT FROM NEW.summary
)
EXECUTE FUNCTION increment_article_version();