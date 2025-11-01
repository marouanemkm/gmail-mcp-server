export interface QueryArgs {
  query: string;
  params?: unknown[];
}

export interface GetTablesArgs {
  schema?: string;
}

export interface GetTableSchemaArgs {
  tableName: string;
  schema?: string;
}

export interface QueryResponse {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

export interface ExecuteResponse {
  success: boolean;
  rowCount: number | null;
  command: string;
}

