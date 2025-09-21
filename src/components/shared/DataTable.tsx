'use client';

import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, MoreHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: TData) => void;
  className?: string;
  enablePagination?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enableColumnVisibility?: boolean;
  pageSize?: number;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  isLoading = false,
  emptyTitle = 'No data found',
  emptyDescription = 'No data is available to display.',
  onRowClick,
  className,
  enablePagination = true,
  enableSorting = true,
  enableFiltering = true,
  enableColumnVisibility = true,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
    ...(enableSorting && { onSortingChange: setSorting }),
    ...(enableSorting && { getSortedRowModel: getSortedRowModel() }),
    ...(enableFiltering && { onColumnFiltersChange: setColumnFilters }),
    ...(enableFiltering && { getFilteredRowModel: getFilteredRowModel() }),
    ...(enableColumnVisibility && { onColumnVisibilityChange: setColumnVisibility }),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      globalFilter,
      ...(enableSorting && { sorting }),
      ...(enableFiltering && { columnFilters }),
      ...(enableColumnVisibility && { columnVisibility }),
      ...(enablePagination && {
        pagination: {
          pageIndex: 0,
          pageSize,
        },
      }),
    },
  });

  const searchValue = searchKey
    ? (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
    : globalFilter;

  const handleSearchChange = (value: string) => {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value);
    } else {
      setGlobalFilter(value);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('w-full', className)}>
        <LoadingSpinner variant="page" text="Loading data..." />
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Table Controls */}
      <div className="flex items-center justify-between">
        {/* Search */}
        {enableFiltering && (
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="pl-8 max-w-sm"
              />
            </div>
          </div>
        )}

        {/* Column Visibility */}
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value: any) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center space-x-2',
                            header.column.getCanSort() && 'cursor-pointer select-none'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {enableSorting && header.column.getCanSort() && (
                            <div className="ml-2">
                              {header.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : header.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <div className="h-4 w-4" />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    variant="minimal"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} total rows
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {table.getPageCount()}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Column helper for common cell types
export const createActionsColumn = <TData,>(
  actions: Array<{
    label: string;
    onClick: (row: TData) => void;
    variant?: 'default' | 'destructive';
  }>
): ColumnDef<TData> => ({
  id: 'actions',
  cell: ({ row }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.map((action, index) => (
            <DropdownMenuCheckboxItem
              key={index}
              onClick={() => action.onClick(row.original)}
              className={cn(
                action.variant === 'destructive' && 'text-destructive'
              )}
            >
              {action.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
});

export const createDateColumn = <TData,>(
  accessorKey: string,
  header: string
): ColumnDef<TData> => ({
  accessorKey,
  header,
  cell: ({ getValue }) => {
    const date = getValue() as string | Date;
    if (!date) return '-';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString();
  },
});

export const createStatusColumn = <TData,>(
  accessorKey: string,
  header: string,
  statusConfig: Record<string, { label: string; className: string }>
): ColumnDef<TData> => ({
  accessorKey,
  header,
  cell: ({ getValue }) => {
    const status = getValue() as string;
    const config = statusConfig[status] || { label: status, className: '' };

    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', config.className)}>
        {config.label}
      </span>
    );
  },
});