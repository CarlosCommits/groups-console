import type { ProgressEvent } from '@/shared/contracts/command';
import type {
  ReportMembershipMatrixData,
  ReportsGenerateMembershipMatrixPayload,
} from '@/shared/contracts/reports';

import { exchangeSessionManager } from './exchange-session-manager';

export async function exportReportData(
  payload: ReportsGenerateMembershipMatrixPayload,
  onProgress?: (event: ProgressEvent) => void,
): Promise<ReportMembershipMatrixData> {
  return await exchangeSessionManager.exportReportData(payload, onProgress);
}
