import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { decisionVectors } from './schema.ts';
import { sql, and, eq } from 'drizzle-orm';
import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'node:fs/promises';

function connectToProdDatabase(connectionString: string) {
    console.log(connectionString);
    const queryClient = postgres(connectionString, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: 60 * 30,
        prepare: false,
    });

    const db = drizzle(queryClient);
    const closeConnection = async () => {
        await queryClient.end();
    };
    return { db, closeConnection };
}


function connectToDevDatabase(connectionString: string) {
    console.log(connectionString);
    const queryClient = postgres(connectionString, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: 60 * 30,
        prepare: false,
    });
    const db = drizzle(queryClient);
    const closeConnection = async () => {
        await queryClient.end();
    };
    return { db, closeConnection };
}


function cosineSimilarity(a, b) {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
}

function compareVectors(vector1: number[], vector2: number[]) {
    const similarity = cosineSimilarity(vector1, vector2);
    return similarity;
}


async function getDescription(metadata1: any, metadata2: any) {
    const anthropic = new Anthropic({
        apiKey: '',
    });
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            temperature: 0.3,
            messages: [{ role: 'user', content: `Compare the following two descriptions and provide a summary of the differences: ${JSON.stringify(metadata1, null, 2)} vs ${JSON.stringify(metadata2, null, 2)}` }],
        });

        if (response.content[0].type !== 'text') {
            throw new Error('Expected text response from Anthropic API');
        }

        return response.content[0].text;
    } catch (error) {
        console.error('Error generating analysis:', error);
        return `Analysis generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function main() {

    const dbConfigs = {
        prod: '',
        dev: '',
    }
    const { db: prodDb, closeConnection: closeProdConnection } = await connectToProdDatabase(dbConfigs.prod);
    const { db: devDb, closeConnection: closeDevConnection } = await connectToDevDatabase(dbConfigs.dev);


    const namespace = await prompt("Enter the namespace: ");
    const prNumber = await prompt("Enter the pr_number: ");

    console.log("\n=== Prod database query ===");
    const rows = await prodDb
        .select()
        .from(decisionVectors)
        .where(
            and(
                eq(decisionVectors.namespace, namespace ?? ''),
                sql`metadata->>'pr_number' = ${prNumber}`
            )
        );
    console.log(`Found ${rows.length} rows for namespace "${namespace}" and pr_number "${prNumber}":`);

    console.log("\n=== Dev database query ===");
    const rows2 = await devDb
        .select()
        .from(decisionVectors)
        .where(
            and(
                eq(decisionVectors.namespace, namespace ?? ''),
                sql`metadata->>'pr_number' = ${prNumber}`
            )
        );
    console.log(`Found ${rows2.length} rows for namespace "${namespace}" and pr_number "${prNumber}":`);


    console.log("\n=== Vector Similarity comparison ===");
    const similarity = await compareVectors(rows[0].embedding as number[], rows2[0].embedding as number[]);
    console.log(`Similarity: ${(similarity * 100).toFixed(2)}%`);

    console.log("\n=== Similarity comparison ===");
    const description = await getDescription(rows[0].metadata, rows2[0].metadata);

    const markdownContent = `# Comparison Description\n\n${description}\n`;
    await fs.writeFile('comparison.md', markdownContent, 'utf-8');
    console.log("Description saved to comparison.md");

    await closeProdConnection();
    await closeDevConnection();
}

main();