import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContributionDashboard, SessionDetail } from "../dashboard/src/App.js";
import { SummarySchema, aggregateMetadata } from "../src/http/metadata.js";
import { randomUUID } from "node:crypto";
it("renders accessible status controls and escapes untrusted issue titles", () => {
  const s = SummarySchema.parse({
    id: randomUUID(),
    state: "BLOCKED",
    source: "synced",
    updatedAt: new Date().toISOString(),
    repository: {
      name: "owner/repo",
      url: "https://github.com/owner/repo",
      forge: "github",
    },
    issue: {
      number: 1,
      title: '<script>alert("issue")</script>',
      url: "https://github.com/owner/repo/issues/1",
      eligibility: "UNKNOWN",
      confidence: "low",
      checkedAt: new Date().toISOString(),
    },
    policy: "UNKNOWN",
    checks: [{ name: "pytest", status: "UNAVAILABLE", verified: true }],
    blockers: ["Compiler unavailable"],
    milestones: {},
    relaxations: ["comments"],
  });
  const html = renderToStaticMarkup(
    createElement(ContributionDashboard, {
      sessions: [s],
      metrics: aggregateMetadata([s]),
      onSelect: () => {},
    }),
  );
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Search contributions");
  expect(html).toContain("Device-reported metadata");
  expect(html).toContain("0/1 recorded passes");
  const detail = renderToStaticMarkup(
    createElement(SessionDetail, { session: s, onClose: () => {} }),
  );
  expect(detail).toContain("Unknown");
  expect(detail).toContain("Authorized exceptions");
  expect(detail).toContain("UNAVAILABLE");
  expect(detail).not.toContain("None recorded");
});
