import type { RecipientsSearchPayload, RecipientsSearchResult } from '@/shared/contracts/recipients';

import { searchExchangeRecipients } from '@/main/exchange/search-recipients';

export interface RecipientDirectoryProvider {
  searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult>;
}

class AppRecipientDirectory implements RecipientDirectoryProvider {
  async searchRecipients(payload: RecipientsSearchPayload): Promise<RecipientsSearchResult> {
    return await searchExchangeRecipients(payload);
  }
}

export const recipientDirectory: RecipientDirectoryProvider = new AppRecipientDirectory();
