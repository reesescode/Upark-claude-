// These FGCU lots have no trusted live space-count feed. Keep their persisted
// records and navigation coordinates intact; only change availability output.
export function isReportOnlyLot(record: { id: string; name: string; shortName: string }) {
  return ["stadium-lot", "east-lot", "fgcu-lot-8"].includes(record.id)
    || /\bP[678]\b/i.test(`${record.name} ${record.shortName}`);
}
