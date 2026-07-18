import { ScanResults } from "@/components/scans/scan-results";

export default async function ScanPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  return <ScanResults scanId={scanId} />;
}
