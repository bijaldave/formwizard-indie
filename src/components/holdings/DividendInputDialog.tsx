import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DividendInputDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (dps: number) => void;
  symbol: string;
  quantity: number;
}

export function DividendInputDialog({ 
  open, 
  onClose, 
  onConfirm, 
  symbol, 
  quantity 
}: DividendInputDialogProps) {
  const [dps, setDps] = useState('');

  const handleConfirm = () => {
    const dividendPerShare = parseFloat(dps);
    if (isNaN(dividendPerShare) || dividendPerShare <= 0) {
      return;
    }
    onConfirm(dividendPerShare);
    setDps('');
  };

  const handleClose = () => {
    setDps('');
    onClose();
  };

  const totalDividend = parseFloat(dps) * quantity || 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Dividend Details</DialogTitle>
          <DialogDescription>
            Enter the dividend per share for {symbol} to generate the PDF form.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Symbol:</span>
              <p className="font-medium">{symbol}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity:</span>
              <p className="font-medium">{quantity}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dps">Dividend per Share (₹)</Label>
            <Input
              id="dps"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={dps}
              onChange={(e) => setDps(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>
          
          {totalDividend > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Dividend:</span>
              <p className="font-semibold text-lg">₹{totalDividend.toFixed(2)}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!dps || parseFloat(dps) <= 0}
          >
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}