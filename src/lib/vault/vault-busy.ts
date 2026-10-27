/**
 * What a credit transaction that lost a deadlock or a write conflict answers (a CONFLICT). Nothing moved, so the player
 * tries again. Client-safe, so a screen can tell this CONFLICT from a listing that has gone.
 */
export const VAULTS_BUSY_MESSAGE = "Someone else was buying at the same moment. Try again.";
