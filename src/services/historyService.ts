import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import type { RawRow, DeliveryGroup, CheckState } from '../types';

function countCheckedOrders(checkStateData: unknown): number {
  if (!checkStateData || typeof checkStateData !== 'object') return 0;
  const checked = (checkStateData as CheckState).checked;
  if (!checked || typeof checked !== 'object') return 0;
  return Object.values(checked).filter(Boolean).length;
}

export type ImportType = 'flex' | 'frota';

export interface HistoryEntry {
  id: string;
  user_id: string;
  date: string;
  importTime: string;
  exportTime: string | null;
  totalOrders: number;
  totalGroups: number;
  checkedGroups: number;
  checkedOrders: number;
  fileName: string;
  importType: ImportType;
  rows: RawRow[];
  groups: DeliveryGroup[];
  headers: string[];
  checkState: CheckState;
}

function todayBR(): string {
  return new Date().toLocaleDateString('pt-BR');
}

function nowTime(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((item) => ({
    id: item.id,
    user_id: item.user_id,
    date: new Date(item.import_time).toLocaleDateString('pt-BR'),
    importTime: new Date(item.import_time).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    exportTime: item.export_time
      ? new Date(item.export_time).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    totalOrders: item.total_orders,
    totalGroups: item.total_groups,
    checkedGroups: item.checked_groups,
    checkedOrders: countCheckedOrders(item.check_state_data),
    fileName: item.file_name,
    importType: (item.import_type as ImportType) || 'flex',
    rows: item.rows_data as RawRow[],
    groups: item.groups_data as DeliveryGroup[],
    headers: item.headers_data as string[],
    checkState: item.check_state_data as CheckState,
  }));
}

export async function addImportEntry(
  rows: RawRow[],
  groups: DeliveryGroup[],
  headers: string[],
  fileName: string,
  checkState: CheckState
): Promise<HistoryEntry> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const insertData = {
    user_id: session.user.id,
    file_name: fileName,
    total_orders: rows.length,
    total_groups: groups.length,
    checked_groups: 0,
    import_type: 'flex',
    rows_data: rows,
    groups_data: groups,
    headers_data: headers,
    check_state_data: checkState,
  };

  const { data, error } = await supabase
    .from('import_history')
    .insert(insertData)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error inserting import history:', error);
    throw error;
  }
  if (!data) throw new Error('Failed to create history entry - no data returned');

  return {
    id: data.id,
    user_id: data.user_id,
    date: todayBR(),
    importTime: nowTime(),
    exportTime: null,
    totalOrders: data.total_orders,
    totalGroups: data.total_groups,
    checkedGroups: data.checked_groups,
    fileName: data.file_name,
    importType: 'flex',
    rows: data.rows_data as RawRow[],
    groups: data.groups_data as DeliveryGroup[],
    headers: data.headers_data as string[],
    checkState: data.check_state_data as CheckState,
  };
}

export async function addFrotaImportEntry(
  fileName: string,
  totalRows: number,
  outputRows: number,
  duplicatesRemoved: number,
  headers: string[],
  rows: string[][],
): Promise<HistoryEntry> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const insertData = {
    user_id: session.user.id,
    file_name: fileName,
    total_orders: totalRows,
    total_groups: outputRows,
    checked_groups: duplicatesRemoved,
    import_type: 'frota',
    rows_data: rows,
    groups_data: [],
    headers_data: headers,
    check_state_data: { checked: {}, spxToGroup: {} },
  };

  const { data, error } = await supabase
    .from('import_history')
    .insert(insertData)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error inserting frota import history:', error);
    throw error;
  }
  if (!data) throw new Error('Failed to create history entry - no data returned');

  return {
    id: data.id,
    user_id: data.user_id,
    date: todayBR(),
    importTime: nowTime(),
    exportTime: null,
    totalOrders: data.total_orders,
    totalGroups: data.total_groups,
    checkedGroups: data.checked_groups,
    checkedOrders: 0,
    fileName: data.file_name,
    importType: 'frota',
    rows: data.rows_data as RawRow[],
    groups: [],
    headers: data.headers_data as string[],
    checkState: { checked: {}, spxToGroup: {} },
  };
}

export async function updateExportEntry(
  id: string,
  groups: DeliveryGroup[],
  checkState: CheckState
): Promise<void> {
  const checkedGroups = groups.filter((g) =>
    g.spxTns.every((spx) => checkState.checked[spx])
  ).length;

  const { error } = await supabase
    .from('import_history')
    .update({
      export_time: new Date().toISOString(),
      groups_data: groups,
      check_state_data: checkState,
      checked_groups: checkedGroups,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function updateHistoryProgress(
  id: string,
  groups: DeliveryGroup[],
  checkState: CheckState
): Promise<void> {
  const checkedGroups = groups.filter((g) =>
    g.spxTns.every((spx) => checkState.checked[spx])
  ).length;

  const { error } = await supabase
    .from('import_history')
    .update({
      groups_data: groups,
      check_state_data: checkState,
      checked_groups: checkedGroups,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const { error } = await supabase.from('import_history').delete().eq('id', id);
  if (error) throw error;
}

export async function findByFileName(fileName: string): Promise<HistoryEntry | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('file_name', fileName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    date: new Date(data.import_time).toLocaleDateString('pt-BR'),
    importTime: new Date(data.import_time).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    exportTime: data.export_time
      ? new Date(data.export_time).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    totalOrders: data.total_orders,
    totalGroups: data.total_groups,
    checkedGroups: data.checked_groups,
    fileName: data.file_name,
    importType: (data.import_type as ImportType) || 'flex',
    rows: data.rows_data as RawRow[],
    groups: data.groups_data as DeliveryGroup[],
    headers: data.headers_data as string[],
    checkState: data.check_state_data as CheckState,
  };
}

export async function getAllHistoryAdmin(): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((item) => ({
    id: item.id,
    user_id: item.user_id,
    date: new Date(item.import_time).toLocaleDateString('pt-BR'),
    importTime: new Date(item.import_time).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    exportTime: item.export_time
      ? new Date(item.export_time).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    totalOrders: item.total_orders,
    totalGroups: item.total_groups,
    checkedGroups: item.checked_groups,
    checkedOrders: countCheckedOrders(item.check_state_data),
    fileName: item.file_name,
    importType: (item.import_type as ImportType) || 'flex',
    rows: item.rows_data as RawRow[],
    groups: item.groups_data as DeliveryGroup[],
    headers: item.headers_data as string[],
    checkState: item.check_state_data as CheckState,
  }));
}

export function reexportXlsx(entry: HistoryEntry) {
  const exportedRows: string[][] = [];
  entry.groups.forEach((group) => {
    const row = entry.rows[group.primaryRowIndex];
    const allChecked = group.spxTns.every((spx) => entry.checkState.checked[spx]);
    const newSequence = allChecked ? group.generatedSequence : row.sequence;
    const newAddress = group.officialAddress || row.destinationAddress;
    exportedRows.push([
      row.colA,
      newSequence,
      row.colC,
      row.spxTn,
      newAddress,
      row.colF,
      row.colG,
      row.colH,
      row.colI,
      row.colJ,
      ...row.extra,
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet([entry.headers, ...exportedRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
  const date = entry.date.replace(/\//g, '-');
  XLSX.writeFile(wb, `entregas_${date}.xlsx`);
}
