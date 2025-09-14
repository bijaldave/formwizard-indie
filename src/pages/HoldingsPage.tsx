import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getHoldings, setHoldings, getDividends, setDividends } from '@/lib/storage';
import { HoldingRow, DividendRow } from '@/types';
import { ArrowLeft, Upload, Plus, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export const HoldingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [holdings, setHoldingsState] = useState<HoldingRow[]>([]);
  const [manualEntry, setManualEntry] = useState({
    symbol: '',
    company: '',
    isin: '',
    qty: '',
  });
  const [isManualOpen, setIsManualOpen] = useState(false);

  useEffect(() => {
    const savedHoldings = getHoldings();
    setHoldingsState(savedHoldings);
  }, []);

  const parseHoldings = (data: any[]): HoldingRow[] => {
    if (!data || data.length === 0) return [];

    // Find header row (scan first 30 rows for common patterns)
    let headerRowIndex = -1;
    const synonyms = {
      symbol: ['trading symbol', 'security symbol', 'scrip', 'code', 'symbol'],
      company: ['scrip name', 'company', 'instrument', 'name', 'security name'],
      isin: ['isin code', 'isin no', 'isin number', 'isin'],
      qty: ['qty', 'quantity held', 'quantity available', 'net qty', 'holdings', 'balance', 'quantity']
    };

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') continue;

      const keys = Object.keys(row).map(k => k.toLowerCase());
      const hasSymbol = synonyms.symbol.some(s => keys.some(k => k.includes(s)));
      const hasCompany = synonyms.company.some(s => keys.some(k => k.includes(s)));
      const hasQty = synonyms.qty.some(s => keys.some(k => k.includes(s)));

      if (hasSymbol && hasCompany && hasQty) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("Can't find headers. Expected columns: Symbol, Company Name, ISIN, Quantity");
    }

    // Map columns
    const headerRow = data[headerRowIndex];
    const columnMap: Record<string, string> = {};

    Object.keys(headerRow).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (synonyms.symbol.some(s => lowerKey.includes(s))) {
        columnMap.symbol = key;
      } else if (synonyms.company.some(s => lowerKey.includes(s))) {
        columnMap.company = key;
      } else if (synonyms.isin.some(s => lowerKey.includes(s))) {
        columnMap.isin = key;
      } else if (synonyms.qty.some(s => lowerKey.includes(s))) {
        columnMap.qty = key;
      }
    });

    // Parse data rows
    const holdings: HoldingRow[] = [];
    const seenISIN = new Set<string>();

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') continue;

      const symbol = row[columnMap.symbol];
      const company = row[columnMap.company];
      const isin = row[columnMap.isin];
      let qty = row[columnMap.qty];

      if (!symbol || !company || !qty) continue;

      // Clean quantity
      if (typeof qty === 'string') {
        qty = qty.replace(/[,\s]/g, '');
      }
      const qtyNum = parseInt(qty, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) continue;

      // Use ISIN for deduplication, fallback to symbol
      const dedupeKey = isin || symbol;
      if (seenISIN.has(dedupeKey)) {
        const existingIndex = holdings.findIndex(h => (h.isin && h.isin === isin) || h.symbol === symbol);
        if (existingIndex >= 0) {
          holdings[existingIndex].qty += qtyNum;
        }
      } else {
        holdings.push({
          symbol: String(symbol).trim(),
          company: String(company).trim(),
          isin: isin ? String(isin).trim() : '',
          qty: qtyNum,
        });
        seenISIN.add(dedupeKey);
      }
    }

    return holdings;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Find sheet containing "Equity" or use first non-empty sheet
        let sheetName = workbook.SheetNames.find(name => 
          name.toLowerCase().includes('equity')
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const parsedHoldings = parseHoldings(jsonData);
        
        if (parsedHoldings.length === 0) {
          throw new Error('No valid holdings found in file');
        }

        setHoldingsState(parsedHoldings);
        setHoldings(parsedHoldings);

        // Initialize dividends
        const dividends: DividendRow[] = parsedHoldings.map(holding => ({
          ...holding,
          dps: 0,
          total: 0,
          status: 'pending',
        }));
        setDividends(dividends);

        toast({ 
          title: `Parsed ${jsonData.length} rows · Deduped to ${parsedHoldings.length} stocks` 
        });
        
      } catch (error) {
        toast({
          variant: 'destructive',
          title: "Can't read file. Try CSV/XLSX with columns: Symbol, Name, ISIN, Quantity."
        });
      }
    };

    reader.readAsBinaryString(file);
    event.target.value = '';
  };

  const handleManualAdd = () => {
    if (!manualEntry.symbol || !manualEntry.company || !manualEntry.qty) {
      toast({ variant: 'destructive', title: 'Please fill all required fields' });
      return;
    }

    const qty = parseInt(manualEntry.qty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: 'destructive', title: 'Quantity must be a positive number' });
      return;
    }

    const newHolding: HoldingRow = {
      symbol: manualEntry.symbol.trim(),
      company: manualEntry.company.trim(),
      isin: manualEntry.isin.trim(),
      qty: qty,
    };

    const updatedHoldings = [...holdings, newHolding];
    setHoldingsState(updatedHoldings);
    setHoldings(updatedHoldings);

    // Update dividends
    const currentDividends = getDividends();
    const updatedDividends = [...currentDividends, {
      ...newHolding,
      dps: 0,
      total: 0,
      status: 'pending' as const,
    }];
    setDividends(updatedDividends);

    setManualEntry({ symbol: '', company: '', isin: '', qty: '' });
    setIsManualOpen(false);
    
    toast({ title: 'Holding added successfully' });
  };

  const handleContinue = () => {
    if (holdings.length === 0) {
      toast({ variant: 'destructive', title: 'Please upload holdings or add them manually' });
      return;
    }
    navigate('/dividends');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>

          <div className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Holdings
                </CardTitle>
                <CardDescription>
                  Upload your holdings from CSV or Excel file from your broker
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Upload your holdings file</h3>
                    <p className="text-muted-foreground">
                      Supports CSV/XLSX files with Symbol, Company Name, ISIN, and Quantity columns
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="mt-4"
                  />
                </div>
                
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Sample format:</strong> Symbol | Security Name | ISIN | Quantity
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Manual Entry */}
            <Card>
              <Collapsible open={isManualOpen} onOpenChange={setIsManualOpen}>
                <CardHeader>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0">
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Add Manually
                      </CardTitle>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isManualOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="symbol">Trading Symbol *</Label>
                        <Input
                          id="symbol"
                          value={manualEntry.symbol}
                          onChange={(e) => setManualEntry(prev => ({ ...prev, symbol: e.target.value }))}
                          placeholder="RELIANCE"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="company">Company Name *</Label>
                        <Input
                          id="company"
                          value={manualEntry.company}
                          onChange={(e) => setManualEntry(prev => ({ ...prev, company: e.target.value }))}
                          placeholder="Reliance Industries Ltd"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="isin">ISIN (optional)</Label>
                        <Input
                          id="isin"
                          value={manualEntry.isin}
                          onChange={(e) => setManualEntry(prev => ({ ...prev, isin: e.target.value }))}
                          placeholder="INE002A01018"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="qty">Quantity *</Label>
                        <Input
                          id="qty"
                          type="number"
                          value={manualEntry.qty}
                          onChange={(e) => setManualEntry(prev => ({ ...prev, qty: e.target.value }))}
                          placeholder="100"
                        />
                      </div>
                    </div>
                    
                    <Button onClick={handleManualAdd} className="w-full">
                      Add Holding
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Holdings Table */}
            {holdings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Holdings ({holdings.length} stocks)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Security Name</TableHead>
                        <TableHead>ISIN</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holdings.map((holding, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{holding.symbol}</TableCell>
                          <TableCell>{holding.company}</TableCell>
                          <TableCell>{holding.isin || 'N/A'}</TableCell>
                          <TableCell className="text-right">{holding.qty.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button onClick={handleContinue} className="flex-1" disabled={holdings.length === 0}>
                Continue to Dividend Entry
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};