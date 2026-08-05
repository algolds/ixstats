/**
 * LEVEL 4: Objects, State & Methods ('this')
 * 
 * Objective: Export an object named 'NationTreasuryVault' with reserves: number,
 * a method allocateBudget(amount: number) updating this.reserves, and a method getVaultStatus().
 */

export const NationTreasuryVault = {
  nationName: "Faneria",
  reserves: 1000,

  allocateBudget(amount: number) {
    // TODO: Deduct amount from this.reserves using 'this.reserves -= amount'
  },

  getVaultStatus(): string {
    // TODO: Return `${this.nationName} Vault Reserves: $${this.reserves}M`
    return "";
  }
};
