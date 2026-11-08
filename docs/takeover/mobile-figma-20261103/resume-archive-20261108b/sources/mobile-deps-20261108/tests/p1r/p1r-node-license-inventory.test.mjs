// `pnpm test:p1r` only discovers tests/p1r. Importing registers the helper cases
// with this file's node:test run; the assertions stay in the audit module.
import '../../scripts/audit/p1r-node-license-inventory.test.mjs';
