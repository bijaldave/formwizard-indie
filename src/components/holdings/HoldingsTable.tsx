import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ParsedHolding } from '@/lib/holdings-parser';
import { Building2, Hash, Coins, ShieldCheck } from 'lucide-react';

interface HoldingsTableProps {
  holdings: ParsedHolding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No holdings uploaded yet</p>
        <p className="text-sm">Upload a file or add holdings manually to get started</p>
      </div>
    );
  }

  const totalQuantity = holdings.reduce((sum, holding) => sum + holding.quantity, 0);
  const totalSecurities = holdings.length;
  const withISIN = holdings.filter(h => h.isin).length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <div className="p-2 bg-primary/10 rounded-full">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Securities</p>
            <p className="text-2xl font-bold text-primary">{totalSecurities}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="p-2 bg-green-100 rounded-full">
            <Coins className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Quantity</p>
            <p className="text-2xl font-bold text-green-700">{totalQuantity.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="p-2 bg-blue-100 rounded-full">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">With ISIN</p>
            <p className="text-2xl font-bold text-blue-700">{withISIN}</p>
            <p className="text-xs text-blue-600">{Math.round((withISIN / totalSecurities) * 100)}% coverage</p>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Symbol</TableHead>
              <TableHead className="font-semibold">Security Name</TableHead>
              <TableHead className="font-semibold">ISIN</TableHead>
              <TableHead className="font-semibold text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding, index) => (
              <TableRow key={`${holding.isin || holding.symbol}-${index}`} className="hover:bg-muted/30">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {holding.symbol}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    <p className="font-medium truncate">{holding.security_name}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {holding.isin ? (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {holding.isin}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {holding.quantity.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {holdings.length > 10 && (
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing all {holdings.length} holdings
          </p>
        </div>
      )}
    </div>
  );
}