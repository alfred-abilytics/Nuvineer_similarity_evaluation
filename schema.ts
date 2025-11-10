import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  uuid,
  jsonb,
  unique,
  index,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Repository PR Analysis Status Table
export const repositoryPrAnalysisStatus = pgTable(
  'repository_pr_analysis_status',
  {
    repositorySlug: varchar('repository_slug', { length: 255 }).notNull(),
    installationId: integer('installation_id').notNull().default(0),
    prNumber: varchar('pr_number', { length: 255 }).notNull(),
    prTitle: varchar('pr_title', { length: 255 }),
    prUrl: varchar('pr_url', { length: 500 }),
    prCreatedAt: timestamp('pr_created_at', { withTimezone: true }),
    prMergedAt: timestamp('pr_merged_at', { withTimezone: true }),
    commitSha: varchar('commit_sha', { length: 255 }),
    isPseudoPr: boolean('is_pseudo_pr').notNull().default(false),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    lastAnalyzedAt: timestamp('last_analyzed_at', { withTimezone: true }),
    analysisError: text('analysis_error'),
    extractedDecisionCount: integer('extracted_decision_count'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => ({
    pk: unique().on(
      table.repositorySlug,
      table.prNumber,
      table.installationId
    ),
    repoIdx: index('idx_repository_pr_analysis_status_repo').on(
      table.repositorySlug,
      table.installationId
    ),
  })
);

// Repository Loading Jobs Table
export const repositoryLoadingJobs = pgTable(
  'repository_loading_jobs',
  {
    id: serial('id').primaryKey(),
    repositorySlug: varchar('repository_slug', { length: 255 }).notNull(),
    installationId: integer('installation_id').notNull(),
    currentPhase: varchar('current_phase', { length: 50 })
      .notNull()
      .default('prs'),
    nextPageToProcess: integer('next_page_to_process').notNull().default(1),
    isCompleted: boolean('is_completed').notNull().default(false),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastProcessedAt: timestamp('last_processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  table => ({
    uniqueRepo: unique().on(table.repositorySlug, table.installationId),
    pendingIdx: index('idx_pending_repository_loading_jobs').on(
      table.isCompleted,
      table.status
    ),
  })
);

// Repository PR Commit SHAs Table
export const repositoryPrCommitShas = pgTable(
  'repository_pr_commit_shas',
  {
    id: serial('id').primaryKey(),
    repositorySlug: varchar('repository_slug', { length: 255 }).notNull(),
    installationId: integer('installation_id').notNull(),
    commitSha: varchar('commit_sha', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  table => ({
    uniqueSha: unique().on(
      table.repositorySlug,
      table.installationId,
      table.commitSha
    ),
    lookupIdx: index('idx_repository_pr_commit_shas_lookup').on(
      table.repositorySlug,
      table.installationId
    ),
    shaIdx: index('idx_repository_pr_commit_shas_commit_sha').on(
      table.commitSha
    ),
  })
);

// Repository Settings Table
export const repositorySettings = pgTable(
  'repository_settings',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    repositorySlug: text('repository_slug').notNull().unique(),
    maxCommitsDeepAnalysis: integer('max_commits_deep_analysis')
      .notNull()
      .default(500),
    techDebtAnalysisEnabled: boolean('tech_debt_analysis_enabled')
      .notNull()
      .default(false),
    vectorDb: varchar('vector_db', { length: 50 }).default('pgvector').notNull().$type<('pinecone' | 'pgvector')>(),
    jiraProjectKey: text('jira_project_key'),
    jiraApiToken: text('jira_api_token'),
    jiraEmail: text('jira_email'),
    jiraUrl: text('jira_url'),
    linearApiKey: text('linear_api_key'),
    linearTeamId: text('linear_team_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    slugIdx: index('idx_repository_settings_repository_slug').on(
      table.repositorySlug
    ),
  })
);

// Deployment Constitutions Table
export const deploymentConstitutions = pgTable(
  'deployment_constitutions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    repositorySlug: varchar('repository_slug', { length: 255 }).notNull(),
    installationId: integer('installation_id').notNull(),
    userId: uuid('user_id'),
    constitutionData: jsonb('constitution_data').notNull(),
    sourceRepoUrl: text('source_repo_url'),
    sourceCommitHash: varchar('source_commit_hash', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    uniqueRepo: unique().on(table.repositorySlug, table.installationId),
    repoIdx: index('idx_deployment_constitutions_repository').on(
      table.repositorySlug,
      table.installationId
    ),
    userIdx: index('idx_deployment_constitutions_user').on(table.userId),
  })
);

// Decision Vectors Table (pgvector)
export const decisionVectors = pgTable(
  'decision_vectors',
  {
    id: text('id').notNull(),
    namespace: text('namespace').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  table => ({
    pk: unique().on(table.id, table.namespace),
    namespaceIdx: index('idx_decision_vectors_namespace').on(table.namespace),
    createdIdx: index('idx_decision_vectors_created_at').on(table.createdAt),
    updatedIdx: index('idx_decision_vectors_updated_at').on(table.updatedAt),
  })
);

// Type exports for use in application code
export type RepositoryPrAnalysisStatus =
  typeof repositoryPrAnalysisStatus.$inferSelect;
export type NewRepositoryPrAnalysisStatus =
  typeof repositoryPrAnalysisStatus.$inferInsert;

export type RepositoryLoadingJob = typeof repositoryLoadingJobs.$inferSelect;
export type NewRepositoryLoadingJob = typeof repositoryLoadingJobs.$inferInsert;

export type RepositoryPrCommitSha = typeof repositoryPrCommitShas.$inferSelect;
export type NewRepositoryPrCommitSha =
  typeof repositoryPrCommitShas.$inferInsert;

export type RepositorySetting = typeof repositorySettings.$inferSelect;
export type NewRepositorySetting = typeof repositorySettings.$inferInsert;

export type DeploymentConstitution =
  typeof deploymentConstitutions.$inferSelect;
export type NewDeploymentConstitution =
  typeof deploymentConstitutions.$inferInsert;

export type DecisionVector = typeof decisionVectors.$inferSelect;
export type NewDecisionVector = typeof decisionVectors.$inferInsert;
