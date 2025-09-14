import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { CanonicalKey, ParseResult } from '@/lib/holdings-parser';
import { CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface HeaderMappingDialogProps {
  open: boolean;
  onClose: () => void;
  requiresMapping: NonNullable<ParseResult['requiresMapping']>;
  onConfirm: (mapping: Record<CanonicalKey, string>) => void;
}

const FIELD_DESCRIPTIONS: Record<CanonicalKey, { label: string; description: string; example: string }> = {
  symbol: {
    label: 'Trading Symbol',
    description: 'The ticker symbol used for trading',
    example: 'RELIANCE, TCS, INFY'
  },
  security_name: {
    label: 'Security Name',
    description: 'Full company or security name',
    example: 'Reliance Industries Ltd'
  },
  isin: {
    label: 'ISIN Code',
    description: 'International Security Identification Number',
    example: 'INE002A01018'
  },
  quantity: {
    label: 'Quantity',
    description: 'Number of shares held',
    example: '100, 250, 1000'
  }
};

function getConfidenceColor(score: number): string {
  if (score >= 0.75) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 0.5) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function getConfidenceIcon(score: number) {
  if (score >= 0.75) return <CheckCircle className="h-3 w-3" />;
  if (score >= 0.5) return <AlertCircle className="h-3 w-3" />;
  return <HelpCircle className="h-3 w-3" />;
}

export function HeaderMappingDialog({ open, onClose, requiresMapping, onConfirm }: HeaderMappingDialogProps) {
  const [mapping, setMapping] = useState<Partial<Record<CanonicalKey, string>>>({});
  const [errors, setErrors] = useState<Set<CanonicalKey>>(new Set());

  const handleFieldMapping = (canonical: CanonicalKey, column: string) => {
    setMapping(prev => ({ ...prev, [canonical]: column }));
    setErrors(prev => {
      const newErrors = new Set(prev);
      newErrors.delete(canonical);
      return newErrors;
    });
  };

  const handleConfirm = () => {
    const requiredFields: CanonicalKey[] = ['symbol', 'security_name', 'quantity'];
    const missingFields = requiredFields.filter(field => !mapping[field]);
    
    if (missingFields.length > 0) {
      setErrors(new Set(missingFields));
      return;
    }

    onConfirm(mapping as Record<CanonicalKey, string>);
  };

  const hasErrors = errors.size > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Confirm Column Matches
          </DialogTitle>
          <DialogDescription>
            We couldn't confidently map all columns. Please select the correct column for each field.
            Your choices will be saved for future imports from this broker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {requiresMapping.ambiguousFields.map(({ canonical, candidates }) => {
            const fieldInfo = FIELD_DESCRIPTIONS[canonical];
            const isRequired = ['symbol', 'security_name', 'quantity'].includes(canonical);
            const hasError = errors.has(canonical);
            
            return (
              <Card key={canonical} className={`${hasError ? 'border-red-200 bg-red-50' : ''}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {fieldInfo.label}
                    {isRequired && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    {!isRequired && <Badge variant="secondary" className="text-xs">Optional</Badge>}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {fieldInfo.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Examples:</strong> {fieldInfo.example}
                  </p>
                  {hasError && (
                    <p className="text-sm text-red-600 font-medium">
                      Please select a column for this required field.
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={mapping[canonical] || ''}
                    onValueChange={(value) => handleFieldMapping(canonical, value)}
                  >
                    {candidates.map(({ column, score, preview }) => (
                      <div key={column} className="flex items-start space-x-3 space-y-0">
                        <RadioGroupItem value={column} id={`${canonical}-${column}`} />
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`${canonical}-${column}`}
                            className="text-sm font-medium cursor-pointer flex items-center gap-2"
                          >
                            {column}
                            <Badge
                              variant="outline"
                              className={`text-xs flex items-center gap-1 ${getConfidenceColor(score)}`}
                            >
                              {getConfidenceIcon(score)}
                              {Math.round(score * 100)}%
                            </Badge>
                          </Label>
                          {preview.length > 0 && (
                            <div className="mt-1">
                              <p className="text-xs text-muted-foreground mb-1">Sample values:</p>
                              <div className="flex flex-wrap gap-1">
                                {preview.slice(0, 3).map((value, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs font-normal">
                                    {String(value).substring(0, 20)}
                                    {String(value).length > 20 ? '...' : ''}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={hasErrors}>
            {hasErrors ? 'Select Required Fields' : 'Save Mapping & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}