import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { parseHoldingsFile, ParseResult } from '@/lib/holdings-parser';

interface HoldingsUploadProps {
  onHoldingsParsed: (result: ParseResult) => void;
}

export function HoldingsUpload({ onHoldingsParsed }: HoldingsUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)'
      });
      return;
    }

    // Validate file size (20MB limit)
    if (file.size > 20 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload a file smaller than 20MB'
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const result = await parseHoldingsFile(file);
      
      // Always pass the result to parent - let parent handle mapping dialog
      onHoldingsParsed(result);
      
      if (result.requiresMapping) {
        // Show warning toast that mapping will be required
        toast({
          title: 'Column mapping required',
          description: 'Some columns need manual mapping. Please review the mapping dialog.',
          variant: 'default'
        });
      } else {
        // Auto-mapped successfully
        const { parsingInfo } = result;
        let toastTitle = `Parsed ${parsingInfo.rawRows} rows → ${result.holdings.length} holdings`;
        
        if (parsingInfo.warnings.length > 0) {
          toastTitle += ` (${parsingInfo.warnings.join(', ')})`;
        }
        
        toast({
          title: toastTitle,
          description: `Sheet: ${parsingInfo.sheetName} • Header: Row ${parsingInfo.headerRow} • ${parsingInfo.confidence}% confidence`
        });
      }
    } catch (error) {
      let errorMessage = 'Could not parse file. Please check the format.';
      
      if (error instanceof Error) {
        if (error.message.includes('empty')) {
          errorMessage = 'The selected sheet appears to be empty.';
        } else if (error.message.includes('header')) {
          errorMessage = 'Could not detect valid column headers. Expected: Symbol, Company Name, ISIN, Quantity.';
        } else if (error.message.includes('encoding')) {
          errorMessage = 'File encoding issue. Try saving as UTF-8 CSV or XLSX and retry.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: errorMessage
      });
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset file input
    }
  };


  return (
    <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Holdings File
          </CardTitle>
          <CardDescription>
            Upload your holdings from any broker export (CSV/Excel). We'll intelligently detect and map the columns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <div className="mx-auto flex flex-col items-center">
              {isUploading ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              ) : (
                <Upload className="h-12 w-12 text-muted-foreground" />
              )}
              
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-medium">
                  {isUploading ? 'Processing your file...' : 'Upload your holdings file'}
                </h3>
                <p className="text-muted-foreground">
                  {isUploading 
                    ? 'This may take a moment for large files'
                    : 'Supports any broker format with Symbol, Company Name, ISIN, and Quantity'
                  }
                </p>
              </div>
              
              {!isUploading && (
                <div className="mt-4">
                  <Button asChild disabled={isUploading}>
                    <label className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Choose File
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        className="sr-only"
                        disabled={isUploading}
                      />
                    </label>
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Smart Column Detection</p>
                <p className="text-blue-700">
                  Our parser works with any broker format - Zerodha, Upstox, ICICI, Angel One, etc. 
                  We'll automatically detect headers even with junk rows at the top.
                </p>
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Expected columns:</strong> Symbol/Ticker, Company/Security Name, ISIN (optional), Quantity/Holdings
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}