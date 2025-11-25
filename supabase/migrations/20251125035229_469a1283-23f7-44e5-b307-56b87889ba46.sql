-- Knowledge Base Categories
CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#0891B2',
  parent_category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Knowledge Base Articles
CREATE TABLE knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  last_edited_by UUID REFERENCES auth.users(id)
);

-- Knowledge Article Tags
CREATE TABLE knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Article Tag Relationships
CREATE TABLE knowledge_article_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, tag_id)
);

-- Knowledge Article Attachments
CREATE TABLE knowledge_article_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id)
);

-- Knowledge Article Suggestions
CREATE TABLE knowledge_article_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('edit', 'new_article', 'improvement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_content TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT
);

-- Knowledge Article Versions (for tracking edits)
CREATE TABLE knowledge_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Knowledge Article Feedback
CREATE TABLE knowledge_article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_knowledge_articles_category ON knowledge_articles(category_id);
CREATE INDEX idx_knowledge_articles_status ON knowledge_articles(status);
CREATE INDEX idx_knowledge_articles_tenant ON knowledge_articles(tenant_id);
CREATE INDEX idx_knowledge_categories_parent ON knowledge_categories(parent_category_id);
CREATE INDEX idx_knowledge_article_tags_article ON knowledge_article_tags(article_id);
CREATE INDEX idx_knowledge_article_tags_tag ON knowledge_article_tags(tag_id);

-- RLS Policies
ALTER TABLE knowledge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_article_feedback ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Users can view categories in their tenant"
  ON knowledge_categories FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create categories in their tenant"
  ON knowledge_categories FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update categories in their tenant"
  ON knowledge_categories FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete categories in their tenant"
  ON knowledge_categories FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Articles policies
CREATE POLICY "Users can view published articles in their tenant"
  ON knowledge_articles FOR SELECT
  USING (tenant_id = get_user_tenant_id() AND (status = 'published' OR created_by = auth.uid()));

CREATE POLICY "Users can create articles in their tenant"
  ON knowledge_articles FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own articles"
  ON knowledge_articles FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND (created_by = auth.uid() OR has_role(auth.uid(), 'tenant_admin'::user_role)));

CREATE POLICY "Users can delete their own articles"
  ON knowledge_articles FOR DELETE
  USING (tenant_id = get_user_tenant_id() AND (created_by = auth.uid() OR has_role(auth.uid(), 'tenant_admin'::user_role)));

-- Tags policies
CREATE POLICY "Users can view tags in their tenant"
  ON knowledge_tags FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create tags in their tenant"
  ON knowledge_tags FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Article tags policies
CREATE POLICY "Users can view article tags in their tenant"
  ON knowledge_article_tags FOR SELECT
  USING (article_id IN (SELECT id FROM knowledge_articles WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can create article tags"
  ON knowledge_article_tags FOR INSERT
  WITH CHECK (article_id IN (SELECT id FROM knowledge_articles WHERE tenant_id = get_user_tenant_id()));

CREATE POLICY "Users can delete article tags"
  ON knowledge_article_tags FOR DELETE
  USING (article_id IN (SELECT id FROM knowledge_articles WHERE tenant_id = get_user_tenant_id()));

-- Attachments policies
CREATE POLICY "Users can view attachments in their tenant"
  ON knowledge_article_attachments FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create attachments in their tenant"
  ON knowledge_article_attachments FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete attachments in their tenant"
  ON knowledge_article_attachments FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Suggestions policies
CREATE POLICY "Users can view suggestions in their tenant"
  ON knowledge_article_suggestions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create suggestions in their tenant"
  ON knowledge_article_suggestions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own suggestions"
  ON knowledge_article_suggestions FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND (created_by = auth.uid() OR has_role(auth.uid(), 'tenant_admin'::user_role)));

-- Versions policies
CREATE POLICY "Users can view article versions in their tenant"
  ON knowledge_article_versions FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create article versions"
  ON knowledge_article_versions FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Feedback policies
CREATE POLICY "Users can view feedback in their tenant"
  ON knowledge_article_feedback FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can create feedback in their tenant"
  ON knowledge_article_feedback FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own feedback"
  ON knowledge_article_feedback FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND user_id = auth.uid());

-- Trigger to increment version number
CREATE OR REPLACE FUNCTION increment_article_version()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_article_version_trigger
  AFTER UPDATE ON knowledge_articles
  FOR EACH ROW
  WHEN (OLD.content IS DISTINCT FROM NEW.content)
  EXECUTE FUNCTION increment_article_version();