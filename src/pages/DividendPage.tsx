import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getDividends, setDividends } from '@/lib/storage';
import { DividendRow } from '@/types';
import { ArrowLeft, DollarSign, Calculator } from 'lucide-react';

export const DividendPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dividends, setDividendsState] = useState<DividendRow[]>([]);

  useEffect(() => {
    const savedDividends = getDividends();
    setDividendsState(savedDividends);
  }, []);

  const handleDividendChange = (index: number, dps: string) => {
    const dpsNum = parseFloat(dps) || 0;
    const updatedDividends = [...dividends];
    updatedDividends[index] = {
      ...updatedDividends[index],
      dps: dpsNum,
      total: dpsNum * updatedDividends[index].qty,
    };
    setDividendsState(updatedDividends);
    setDividends(updatedDividends);
  };

  const handleStatusToggle = (index: number, ready: boolean) => {
    const updatedDividends = [...dividends];
    updatedDividends[index] = {
      ...updatedDividends[index],
      status: ready ? 'ready' : 'pending',
    };
    setDividendsState(updatedDividends);
    setDividends(updatedDividends);
  };

  const handleContinue = () => {
    const readyCount = dividends.filter(d => d.status === 'ready').length;
    if (readyCount === 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Please mark at least one stock as ready to generate forms' 
      });
      return;
    }
    navigate('/dashboard');
  };

  const readyCount = dividends.filter(d => d.status === 'ready').length;
  const totalDividend = dividends
    .filter(d => d.status === 'ready')
    .reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/holdings')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Holdings
          </Button>

          <div className="space-y-6">
            {/* Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Dividend Entry
                </CardTitle>
                <CardDescription>
                  Enter dividend per share for each stock. Mark stocks as ready when you want to generate forms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-primary">{dividends.length}</div>
                    <div className="text-sm text-muted-foreground">Total Holdings</div>
                  </div>
                  <div className="p-4 bg-success/10 rounded-lg">
                    <div className="text-2xl font-bold text-success">{readyCount}</div>
                    <div className="text-sm text-muted-foreground">Ready to Generate</div>
                  </div>
                  <div className="p-4 bg-accent/10 rounded-lg">
                    <div className="text-2xl font-bold text-accent">₹{totalDividend.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Total Dividend</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dividend Cards */}
            <div className="space-y-4">
              {dividends.map((dividend, index) => (
                <Card key={dividend.isin || dividend.symbol} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {dividend.symbol} · {dividend.company}
                        </CardTitle>
                        {dividend.isin && (
                          <p className="text-sm text-muted-foreground mt-1">ISIN: {dividend.isin}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`ready-${index}`} className="text-sm">
                          Ready to generate
                        </Label>
                        <Switch
                          id={`ready-${index}`}
                          checked={dividend.status === 'ready'}
                          onCheckedChange={(checked) => handleStatusToggle(index, checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Quantity held
                        </Label>
                        <div className="text-lg font-semibold">
                          {dividend.qty.toLocaleString()}
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor={`dps-${index}`} className="text-sm font-medium">
                          Dividend per share (₹)
                        </Label>
                        <Input
                          id={`dps-${index}`}
                          type="number"
                          step="0.01"
                          value={dividend.dps || ''}
                          onChange={(e) => handleDividendChange(index, e.target.value)}
                          placeholder="0.00"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the declared dividend per share for this stock. We'll multiply by your quantity.
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Total dividend (₹)
                        </Label>
                        <div className="text-lg font-semibold text-success flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          {dividend.total.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {dividend.dps} × {dividend.qty.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {dividends.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Holdings Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Please upload your holdings first to enter dividend information.
                  </p>
                  <Button onClick={() => navigate('/holdings')}>
                    Go to Holdings
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            {dividends.length > 0 && (
              <div className="flex gap-4">
                <Button onClick={handleContinue} className="flex-1">
                  Continue to Dashboard ({readyCount} stocks ready)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};