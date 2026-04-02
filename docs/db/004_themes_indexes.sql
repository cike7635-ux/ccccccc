-- 为 themes 表添加索引，提高查询性能

-- 为 creator_id 添加索引，加速用户主题查询
CREATE INDEX IF NOT EXISTS idx_themes_creator_id ON public.themes USING btree (creator_id) TABLESPACE pg_default;

-- 为 is_official 添加索引，加速官方主题查询
CREATE INDEX IF NOT EXISTS idx_themes_is_official ON public.themes USING btree (is_official) TABLESPACE pg_default;

-- 为 created_at 添加索引，加速按创建时间排序
CREATE INDEX IF NOT EXISTS idx_themes_created_at ON public.themes USING btree (created_at) TABLESPACE pg_default;

-- 为 priority 添加索引，加速官方主题按优先级排序
CREATE INDEX IF NOT EXISTS idx_themes_priority ON public.themes USING btree (priority) TABLESPACE pg_default;

-- 为 task_count 添加索引，加速按任务数量排序
CREATE INDEX IF NOT EXISTS idx_themes_task_count ON public.themes USING btree (task_count) TABLESPACE pg_default;

-- 复合索引：creator_id + created_at，加速用户主题按创建时间排序查询
CREATE INDEX IF NOT EXISTS idx_themes_creator_created ON public.themes USING btree (creator_id, created_at) TABLESPACE pg_default;

-- 复合索引：is_official + priority + created_at，加速官方主题查询和排序
CREATE INDEX IF NOT EXISTS idx_themes_official_priority ON public.themes USING btree (is_official, priority, created_at) TABLESPACE pg_default;