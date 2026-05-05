import { createServer } from "node:http";
import { JsonDatabase, createSeedData } from "../src/db/jsonDatabase.js";
import { createApp } from "../src/app.js";
import { SkuMappingRepository } from "../src/agents/sku-mapping/skuMappingRepository.js";
import { SkuMappingService } from "../src/agents/sku-mapping/skuMappingService.js";

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export async function runAllTests() {
  let passed = 0;
  for (const item of tests) {
    try {
      await item.fn();
      passed += 1;
      console.log(`ok - ${item.name}`);
    } catch (error) {
      console.error(`not ok - ${item.name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
  console.log(`${passed}/${tests.length} tests passed`);
  if (passed !== tests.length) process.exit(1);
}

export function createTestDb() {
  return new JsonDatabase(":memory:", createSeedData());
}

export function createMappingService(db = createTestDb()) {
  const repository = new SkuMappingRepository(db);
  return { db, repository, service: new SkuMappingService(repository, db) };
}

export async function createTestServer() {
  const db = createTestDb();
  const app = await createApp({ db });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    db,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}
