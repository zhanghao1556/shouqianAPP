import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAuditState, collectSourceDocuments } from "./audit-product-docs.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "product-doc-audit-"));
try {
  fs.writeFileSync(path.join(root, "a.docx"), "alpha");
  fs.writeFileSync(path.join(root, "b.pdf"), "beta");
  fs.writeFileSync(path.join(root, "~$locked.docx"), "ignored");

  const initial = collectSourceDocuments(root);
  assert.equal(initial.length, 2, "Word lock files must be ignored");
  const baseline = buildAuditState(initial, { documents: [] }, { baseline: true });
  assert.equal(baseline.pending.length, 0, "Baseline sources should be marked current");

  const unchanged = buildAuditState(collectSourceDocuments(root), { documents: baseline.documents });
  assert.equal(unchanged.pending.length, 0, "Unchanged sources must not be queued again");

  fs.writeFileSync(path.join(root, "b.pdf"), "beta changed");
  const oneChanged = buildAuditState(collectSourceDocuments(root), { documents: baseline.documents });
  assert.deepEqual(oneChanged.pending.map((item) => item.path), ["b.pdf"], "Only the changed source should be queued");

  const marked = buildAuditState(oneChanged.documents, { documents: oneChanged.documents }, { markExtracted: ["b.pdf"] });
  assert.equal(marked.pending.length, 0, "A processed source should leave the queue after its hash is marked extracted");
  console.log("PASS product document incremental hash audit");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
