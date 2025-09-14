import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ParsedHolding } from '@/lib/holdings-parser';
import { FileText } from 'lucide-react';

interface HoldingsTableProps {
  holdings: ParsedHolding[];
}

export function HoldingsTable({ holdings }: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Holdings Uploaded</h3>
          <p className="text-muted-foreground">
            Upload a CSV or Excel file to see your holdings here
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary statistics
  const totalSecurities = holdings.length;
  const totalQuantity = holdings.reduce((sum, holding) => sum + holding.quantity, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings Summary</CardTitle>
        <CardDescription>
          Your parsed holdings data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold text-primary">{totalSecurities}</div>
            <div className="text-sm text-muted-foreground">Total Securities</div>
          </div>
          <div className="p-4 bg-accent/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-accent">{totalQuantity.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total Quantity</div>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((holding, index) => (
                <TableRow key={holding.symbol + index} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-medium">{holding.symbol}</div>
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
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Showing all {holdings.length} holdings
          </p>
        )}
      </CardContent>
    </Card>
  );
}