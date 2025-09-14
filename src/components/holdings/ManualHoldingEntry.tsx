import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { ParsedHolding } from '@/lib/holdings-parser';
import { Plus, ChevronDown } from 'lucide-react';

interface ManualHoldingEntryProps {
  onHoldingAdded: (holding: ParsedHolding) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function ManualHoldingEntry({ onHoldingAdded, isOpen, onToggle }: ManualHoldingEntryProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: ''
  });

  const handleAdd = () => {
    // Validate required fields
    if (!formData.symbol.trim()) {
      toast({ variant: 'destructive', title: 'Trading symbol is required' });
      return;
    }

    if (!formData.quantity.trim()) {
      toast({ variant: 'destructive', title: 'Quantity is required' });
      return;
    }

    // Validate quantity
    const quantity = parseInt(formData.quantity.trim(), 10);
    if (isNaN(quantity) || quantity <= 0) {
      toast({ variant: 'destructive', title: 'Quantity must be a positive number' });
      return;
    }

    const newHolding: ParsedHolding = {
      symbol: formData.symbol.trim().toUpperCase(),
      quantity
    };

    onHoldingAdded(newHolding);

    // Reset form
    setFormData({
      symbol: '',
      quantity: ''
    });

    toast({ 
      title: 'Holding added successfully',
      description: `Added ${quantity} shares of ${newHolding.symbol}`
    });

    // Close the panel after successful addition
    onToggle(false);
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <CardTitle className="flex items-center gap-2 text-left">
                <Plus className="h-5 w-5" />
                Add Holding Manually
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="manual-symbol">Trading Symbol *</Label>
                <Input
                  id="manual-symbol"
                  value={formData.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value)}
                  placeholder="RELIANCE"
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Stock ticker symbol (e.g., RELIANCE, TCS, INFY)
                </p>
              </div>
              
              <div>
                <Label htmlFor="manual-quantity">Quantity *</Label>
                <Input
                  id="manual-quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of shares held
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAdd} className="flex-1">
                Add Holding
              </Button>
              <Button variant="outline" onClick={() => onToggle(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}