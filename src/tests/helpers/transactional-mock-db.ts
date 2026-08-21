export interface TransactionalMockState {
  components: any[];
  auditLogs: any[];
  [key: string]: any[];
}

export class TransactionalMockDatabase {
  private state: TransactionalMockState;

  constructor(initialState: Partial<TransactionalMockState> = {}) {
    this.state = {
      components: [...(initialState.components || [])],
      auditLogs: [...(initialState.auditLogs || [])],
      ...initialState,
    };
  }

  public getState(): TransactionalMockState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public async $transaction<T>(
    callback: (tx: TransactionalMockDatabase) => Promise<T>
  ): Promise<T> {
    const snapshot = JSON.stringify(this.state);
    try {
      const result = await callback(this);
      return result;
    } catch (error) {
      // Rollback to snapshot on error
      this.state = JSON.parse(snapshot);
      throw error;
    }
  }

  public async addComponent(comp: any): Promise<any> {
    const created = { id: `comp_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...comp };
    this.state.components.push(created);
    return created;
  }

  public async addAuditLog(log: any): Promise<any> {
    const created = { id: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...log };
    this.state.auditLogs.push(created);
    return created;
  }
}
