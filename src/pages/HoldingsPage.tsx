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
import Fuse from 'fuse.js';

export const HoldingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [holdings, setHoldingsState] = useState<HoldingRow[]>([]);
  const [parsingInfo, setParsingInfo] = useState<{
    headerRow: number;
    sheetName: string;
    confidence: number;
    totalRows: number;
  } | null>(null);
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

  // Enhanced NLP-based parser with fuzzy matching
  const parseHoldings = (data: any[], sheetName: string): HoldingRow[] => {
    if (!data || data.length === 0) return [];

    // Comprehensive synonym map for broker exports
    const synonymMap = {
      symbol: ['symbol', 'ticker', 'trading symbol', 'security symbol', 'scrip', 'scrip code', 'code', 'stock code', 'share code'],
      company_name: ['security name', 'scrip name', 'company', 'company name', 'security', 'instrument', 'name', 'stock name', 'share name', 'issuer name'],
      isin: ['isin', 'isin code', 'isin_no', 'isin number', 'international security identification number'],
      quantity: ['qty', 'quantity', 'quantity held', 'quantity available', 'net qty', 'free qty', 'holdings', 'balance', 'avail qty', 'available quantity', 'shares', 'units']
    };

    // Normalize text for fuzzy matching
    const normalizeText = (text: string): string => {
      return text.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Fuzzy match using Fuse.js
    const fuzzyMatch = (text: string, synonyms: string[], threshold = 0.6): boolean => {
      const fuse = new Fuse(synonyms, {
        includeScore: true,
        threshold: 1 - threshold, // Fuse uses distance, we want similarity
        keys: ['']
      });
      
      const result = fuse.search(normalizeText(text));
      return result.length > 0 && result[0].score! <= (1 - threshold);
    };

    // Find best header row by scanning first 30 rows
    let bestHeaderRow = -1;
    let bestScore = -1;
    let bestConfidence = 0;

    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') continue;

      const headers = Object.keys(row);
      if (headers.length < 2) continue;

      let score = 0;
      const matchedFields = new Set<string>();

      headers.forEach(header => {
        const headerText = String(header).trim();
        if (!headerText || headerText.length < 2) return;

        Object.entries(synonymMap).forEach(([canonical, synonyms]) => {
          if (fuzzyMatch(headerText, synonyms, 0.75)) {
            score += 2; // Higher weight for exact matches
            matchedFields.add(canonical);
          } else if (fuzzyMatch(headerText, synonyms, 0.5)) {
            score += 1; // Lower weight for partial matches
            matchedFields.add(canonical);
          }
        });
      });

      // Require at least symbol, company, and quantity
      const requiredFields = ['symbol', 'company_name', 'quantity'];
      const hasRequired = requiredFields.every(field => matchedFields.has(field));

      if (hasRequired && score > bestScore) {
        bestScore = score;
        bestHeaderRow = i;
        bestConfidence = Math.min(100, (score / (headers.length * 2)) * 100);
      }
    }

    if (bestHeaderRow === -1) {
      throw new Error("Cannot detect header row. Expected columns: Symbol, Company Name, and Quantity");
    }

    // Map columns to canonical fields
    const headerRow = data[bestHeaderRow];
    const columnMap: Record<string, string> = {};

    Object.keys(headerRow).forEach(key => {
      const keyText = String(key).trim();
      
      Object.entries(synonymMap).forEach(([canonical, synonyms]) => {
        if (!columnMap[canonical] && fuzzyMatch(keyText, synonyms, 0.75)) {
          columnMap[canonical] = key;
        }
      });
    });

    // Store parsing info for UI feedback
    setParsingInfo({
      headerRow: bestHeaderRow + 1, // 1-indexed for display
      sheetName,
      confidence: Math.round(bestConfidence),
      totalRows: data.length - bestHeaderRow - 1
    });

    // Parse and normalize data rows
    const holdings: HoldingRow[] = [];
    const seenKeys = new Set<string>();

    for (let i = bestHeaderRow + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || typeof row !== 'object') continue;

      const symbol = row[columnMap.symbol];
      const company = row[columnMap.company_name];
      const isin = row[columnMap.isin];
      let qty = row[columnMap.quantity];

      // Skip if missing required fields
      if (!symbol || !company || !qty) continue;

      // Clean and validate quantity
      if (typeof qty === 'string') {
        qty = qty.replace(/[,\s]/g, '');
      }
      const qtyNum = parseInt(qty, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) continue;

      // Normalize fields
      const normalizedSymbol = String(symbol).trim().toUpperCase();
      const normalizedCompany = String(company).trim();
      let normalizedISIN = '';
      
      if (isin) {
        normalizedISIN = String(isin).trim().toUpperCase();
        // Validate ISIN format (basic check)
        if (normalizedISIN && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(normalizedISIN)) {
          normalizedISIN = ''; // Clear invalid ISIN
        }
      }

      // Deduplicate using ISIN > Symbol > Company
      const dedupeKey = normalizedISIN || normalizedSymbol || normalizedCompany;
      
      if (seenKeys.has(dedupeKey)) {
        // Sum quantities for duplicates
        const existingIndex = holdings.findIndex(h => 
          (h.isin && h.isin === normalizedISIN) ||
          (h.symbol === normalizedSymbol) ||
          (h.company === normalizedCompany)
        );
        if (existingIndex >= 0) {
          holdings[existingIndex].qty += qtyNum;
        }
      } else {
        holdings.push({
          symbol: normalizedSymbol,
          company: normalizedCompany,
          isin: normalizedISIN,
          qty: qtyNum,
        });
        seenKeys.add(dedupeKey);
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
        
        // Enhanced sheet selection logic
        let selectedSheet = '';
        
        if (workbook.SheetNames.length === 1) {
          selectedSheet = workbook.SheetNames[0];
        } else {
          // Look for equity sheet (case-insensitive)
          const equitySheet = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('equity')
          );
          
          if (equitySheet) {
            selectedSheet = equitySheet;
          } else {
            // Find sheet with most non-empty rows (likely the data sheet)
            let bestSheet = workbook.SheetNames[0];
            let maxRows = 0;
            
            workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);
              if (jsonData.length > maxRows) {
                maxRows = jsonData.length;
                bestSheet = sheetName;
              }
            });
            
            selectedSheet = bestSheet;
          }
        }

        const worksheet = workbook.Sheets[selectedSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          throw new Error('Selected sheet appears to be empty');
        }
        
        const parsedHoldings = parseHoldings(jsonData, selectedSheet);
        
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
          title: `Sheet: ${selectedSheet} • Header: Row ${parsingInfo?.headerRow} • Parsed ${parsedHoldings.length} stocks (${parsingInfo?.confidence}% confidence)` 
        });
        
      } catch (error) {
        setParsingInfo(null);
        toast({
          variant: 'destructive',
          title: error instanceof Error ? error.message : "Cannot parse file. Try CSV/XLSX with Symbol, Company Name, and Quantity columns."
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

            {/* Parsing Info */}
            {parsingInfo && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="text-primary font-medium">Sheet:</span>
                      {parsingInfo.sheetName}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-primary font-medium">Header:</span>
                      Row {parsingInfo.headerRow}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-primary font-medium">Confidence:</span>
                      <span className={parsingInfo.confidence > 80 ? 'text-green-600' : parsingInfo.confidence > 60 ? 'text-yellow-600' : 'text-red-600'}>
                        {parsingInfo.confidence}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-primary font-medium">Data Rows:</span>
                      {parsingInfo.totalRows}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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