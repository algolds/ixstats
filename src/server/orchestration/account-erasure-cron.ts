import { db } from "~/server/db";
import { eraseDueAccounts } from "./account-erasure";

/** The account-erasure cron job: erases every account whose deletion request is past its 14-day grace. */
export async function runAccountErasure(): Promise<{
  due: number;
  erased: number;
  failed: string[];
}> {
  return eraseDueAccounts(db, new Date());
}
