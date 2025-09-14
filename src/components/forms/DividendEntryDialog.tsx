import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DividendRow } from '@/types';
import { Calculator } from 'lucide-react';

interface DividendEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dividend: DividendRow;
  onSave: (updatedDividend: DividendRow) => void;
}

export const DividendEntryDialog = ({
  open,
  onOpenChange,
  dividend,
  onSave
}: DividendEntryDialogProps) => {
  const { toast } = useToast();
  const [dps, setDps] = useState<string>(dividend.dps?.toString() || '');

  const handleSave = () => {
    const dpsNum = parseFloat(dps);
    
    if (!dpsNum || dpsNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please enter a valid dividend per share amount greater than 0.'
      });
      return;
    }

    const updatedDividend: DividendRow = {
      ...dividend,
      dps: dpsNum,
      total: dpsNum * dividend.qty,
      status: 'ready'
    };

    onSave(updatedDividend);
    onOpenChange(false);
    
    toast({
      title: 'Dividend Updated',
      description: `Dividend set to ₹${dpsNum} per share for ${dividend.symbol}`
    });
  };

  const totalAmount = dps ? parseFloat(dps) * dividend.qty : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Dividend - {dividend.symbol}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Quantity Held
            </Label>
            <div className="text-lg font-semibold">
              {dividend.qty.toLocaleString()} shares
            </div>
          </div>

          <div>
            <Label htmlFor="dps">Dividend per Share (₹)</Label>
            <Input
              id="dps"
              type="number"
              step="0.01"
              value={dps}
              onChange={(e) => setDps(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter the declared dividend per share for this stock.
            </p>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium text-muted-foreground">
              Total Dividend Amount
            </Label>
            <div className="text-xl font-bold text-primary flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              ₹{totalAmount.toLocaleString()}
            </div>
            {dps && (
              <p className="text-xs text-muted-foreground">
                {dps} × {dividend.qty.toLocaleString()} = ₹{totalAmount.toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!dps || parseFloat(dps) <= 0}
              className="flex-1"
            >
              Save & Mark Ready
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};