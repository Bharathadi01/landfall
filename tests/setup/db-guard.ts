/**
 * Test database guard.
 *
 * Several suites delete and insert rows. They must never run against the
 * developer's configured database (which may be a tunnel to shared data).
 *
 * - With TEST_DATABASE_URL set: DB suites run against that database only.
 * - Without it: DATABASE_URL is pointed at an unreachable address so any
 *   accidental DB access fails fast, and DB suites are skipped.
 */
const testUrl = process.env.TEST_DATABASE_URL;

if (testUrl) {
  process.env.DATABASE_URL = testUrl;
  process.env.LANDFALL_DB_TESTS = "1";
} else {
  process.env.DATABASE_URL = "postgres://db-tests-disabled@127.0.0.1:1/set_TEST_DATABASE_URL";
  delete process.env.LANDFALL_DB_TESTS;
}

export {};
