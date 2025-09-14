import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getHoldings, setHoldings, getDividends, setDividends } from '@/lib/storage';
import { DividendRow } from '@/types';
import { ArrowLeft } from 'lucide-react';
import { ParseResult, ParsedHolding, CanonicalKey, applyManualMapping } from '@/lib/holdings-parser';
import { HoldingsUpload } from '@/components/holdings/HoldingsUpload';
import { HoldingsTable } from '@/components/holdings/HoldingsTable';
import { ParsingInfoCard } from '@/components/holdings/ParsingInfoCard';
import { ManualHoldingEntry } from '@/components/holdings/ManualHoldingEntry';
import { HeaderMappingDialog } from '@/components/holdings/HeaderMappingDialog';

export const HoldingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [holdings, setHoldingsState] = useState<ParsedHolding[]>([]);
  const [parsingInfo, setParsingInfo] = useState<ParseResult['parsingInfo'] | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [mappingDialog, setMappingDialog] = useState<{
    open: boolean;
    requiresMapping?: NonNullable<ParseResult['requiresMapping']>;
  }>({ open: false });

  useEffect(() => {
    const savedHoldings = getHoldings();
    // Convert old HoldingRow format to new ParsedHolding format
    const convertedHoldings: ParsedHolding[] = savedHoldings.map(holding => ({
      symbol: holding.symbol,
      quantity: holding.qty
    }));
    setHoldingsState(convertedHoldings);
  }, []);

  const handleHoldingsParsed = (result: ParseResult) => {
    if (result.requiresMapping) {
      setMappingDialog({
        open: true,
        requiresMapping: result.requiresMapping
      });
      return;
    }

    setHoldingsState(result.holdings);
    setParsingInfo(result.parsingInfo);
    
    // Save to localStorage (convert to old format for compatibility)
    const legacyHoldings = result.holdings.map(h => ({
      symbol: h.symbol,
      qty: h.quantity
    }));
    setHoldings(legacyHoldings);

    // Initialize dividends
    const dividends: DividendRow[] = result.holdings.map(holding => ({
      symbol: holding.symbol,
      qty: holding.quantity,
      dps: 0,
      total: 0,
      status: 'pending',
    }));
    setDividends(dividends);
  };

  const handleMappingConfirm = async (mapping: Record<CanonicalKey, string>) => {
    if (!mappingDialog.requiresMapping) return;
    
    try {
      const result = await applyManualMapping(mappingDialog.requiresMapping, mapping);
      handleHoldingsParsed(result);
      
      toast({
        title: 'Mapping saved',
        description: 'Column mapping saved successfully. We\'ll use this for similar files in the future.'
      });
      
      setMappingDialog({ open: false });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Mapping failed',
        description: error instanceof Error ? error.message : 'Could not apply column mapping'
      });
    }
  };

  const handleManualAdd = (newHolding: ParsedHolding) => {
    const updatedHoldings = [...holdings, newHolding];
    setHoldingsState(updatedHoldings);
    
    // Save to localStorage (convert to old format for compatibility)
    const legacyHoldings = updatedHoldings.map(h => ({
      symbol: h.symbol,
      qty: h.quantity
    }));
    setHoldings(legacyHoldings);

    // Update dividends
    const currentDividends = getDividends();
    const updatedDividends = [...currentDividends, {
      symbol: newHolding.symbol,
      qty: newHolding.quantity,
      dps: 0,
      total: 0,
      status: 'pending' as const,
    }];
    setDividends(updatedDividends);
  };

  const handleContinue = () => {
    if (holdings.length === 0) {
      toast({ variant: 'destructive', title: 'Please upload holdings or add them manually' });
      return;
    }
    navigate('/dashboard');
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
            <HoldingsUpload onHoldingsParsed={handleHoldingsParsed} />

            {/* Manual Entry */}
            <ManualHoldingEntry 
              onHoldingAdded={handleManualAdd}
              isOpen={isManualOpen}
              onToggle={setIsManualOpen}
            />

            {/* Parsing Info */}
            {parsingInfo && (
              <ParsingInfoCard 
                parsingInfo={parsingInfo}
                holdingsCount={holdings.length}
              />
            )}

            {/* Holdings Table */}
            <HoldingsTable holdings={holdings} />

            {/* Continue Button */}
            {holdings.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleContinue} size="lg">
                  Continue to Dashboard ({holdings.length} holdings)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mapping Dialog */}
      {mappingDialog.requiresMapping && (
        <HeaderMappingDialog
          open={mappingDialog.open}
          onClose={() => setMappingDialog({ open: false })}
          requiresMapping={mappingDialog.requiresMapping}
          onConfirm={handleMappingConfirm}
        />
      )}
    </div>
  );
};